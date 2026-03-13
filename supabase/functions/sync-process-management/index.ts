/**
 * Sync Process Management Edge Function
 * MACRO PROCESSO 1: Processos CNJ (Cadastro e Validação)
 * 
 * Each CNJ process is registered 3 times (instances 1, 2, 3).
 * Actions: register, delete, status, list, sync, send-pending
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

const INSTANCES = [1, 2, 3];

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, serviceId, processNumber, clientSystemId } = body;

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

        // Check if all 3 instances already exist
        const { data: existingProcesses } = await supabase
          .from('processes')
          .select('id, instance, cod_processo')
          .eq('process_number', processNumber.trim());

        const existingInstances = new Set(
          (existingProcesses || []).map((p: any) => String(p.instance))
        );

        let registered = 0;
        const errors: string[] = [];
        const processIds: string[] = (existingProcesses || []).map((p: any) => p.id);

        for (const inst of INSTANCES) {
          if (existingInstances.has(String(inst))) {
            console.log(`Instance ${inst} already exists for ${processNumber}, skipping`);
            continue;
          }

          try {
            console.log(`Registering ${processNumber} instance ${inst}`);
            const registerBody = {
              numProcesso: processNumber.trim(),
              codEscritorio: officeCode,
              Instancia: inst,
            };

            const registerData = await client.post('/CadastraNovoProcesso', registerBody);

            const { data: inserted, error: insertError } = await supabase
              .from('processes')
              .insert({
                process_number: processNumber.trim(),
                partner_service_id: service.id,
                partner_id: service.partner_id,
                cod_escritorio: officeCode,
                cod_processo: registerData?.codProcesso || null,
                status_code: 2,
                status_description: STATUS_CODES[2],
                instance: String(inst),
                raw_data: registerData || {},
                solucionare_status: 'synced',
              })
              .select()
              .single();

            if (insertError) {
              console.error(`Error inserting instance ${inst}:`, insertError);
              errors.push(`Instância ${inst}: ${insertError.message}`);
            } else {
              processIds.push(inserted.id);
              registered++;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Error registering instance ${inst}:`, msg);
            errors.push(`Instância ${inst}: ${msg}`);
          }
        }

        // Link all process records to client
        if (clientSystemId) {
          for (const pid of processIds) {
            await linkProcessToClient(supabase, pid, clientSystemId);
          }
        }

        await logger.success(registered);
        result = {
          success: true,
          message: `Registered ${registered} instances`,
          registered,
          errors: errors.length > 0 ? errors : undefined,
        };
        break;
      }

      case 'delete': {
        if (!processNumber) throw new Error('processNumber is required');

        await logger.start({ partner_service_id: service.id, sync_type: 'process_delete' });

        // Find all instances of this process
        const { data: allInstances } = await supabase
          .from('processes')
          .select('id, cod_processo, instance, cod_escritorio')
          .eq('process_number', processNumber);

        if (!allInstances || allInstances.length === 0) {
          throw new Error('Process not found');
        }

        let deleted = 0;
        const errors: string[] = [];

        for (const proc of allInstances) {
          try {
            // Delete from Solucionare via POST with query params
            if (proc.cod_processo) {
              await client.post('/ExcluirProcesso', null, {
                codProcesso: proc.cod_processo,
                codEscritorio: proc.cod_escritorio || officeCode,
              });
            }

            // Delete all dependent records in order
            await supabase.from('process_documents').delete().eq('process_id', proc.id);
            await supabase.from('process_movements').delete().eq('process_id', proc.id);
            await supabase.from('process_lawyers').delete().eq('process_id', proc.id);
            await supabase.from('process_parties').delete().eq('process_id', proc.id);
            await supabase.from('process_covers').delete().eq('process_id', proc.id);
            await supabase.from('process_groupers').delete().eq('process_id', proc.id);
            await supabase.from('process_dependencies').delete().eq('process_id', proc.id);
            await supabase.from('client_processes').delete().eq('process_id', proc.id);

            // Delete the process record
            await supabase.from('processes').delete().eq('id', proc.id);
            deleted++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Error deleting instance ${proc.instance}:`, msg);
            errors.push(`Instância ${proc.instance}: ${msg}`);
          }
        }

        await logger.success(deleted);
        result = { success: true, deleted, errors: errors.length > 0 ? errors : undefined };
        break;
      }

      case 'status': {
        if (!processNumber) throw new Error('processNumber is required');

        const { data: allInstances } = await supabase
          .from('processes')
          .select('id, cod_processo, instance')
          .eq('process_number', processNumber);

        if (!allInstances || allInstances.length === 0) throw new Error('Process not found');

        const statuses: any[] = [];
        for (const proc of allInstances) {
          if (!proc.cod_processo) continue;
          try {
            const statusData = await client.get('/BuscaStatusProcesso', { codProcesso: proc.cod_processo });
            if (statusData?.codStatus) {
              await supabase.from('processes').update({
                status_code: statusData.codStatus,
                status_description: STATUS_CODES[statusData.codStatus] || statusData.descricaoStatus,
                cod_classificacao_status: statusData.codClassificacaoStatus || null,
                descricao_classificacao_status: statusData.descricaoClassificacaoStatus || null,
              }).eq('id', proc.id);
            }
            statuses.push({ instance: proc.instance, ...statusData });
          } catch (err) {
            console.error(`Error checking status for instance ${proc.instance}:`, err);
          }
        }

        result = { success: true, statuses };
        break;
      }

      case 'list': {
        const processesData = await client.get('/BuscaProcessosCadastrados', { codEscritorio: officeCode });
        result = { success: true, processes: processesData || [], count: Array.isArray(processesData) ? processesData.length : 0 };
        break;
      }

      case 'send-pending': {
        await logger.start({ partner_service_id: service.id, sync_type: 'process_send_pending' });

        const { data: pendingProcesses } = await supabase
          .from('processes')
          .select('id, process_number, instance, cod_escritorio, raw_data')
          .eq('solucionare_status', 'pending')
          .eq('partner_service_id', service.id);

        let sent = 0;
        const errors: string[] = [];

        if (pendingProcesses && pendingProcesses.length > 0) {
          console.log(`Sending ${pendingProcesses.length} pending processes`);
          for (const proc of pendingProcesses) {
            try {
              const registerBody = {
                numProcesso: proc.process_number,
                codEscritorio: officeCode,
                Instancia: parseInt(proc.instance || '1') || 1,
              };

              const registerData = await client.post('/CadastraNovoProcesso', registerBody);

              await supabase.from('processes').update({
                cod_processo: registerData?.codProcesso || null,
                status_code: 2,
                status_description: STATUS_CODES[2],
                solucionare_status: 'synced',
                raw_data: { ...(proc.raw_data as any || {}), ...(registerData || {}) },
                updated_at: new Date().toISOString(),
              }).eq('id', proc.id);

              sent++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              console.error(`Error sending ${proc.process_number} inst ${proc.instance}:`, msg);
              errors.push(`${proc.process_number} (inst ${proc.instance}): ${msg}`);
              await supabase.from('processes').update({
                solucionare_status: 'error',
                updated_at: new Date().toISOString(),
              }).eq('id', proc.id);
            }
          }
        }

        await logger.success(sent);
        result = { success: true, sent, total: pendingProcesses?.length || 0, errors: errors.length > 0 ? errors : undefined };
        break;
      }

      case 'sync': {
        await logger.start({ partner_service_id: service.id, sync_type: 'process_sync' });
        console.log(`Syncing processes for codEscritorio=${officeCode}`);

        // Step 1: Check status for each local process with cod_processo
        const { data: localProcesses } = await supabase
          .from('processes')
          .select('id, cod_processo, instance, process_number')
          .eq('partner_service_id', service.id)
          .not('cod_processo', 'is', null);

        let statusUpdated = 0;
        if (localProcesses && localProcesses.length > 0) {
          console.log(`Checking status for ${localProcesses.length} local processes`);
          for (const proc of localProcesses) {
            try {
              const statusData = await client.get('/BuscaStatusProcesso', { codProcesso: proc.cod_processo });
              if (statusData) {
                const statusString = (statusData.status || '').toUpperCase();
                const statusCode = statusData.codStatus || STATUS_STRING_TO_CODE[statusString] || 2;
                await supabase.from('processes').update({
                  status_code: statusCode,
                  status_description: STATUS_CODES[statusCode] || statusData.descricaoStatus || statusData.status || 'Desconhecido',
                  cod_classificacao_status: statusData.codClassificacaoStatus || null,
                  descricao_classificacao_status: statusData.descricaoClassificacaoStatus || null,
                  updated_at: new Date().toISOString(),
                }).eq('id', proc.id);
                statusUpdated++;
              }
            } catch (err) {
              console.error(`Error checking status for ${proc.process_number} inst ${proc.instance}:`, err);
            }
          }
        }

        // Step 2: Fetch all processes via BuscaProcessos
        const processesData = await client.get('/BuscaProcessos', { codEscritorio: officeCode });

        let synced = 0;
        if (Array.isArray(processesData) && processesData.length > 0) {
          console.log(`BuscaProcessos returned ${processesData.length} records`);

          const filtered = processesData.filter((p: any) => p.codEscritorio === officeCode);

          for (const proc of filtered) {
            const pn = proc.numProcesso || proc.numCNJ || null;
            if (!pn) continue;

            const inst = proc.instancia ? String(proc.instancia) : '1';
            const statusString = (proc.status || '').toUpperCase();
            const statusCode = proc.codStatus || proc.statusCode || STATUS_STRING_TO_CODE[statusString] || 2;

            const upsertData: any = {
              process_number: pn,
              instance: inst,
              partner_service_id: service.id,
              partner_id: service.partner_id,
              cod_escritorio: officeCode,
              cod_processo: proc.codProcesso || null,
              status_code: statusCode,
              status_description: STATUS_CODES[statusCode] || proc.descricaoStatus || proc.status || 'Desconhecido',
              solucionare_status: 'synced',
              raw_data: proc,
              updated_at: new Date().toISOString(),
              uf: proc.UF || proc.uf || null,
              data_cadastro: proc.dataCadastro || null,
              cod_classificacao_status: proc.codClassificacaoStatus || null,
              descricao_classificacao_status: proc.descricaoClassificacaoStatus || null,
            };

            const { error } = await supabase
              .from('processes')
              .upsert(upsertData, { onConflict: 'process_number,instance' });

            if (error) {
              console.error(`Error upserting ${pn} inst ${inst}:`, error);
            } else {
              synced++;
            }
          }
        }

        await logger.success(synced);
        result = {
          success: true,
          message: `Status checked: ${statusUpdated}, synced: ${synced}`,
          synced,
          statusUpdated,
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
