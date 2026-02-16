/**
 * Sync Process Management Edge Function
 * Manages process registration, exclusion and status check with Solucionare API V3
 * Now with shared consumption (deduplication) logic:
 * - office_code sourced from partners table
 * - client_system_id links processes to requesting client
 * - Deduplication: only registers with Solucionare if process is new to Hub
 * - Removal: only removes from Solucionare when no clients remain linked
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { RestClient } from '../_shared/rest-client.ts';
import { Logger } from '../_shared/logger.ts';
import { getActiveServices, validateService } from '../_shared/service-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STATUS_CODES: Record<number, string> = {
  2: 'Validando',
  4: 'Cadastrado',
  5: 'Arquivado',
  6: 'Segredo de Justiça',
  7: 'Erro na Validação',
};

async function getOfficeCode(supabase: any, serviceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('partners(office_code)')
    .eq('id', serviceId)
    .single();
  if (error) throw new Error(`Failed to fetch partner: ${error.message}`);
  const officeCode = (data?.partners as any)?.office_code as number | null;
  if (!officeCode) throw new Error('Parceiro não possui código de escritório configurado.');
  return officeCode;
}

async function linkProcessToClient(supabase: any, processId: string, clientSystemId: string): Promise<void> {
  const { error } = await supabase
    .from('client_processes')
    .upsert(
      { client_system_id: clientSystemId, process_id: processId },
      { onConflict: 'client_system_id,process_id' }
    );
  if (error) console.error('Error linking process to client:', error);
}

async function unlinkAndCheck(supabase: any, processId: string, clientSystemId: string): Promise<boolean> {
  await supabase.from('client_processes').delete()
    .eq('client_system_id', clientSystemId).eq('process_id', processId);
  const { count } = await supabase.from('client_processes')
    .select('*', { count: 'exact', head: true }).eq('process_id', processId);
  return (count || 0) === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, serviceId, processNumber, clientSystemId, uf, instance } = body;

    console.log(`Process management action: ${action}`);

    // Get service configuration
    let service;
    if (serviceId) {
      const { data, error } = await supabase
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .eq('service_type', 'processes')
        .eq('is_active', true)
        .single();
      if (error || !data) throw new Error('Service not found or inactive');
      service = data;
    } else {
      const services = await getActiveServices('processes');
      if (services.length === 0) throw new Error('No active process services found');
      service = services[0];
    }

    validateService(service);

    // Get office_code from partners table
    const officeCode = await getOfficeCode(supabase, service.id);

    const client = new RestClient({
      baseUrl: service.service_url,
      nomeRelacional: service.nome_relacional,
      token: service.token,
      authInQuery: true,
    });
    client.setLogger(logger);

    let result;

    switch (action) {
      case 'register': {
        if (!processNumber) throw new Error('processNumber is required');

        await logger.start({ partner_service_id: service.id, sync_type: 'process_register' });

        // DEDUPLICATION: Check if process already exists locally
        const { data: existingProcess } = await supabase
          .from('processes')
          .select('id, cod_processo')
          .eq('process_number', processNumber.trim())
          .maybeSingle();

        let processRecord;
        let registeredInSolucionare = false;

        if (existingProcess) {
          console.log(`Process ${processNumber} already exists locally, skipping Solucionare registration`);
          processRecord = existingProcess;
        } else {
          console.log(`Registering new process with Solucionare: ${processNumber}`);
          const registerData = await client.post('/CadastraNovoProcesso', {
            numProcesso: processNumber.trim(),
            codEscritorio: officeCode,
            UF: uf || '',
            instancia: instance || 0,
          });
          registeredInSolucionare = true;

          const { data: inserted, error: insertError } = await supabase
            .from('processes')
            .upsert({
              process_number: processNumber.trim(),
              partner_service_id: service.id,
              partner_id: service.partner_id,
              cod_escritorio: officeCode,
              cod_processo: registerData?.codProcesso || null,
              status_code: 2,
              status_description: STATUS_CODES[2],
              uf: uf || null,
              instance: instance?.toString() || null,
              raw_data: registerData || {},
              solucionare_status: 'synced',
            }, { onConflict: 'process_number' })
            .select()
            .single();

          if (insertError) throw insertError;
          processRecord = inserted;
        }

        // Link to client
        if (clientSystemId && processRecord?.id) {
          await linkProcessToClient(supabase, processRecord.id, clientSystemId);
        }

        await logger.success(1);
        result = {
          success: true,
          message: registeredInSolucionare ? 'Process registered successfully' : 'Process linked to client (already existed)',
          process: processRecord,
          registeredInSolucionare,
          linkedToClient: !!clientSystemId,
        };
        break;
      }

      case 'delete': {
        if (!processNumber) throw new Error('processNumber is required');

        await logger.start({ partner_service_id: service.id, sync_type: 'process_delete' });

        const { data: existingProcess } = await supabase
          .from('processes')
          .select('id, cod_processo')
          .eq('process_number', processNumber)
          .single();

        if (!existingProcess?.cod_processo) throw new Error('Process not found or missing cod_processo');

        let removedFromSolucionare = false;

        if (clientSystemId) {
          // DEDUPLICATION: Unlink client, only remove from Solucionare if no clients remain
          const noMoreClients = await unlinkAndCheck(supabase, existingProcess.id, clientSystemId);
          
          if (noMoreClients) {
            const deleteData = await client.delete('/ExcluirProcesso', { codProcesso: existingProcess.cod_processo });
            removedFromSolucionare = true;
            await supabase.from('processes').update({
              status_code: 5, status_description: 'Excluído', raw_data: deleteData || {},
            }).eq('id', existingProcess.id);
          }
        } else {
          // Direct removal (no client context)
          const deleteData = await client.delete('/ExcluirProcesso', { codProcesso: existingProcess.cod_processo });
          removedFromSolucionare = true;
          await supabase.from('processes').update({
            status_code: 5, status_description: 'Excluído', raw_data: deleteData || {},
          }).eq('id', existingProcess.id);
        }

        await logger.success(1);
        result = { success: true, removedFromSolucionare };
        break;
      }

      case 'status': {
        if (!processNumber) throw new Error('processNumber is required');

        const { data: existingProcess } = await supabase
          .from('processes')
          .select('id, cod_processo')
          .eq('process_number', processNumber)
          .maybeSingle();

        if (!existingProcess?.cod_processo) throw new Error('Process not found or missing cod_processo');

        const statusData = await client.get('/BuscaStatusProcesso', { codProcesso: existingProcess.cod_processo });

        if (statusData?.codStatus) {
          await supabase.from('processes').update({
            status_code: statusData.codStatus,
            status_description: STATUS_CODES[statusData.codStatus] || statusData.descricaoStatus,
          }).eq('id', existingProcess.id);
        }

        result = { success: true, status: statusData, statusDescription: STATUS_CODES[statusData?.codStatus] || 'Unknown' };
        break;
      }

      case 'list': {
        const params: Record<string, any> = {};
        // Use partner's office code
        params.codEscritorio = officeCode;
        const processesData = await client.get('/BuscaProcessosCadastrados', params);
        result = { success: true, processes: processesData || [], count: Array.isArray(processesData) ? processesData.length : 0 };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Process management error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logger.error(errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
