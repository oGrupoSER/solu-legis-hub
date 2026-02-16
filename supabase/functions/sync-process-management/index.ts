/**
 * Sync Process Management Edge Function
 * MACRO PROCESSO 1: Processos CNJ (Cadastro e Validação)
 * 
 * Manages process registration, exclusion, status check, and sync with Solucionare API V3.
 * Actions: register, delete, status, list, sync
 * 
 * The 'sync' action calls BuscaProcessos (endpoint 17) to fetch all registered processes
 * from Solucionare filtered by codEscritorio, then updates local database.
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

const STATUS_STRING_TO_CODE: Record<string, number> = {
  'VALIDANDO': 2,
  'CADASTRADO': 4,
  'ARQUIVADO': 5,
  'SEGREDO DE JUSTICA': 6,
  'SEGREDO DE JUSTIÇA': 6,
  'ERRO': 7,
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
          const noMoreClients = await unlinkAndCheck(supabase, existingProcess.id, clientSystemId);
          
          if (noMoreClients) {
            const deleteData = await client.delete('/ExcluirProcesso', { codProcesso: existingProcess.cod_processo });
            removedFromSolucionare = true;
            await supabase.from('processes').update({
              status_code: 5, status_description: 'Excluído', raw_data: deleteData || {},
            }).eq('id', existingProcess.id);
          }
        } else {
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
        params.codEscritorio = officeCode;
        const processesData = await client.get('/BuscaProcessosCadastrados', params);
        result = { success: true, processes: processesData || [], count: Array.isArray(processesData) ? processesData.length : 0 };
        break;
      }

      case 'sync': {
        // MACRO PROCESSO 1: Sync all processes from Solucionare for this office
        await logger.start({ partner_service_id: service.id, sync_type: 'process_sync' });

        console.log(`Syncing processes for codEscritorio=${officeCode} via BuscaProcessos`);

        const processesData = await client.get('/BuscaProcessos', { codEscritorio: officeCode });

        if (!Array.isArray(processesData) || processesData.length === 0) {
          console.log('No processes returned from BuscaProcessos');
          await logger.success(0);
          result = { success: true, message: 'No processes found for this office', synced: 0 };
          break;
        }

        console.log(`BuscaProcessos returned ${processesData.length} raw records`);

        // Filter by office code (API may return all offices) and deduplicate by process_number
        const filtered = processesData.filter((p: any) => p.codEscritorio === officeCode);
        console.log(`Filtered to ${filtered.length} processes for codEscritorio=${officeCode} (from ${processesData.length} total)`);

        const processMap = new Map<string, any>();
        for (const proc of filtered) {
          const pn = proc.numProcesso || proc.numCNJ || null;
          if (!pn) continue;
          const existing = processMap.get(pn);
          const currentStatus = proc.codStatus || proc.statusCode || 2;
          if (!existing || currentStatus > (existing.codStatus || existing.statusCode || 2)) {
            processMap.set(pn, proc);
          }
        }

        console.log(`After deduplication: ${processMap.size} unique processes`);

        let synced = 0;

        for (const [processNumber, proc] of processMap) {
          const statusString = (proc.status || '').toUpperCase();
          const statusCode = proc.codStatus || proc.statusCode || STATUS_STRING_TO_CODE[statusString] || 2;
          const codProcesso = proc.codProcesso || null;

          const upsertData: any = {
            process_number: processNumber,
            partner_service_id: service.id,
            partner_id: service.partner_id,
            cod_escritorio: officeCode,
            cod_processo: codProcesso,
            status_code: statusCode,
            status_description: STATUS_CODES[statusCode] || proc.descricaoStatus || 'Desconhecido',
            solucionare_status: 'synced',
            raw_data: proc,
            updated_at: new Date().toISOString(),
          };

          if (proc.tribunal) upsertData.tribunal = proc.tribunal;
          if (proc.uf) upsertData.uf = proc.uf;
          if (proc.instancia) upsertData.instance = String(proc.instancia);

          const { error } = await supabase
            .from('processes')
            .upsert(upsertData, { onConflict: 'process_number' });

          if (error) {
            console.error(`Error upserting process ${processNumber} (cod=${codProcesso}):`, error);
          } else {
            synced++;
          }
        }

        await logger.success(synced);
        result = {
          success: true,
          message: `Synced ${synced} processes from Solucionare`,
          synced,
          total: processesData.length,
          uniqueProcesses: processMap.size,
        };
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
