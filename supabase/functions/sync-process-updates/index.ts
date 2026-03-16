/**
 * Sync Process Updates Edge Function
 * MACRO PROCESSO 2: Andamentos
 * Synchronizes complete process data from Solucionare API V3 for processes with status CADASTRADO:
 * - Groupers (Agrupadores) - via BuscaAgrupadoresPorEscritorio
 * - Dependencies (Dependências) - via BuscaDependenciasPorEscritorio
 * - Movements (Andamentos) - via BuscaNovosAndamentosPorEscritorio
 * - Documents (Documentos) - via BuscaNovosDocumentosPorEscritorio
 * - Covers (Capas) - via BuscaProcessosComCapaAtualizada
 * - Parties (Partes/Polos)
 * - Lawyers (Advogados)
 * 
 * All endpoints use PorEscritorio variants that filter at the API level by codEscritorio.
 * office_code is MANDATORY (sourced from partners table).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { RestClient } from '../_shared/rest-client.ts';
import { Logger } from '../_shared/logger.ts';
import { getActiveServices, updateLastSync, validateService } from '../_shared/service-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { serviceId, syncType = 'full' } = body;

    console.log(`Starting process updates sync (Macro Processo 2 - Andamentos). Type: ${syncType}`);

    // Get services
    let services;
    if (serviceId) {
      const { data, error } = await supabase
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .eq('service_type', 'processes')
        .eq('is_active', true);
      
      if (error || !data?.length) {
        throw new Error('Service not found or inactive');
      }
      services = data;
    } else {
      services = await getActiveServices('processes');
    }

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active process services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        validateService(service);

        // Get partner's office_code - MANDATORY for PorEscritorio endpoints
        const { data: partnerData } = await supabase
          .from('partners')
          .select('office_code')
          .eq('id', service.partner_id)
          .single();
        
        const officeCode = partnerData?.office_code as number | null;
        if (!officeCode) {
          throw new Error('Partner has no office_code configured. office_code is mandatory for PorEscritorio endpoints.');
        }

        console.log(`Using office_code: ${officeCode} for PorEscritorio endpoints`);

        await logger.start({
          partner_service_id: service.id,
          sync_type: `process_updates_${syncType}`,
        });

        // API V3 uses query params for authentication
        const client = new RestClient({
          baseUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
          authInQuery: true,
        });
        client.setLogger(logger);

        let totalSynced = 0;

        // 1. Sync Groupers (Agrupadores) - BuscaAgrupadoresPorEscritorio
        if (syncType === 'full' || syncType === 'groupers') {
          const groupersSynced = await syncGroupers(client, supabase, service, officeCode);
          totalSynced += groupersSynced;
          console.log(`Synced ${groupersSynced} groupers`);
        }

        // 2. Sync Dependencies - BuscaDependenciasPorEscritorio
        if (syncType === 'full' || syncType === 'dependencies') {
          const depsSynced = await syncDependencies(client, supabase, service, officeCode);
          totalSynced += depsSynced;
          console.log(`Synced ${depsSynced} dependencies`);
        }

        // 3. Sync Movements (Andamentos) - BuscaNovosAndamentosPorEscritorio - Loop until no more data
        if (syncType === 'full' || syncType === 'movements') {
          let totalMovements = 0;
          let batchCount = 0;
          const maxBatches = 20;
          
          while (batchCount < maxBatches) {
            const movementsSynced = await syncMovements(client, supabase, service, officeCode);
            totalMovements += movementsSynced;
            batchCount++;
            
            if (movementsSynced === 0 || movementsSynced < 500) {
              break;
            }
            console.log(`Movements batch ${batchCount}: ${movementsSynced} synced`);
          }
          
          totalSynced += totalMovements;
          console.log(`Total synced ${totalMovements} movements in ${batchCount} batches`);
        }

        // 3.1 Sync ALL Movements per Process - BuscaTodosAndamentosPorProcesso
        if (syncType === 'full' || syncType === 'all-movements') {
          const allMovementsSynced = await syncAllMovementsByProcess(client, supabase, service);
          totalSynced += allMovementsSynced;
          console.log(`Synced ${allMovementsSynced} movements via BuscaTodosAndamentosPorProcesso`);
        }

        // 4. Sync Documents - BuscaNovosDocumentosPorEscritorio - Loop until no more data
        if (syncType === 'full' || syncType === 'documents') {
          let totalDocs = 0;
          let batchCount = 0;
          const maxBatches = 20;
          
          while (batchCount < maxBatches) {
            const docsSynced = await syncDocuments(client, supabase, service, officeCode);
            totalDocs += docsSynced;
            batchCount++;
            
            if (docsSynced === 0 || docsSynced < 500) {
              break;
            }
            console.log(`Documents batch ${batchCount}: ${docsSynced} synced`);
          }
          
          totalSynced += totalDocs;
          console.log(`Total synced ${totalDocs} documents in ${batchCount} batches`);
        }

        // 4.1 Sync ALL Documents per Process - BuscaTodosDocumentosPorProcesso
        if (syncType === 'full' || syncType === 'all-documents') {
          const allDocsSynced = await syncAllDocumentsByProcess(client, supabase, service);
          totalSynced += allDocsSynced;
          console.log(`Synced ${allDocsSynced} documents via BuscaTodosDocumentosPorProcesso`);
        }

        // 4.2 Link orphan documents to processes
        if (syncType === 'full' || syncType === 'documents' || syncType === 'all-documents') {
          const linkedDocs = await linkOrphanDocuments(supabase);

          // 4.3 Trigger document download to Storage
          try {
            console.log('Triggering document download to Storage...');
            const downloadResponse = await fetch(`${supabaseUrl}/functions/v1/download-process-documents`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ limit: 50 }),
            });
            const downloadResult = await downloadResponse.json();
            console.log(`Document download result: ${downloadResult.downloaded} downloaded, ${downloadResult.failed} failed`);
          } catch (dlError) {
            console.error('Error triggering document download:', dlError);
          }
          console.log(`Linked ${linkedDocs} orphan documents to processes`);
        }

        // 5. Sync Covers (Capas) with Parties and Lawyers - BuscaProcessosComCapaAtualizada
        if (syncType === 'full' || syncType === 'covers') {
          const coversSynced = await syncCovers(client, supabase, service, officeCode);
          totalSynced += coversSynced;
          console.log(`Synced ${coversSynced} covers`);
        }

        await updateLastSync(service.id);
        await logger.success(totalSynced);

        results.push({
          service: service.service_name,
          success: true,
          recordsSynced: totalSynced,
        });

      } catch (error) {
        console.error(`Error syncing service ${service.service_name}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await logger.error(errorMsg);

        results.push({
          service: service.service_name,
          success: false,
          error: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Sync process updates error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Sync Groupers (Agrupadores)
 * GET /BuscaAgrupadoresPorEscritorio?codEscritorio={code} - returns max 500 unconfirmed groupers filtered by office
 */
async function syncGroupers(client: RestClient, supabase: any, service: any, officeCode: number): Promise<number> {
  try {
    const data = await client.get('/BuscaAgrupadoresPorEscritorio', { codEscritorio: officeCode });
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new groupers found');
      return 0;
    }

    console.log(`Found ${data.length} new groupers (filtered by codEscritorio=${officeCode})`);

    // Step 1: Get unique codProcesso values and create processes in batch
    const uniqueCodProcessos = [...new Set(data.map((g: any) => g.codProcesso).filter(Boolean))];
    
    const processInserts = uniqueCodProcessos.map(codProcesso => {
      const grouper = data.find((g: any) => g.codProcesso === codProcesso);
      return {
        cod_processo: codProcesso,
        cod_escritorio: officeCode,
        process_number: grouper?.numProcesso || grouper?.titulo || `PROC-${codProcesso}`,
        tribunal: grouper?.tribunal || null,
        partner_service_id: service.id,
        partner_id: service.partner_id,
        status_code: 4,
        status_description: 'Cadastrado',
        raw_data: { codProcesso, source: 'grouper_sync' },
      };
    });

    if (processInserts.length > 0) {
      const { error: processError } = await supabase
        .from('processes')
        .upsert(processInserts, { onConflict: 'cod_processo', ignoreDuplicates: true });
      
      if (processError) {
        console.error('Error batch upserting processes:', processError);
      } else {
        console.log(`Batch upserted ${processInserts.length} processes`);
      }
    }

    // Step 2: Get all process IDs in one query
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    // Step 3: Batch upsert groupers
    const grouperInserts = data.map((grouper: any) => ({
      cod_agrupador: grouper.codAgrupador,
      cod_processo: grouper.codProcesso,
      process_id: processMap.get(grouper.codProcesso) || null,
      posicao: grouper.posicao || null,
      titulo: grouper.titulo || null,
      num_processo: grouper.numProcesso || null,
      tribunal: grouper.tribunal || null,
      comarca: grouper.comarca || null,
      vara: grouper.vara || null,
      instancia: grouper.instancia || null,
      data_cadastro: grouper.dataCadastro || null,
      is_confirmed: false,
      raw_data: grouper,
    }));

    const { error: grouperError } = await supabase
      .from('process_groupers')
      .upsert(grouperInserts, { onConflict: 'cod_agrupador,cod_processo' });

    if (grouperError) {
      console.error('Error batch upserting groupers:', grouperError);
      return 0;
    }

    // Confirm receipt if enabled
    const { data: svcData } = await supabase.from('partner_services').select('confirm_receipt').eq('id', service.id).single();
    if (svcData?.confirm_receipt) {
      const grouperIds = data.map((g: any) => g.codAgrupador).filter(Boolean);
      if (grouperIds.length > 0) await confirmReceipt(client, supabase, 'groupers', grouperIds);
    } else {
      console.log(`Skipping confirmation for ${data.length} groupers (confirm_receipt disabled)`);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing groupers:', error);
    return 0;
  }
}

/**
 * Sync Dependencies
 * GET /BuscaDependenciasPorEscritorio?codEscritorio={code} - returns max 500 unconfirmed dependencies filtered by office
 */
async function syncDependencies(client: RestClient, supabase: any, service: any, officeCode: number): Promise<number> {
  try {
    const data = await client.get('/BuscaDependenciasPorEscritorio', { codEscritorio: officeCode });
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new dependencies found');
      return 0;
    }

    console.log(`Found ${data.length} new dependencies (filtered by codEscritorio=${officeCode})`);

    // Step 1: Get unique codProcesso values and create processes in batch
    const uniqueCodProcessos = [...new Set(data.map((d: any) => d.codProcesso).filter(Boolean))];
    
    const processInserts = uniqueCodProcessos.map(codProcesso => {
      const dep = data.find((d: any) => d.codProcesso === codProcesso);
      return {
        cod_processo: codProcesso,
        cod_escritorio: officeCode,
        process_number: dep?.numProcesso || dep?.titulo || `PROC-${codProcesso}`,
        instance: dep?.instancia ? String(dep.instancia) : null,
        partner_service_id: service.id,
        partner_id: service.partner_id,
        status_code: 4,
        status_description: 'Cadastrado',
        raw_data: { codProcesso, source: 'dependency_sync' },
      };
    });

    if (processInserts.length > 0) {
      const { error: processError } = await supabase
        .from('processes')
        .upsert(processInserts, { onConflict: 'cod_processo', ignoreDuplicates: true });
      
      if (processError) {
        console.error('Error batch upserting processes:', processError);
      } else {
        console.log(`Batch upserted ${processInserts.length} processes from dependencies`);
      }
    }

    // Step 2: Get all process IDs in one query
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    // Step 3: Batch upsert dependencies
    const depInserts = data.map((dep: any) => ({
      cod_dependencia: dep.codDependencia,
      cod_processo: dep.codProcesso,
      process_id: processMap.get(dep.codProcesso) || null,
      num_processo: dep.numProcesso || null,
      instancia: dep.instancia || null,
      titulo: dep.titulo || null,
      is_confirmed: false,
      raw_data: dep,
    }));

    const { error: depError } = await supabase
      .from('process_dependencies')
      .upsert(depInserts, { onConflict: 'cod_dependencia,cod_processo' });

    if (depError) {
      console.error('Error batch upserting dependencies:', depError);
      return 0;
    }

    // Confirm receipt if enabled
    const { data: svcData2 } = await supabase.from('partner_services').select('confirm_receipt').eq('id', service.id).single();
    if (svcData2?.confirm_receipt) {
      const depIds = data.map((d: any) => d.codDependencia).filter(Boolean);
      if (depIds.length > 0) await confirmReceipt(client, supabase, 'dependencies', depIds);
    } else {
      console.log(`Skipping confirmation for ${data.length} dependencies (confirm_receipt disabled)`);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing dependencies:', error);
    return 0;
  }
}

/**
 * Sync Movements (Andamentos)
 * GET /BuscaNovosAndamentosPorEscritorio?codEscritorio={code} - returns max 500 unconfirmed movements filtered by office
 */
async function syncMovements(client: RestClient, supabase: any, service: any, officeCode: number): Promise<number> {
  try {
    const data = await client.get('/BuscaNovosAndamentosPorEscritorio', { codEscritorio: officeCode });
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new movements found');
      return 0;
    }

    console.log(`Found ${data.length} new movements (filtered by codEscritorio=${officeCode})`);

    // Get unique codProcesso values
    const uniqueCodProcessos = [...new Set(data.map((m: any) => m.codProcesso).filter(Boolean))];

    // Get all process IDs in one query
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    // Batch upsert movements
    const movementInserts = data.map((mov: any) => ({
      cod_andamento: mov.codAndamento,
      cod_agrupador: mov.codAgrupador || null,
      process_id: processMap.get(mov.codProcesso) || null,
      movement_type: mov.tipoAndamento || null,
      tipo_andamento: mov.tipoAndamento || null,
      movement_date: mov.dataAndamento || null,
      data_andamento: mov.dataAndamento || null,
      description: mov.textoAndamento || null,
      raw_data: mov,
    }));

    const { error: movError } = await supabase
      .from('process_movements')
      .upsert(movementInserts, { onConflict: 'cod_andamento' });

    if (movError) {
      console.error('Error batch upserting movements:', movError);
      return 0;
    }

    // Confirm receipt if enabled
    const { data: svcData3 } = await supabase.from('partner_services').select('confirm_receipt').eq('id', service.id).single();
    if (svcData3?.confirm_receipt) {
      const movIds = data.map((m: any) => m.codAndamento).filter(Boolean);
      if (movIds.length > 0) await confirmReceipt(client, supabase, 'movements', movIds);
    } else {
      console.log(`Skipping confirmation for ${data.length} movements (confirm_receipt disabled)`);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing movements:', error);
    return 0;
  }
}

/**
 * Sync ALL Movements by Process
 * GET /BuscaTodosAndamentosPorProcesso?codProcesso={code} - returns ALL movements for a specific process
 * Iterates over all processes with cod_processo and fetches their complete movement history
 */
async function syncAllMovementsByProcess(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    // Get all processes with cod_processo
    const { data: processes, error: procError } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .not('cod_processo', 'is', null)
      .eq('partner_service_id', service.id);

    if (procError || !processes?.length) {
      console.log('No processes found for all-movements sync');
      return 0;
    }

    console.log(`Fetching all movements for ${processes.length} processes`);
    let totalSynced = 0;

    for (const process of processes) {
      try {
        const data = await client.get('/BuscaTodosAndamentosPorProcesso', {
          codProcesso: process.cod_processo,
        });

        if (!Array.isArray(data) || data.length === 0) {
          continue;
        }

        const movementInserts = data.map((mov: any) => ({
          cod_andamento: mov.codAndamento,
          cod_agrupador: mov.codAgrupador || null,
          process_id: process.id,
          movement_type: mov.tipoAndamento || null,
          tipo_andamento: mov.tipoAndamento || null,
          movement_date: mov.dataAndamento || null,
          data_andamento: mov.dataAndamento || null,
          description: mov.textoAndamento || null,
          raw_data: mov,
        }));

        const { error: movError } = await supabase
          .from('process_movements')
          .upsert(movementInserts, { onConflict: 'cod_andamento' });

        if (movError) {
          console.error(`Error upserting movements for process ${process.cod_processo}:`, movError);
        } else {
          totalSynced += data.length;
          console.log(`Process ${process.cod_processo}: ${data.length} movements`);
        }
      } catch (err) {
        console.error(`Error fetching movements for process ${process.cod_processo}:`, err);
      }
    }

    return totalSynced;
  } catch (error) {
    console.error('Error in syncAllMovementsByProcess:', error);
    return 0;
  }
}

/**
 * Sync ALL Documents by Process
 * GET /BuscaTodosDocumentosPorProcesso?codProcesso={code} - returns ALL documents for a specific process
 * Links documents to movements if codAndamento matches an existing movement, otherwise keeps as loose process documents
 */
async function syncAllDocumentsByProcess(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    // Get all processes with cod_processo
    const { data: processes, error: procError } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .not('cod_processo', 'is', null)
      .eq('partner_service_id', service.id);

    if (procError || !processes?.length) {
      console.log('No processes found for all-documents sync');
      return 0;
    }

    console.log(`Fetching all documents for ${processes.length} processes`);
    let totalSynced = 0;

    for (const process of processes) {
      try {
        const data = await client.get('/BuscaTodosDocumentosPorProcesso', {
          codProcesso: process.cod_processo,
        });

        if (!Array.isArray(data) || data.length === 0) {
          continue;
        }

        // Lookup movement IDs for documents that have codAndamento
        const uniqueCodAndamentos = [...new Set(data.map((d: any) => d.codAndamento).filter(Boolean))];
        let movementMap = new Map<number, string>();

        if (uniqueCodAndamentos.length > 0) {
          const { data: movements } = await supabase
            .from('process_movements')
            .select('id, cod_andamento')
            .in('cod_andamento', uniqueCodAndamentos);
          
          movementMap = new Map((movements || []).map((m: any) => [m.cod_andamento, m.id]));
        }

        const docInserts = data.map((doc: any) => ({
          cod_documento: doc.codDocumento,
          cod_processo: doc.codProcesso,
          cod_andamento: doc.codAndamento || null,
          cod_agrupador: doc.codAgrupador || null,
          process_id: process.id,
          movement_id: doc.codAndamento ? movementMap.get(doc.codAndamento) || null : null,
          documento_url: doc.urlDocumento || null,
          raw_data: doc,
        }));

        const { error: docError } = await supabase
          .from('process_documents')
          .upsert(docInserts, { onConflict: 'cod_documento' });

        if (docError) {
          console.error(`Error upserting documents for process ${process.cod_processo}:`, docError);
        } else {
          totalSynced += data.length;
          console.log(`Process ${process.cod_processo}: ${data.length} documents`);
        }
      } catch (err) {
        console.error(`Error fetching documents for process ${process.cod_processo}:`, err);
      }
    }

    return totalSynced;
  } catch (error) {
    console.error('Error in syncAllDocumentsByProcess:', error);
    return 0;
  }
}

/**
 * Sync Documents
 * GET /BuscaNovosDocumentosPorEscritorio?codEscritorio={code} - returns max 500 unconfirmed documents filtered by office
 */
async function syncDocuments(client: RestClient, supabase: any, service: any, officeCode: number): Promise<number> {
  try {
    const data = await client.get('/BuscaNovosDocumentosPorEscritorio', { codEscritorio: officeCode });
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new documents found');
      return 0;
    }

    console.log(`Found ${data.length} new documents (filtered by codEscritorio=${officeCode})`);

    // Get unique codProcesso and codAndamento values
    const uniqueCodProcessos = [...new Set(data.map((d: any) => d.codProcesso).filter(Boolean))];
    const uniqueCodAndamentos = [...new Set(data.map((d: any) => d.codAndamento).filter(Boolean))];

    // Get all process and movement IDs in batch queries
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    const { data: movements } = await supabase
      .from('process_movements')
      .select('id, cod_andamento')
      .in('cod_andamento', uniqueCodAndamentos);
    
    const movementMap = new Map((movements || []).map((m: any) => [m.cod_andamento, m.id]));

    // Batch upsert documents
    const docInserts = data.map((doc: any) => ({
      cod_documento: doc.codDocumento,
      cod_processo: doc.codProcesso,
      cod_andamento: doc.codAndamento || null,
      cod_agrupador: doc.codAgrupador || null,
      process_id: processMap.get(doc.codProcesso) || null,
      movement_id: doc.codAndamento ? movementMap.get(doc.codAndamento) || null : null,
      tipo_documento: doc.tipoDocumento || null,
      nome_arquivo: doc.nomeArquivo || null,
      documento_url: doc.urlDocumento || null,
      tamanho_bytes: doc.tamanhoBytes || null,
      is_confirmed: false,
      raw_data: doc,
    }));

    const { error: docError } = await supabase
      .from('process_documents')
      .upsert(docInserts, { onConflict: 'cod_documento' });

    if (docError) {
      console.error('Error batch upserting documents:', docError);
      return 0;
    }

    // Confirm receipt if enabled
    const { data: svcData4 } = await supabase.from('partner_services').select('confirm_receipt').eq('id', service.id).single();
    if (svcData4?.confirm_receipt) {
      const docIds = data.map((d: any) => d.codDocumento).filter(Boolean);
      if (docIds.length > 0) await confirmReceipt(client, supabase, 'documents', docIds);
    } else {
      console.log(`Skipping confirmation for ${data.length} documents (confirm_receipt disabled)`);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing documents:', error);
    return 0;
  }
}

/**
 * Link orphan documents to processes and movements
 */
async function linkOrphanDocuments(supabase: any): Promise<number> {
  try {
    const { data: orphanDocs, error: orphanError } = await supabase
      .from('process_documents')
      .select('id, cod_processo, cod_andamento')
      .is('process_id', null)
      .not('cod_processo', 'is', null)
      .limit(1000);

    if (orphanError || !orphanDocs?.length) {
      console.log('No orphan documents to link');
      return 0;
    }

    console.log(`Found ${orphanDocs.length} orphan documents to link`);

    const uniqueCodProcessos = [...new Set(orphanDocs.map((d: any) => d.cod_processo))];
    const uniqueCodAndamentos = [...new Set(orphanDocs.map((d: any) => d.cod_andamento).filter(Boolean))];

    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);

    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    let movementMap = new Map();
    if (uniqueCodAndamentos.length > 0) {
      const { data: movements } = await supabase
        .from('process_movements')
        .select('id, cod_andamento')
        .in('cod_andamento', uniqueCodAndamentos);
      
      movementMap = new Map((movements || []).map((m: any) => [m.cod_andamento, m.id]));
    }

    let linkedCount = 0;
    for (const doc of orphanDocs) {
      const processId = processMap.get(doc.cod_processo);
      const movementId = doc.cod_andamento ? movementMap.get(doc.cod_andamento) : null;

      if (processId) {
        const { error } = await supabase
          .from('process_documents')
          .update({ process_id: processId, movement_id: movementId })
          .eq('id', doc.id);

        if (!error) linkedCount++;
      }
    }

    console.log(`Linked ${linkedCount} documents to processes`);
    return linkedCount;
  } catch (error) {
    console.error('Error linking orphan documents:', error);
    return 0;
  }
}

/**
 * Sync Covers (Capas) with Parties and Lawyers
 * For each CADASTRADO process with cod_processo, call GET /BuscaDadosCapaProcessoPorProcesso?codProcesso=X
 * Returns full cover data including autor, reu, advogados
 */
async function syncCovers(client: RestClient, supabase: any, service: any, officeCode: number): Promise<number> {
  try {
    // Get all local processes with cod_processo that are CADASTRADO (status_code = 4)
    const { data: localProcesses, error: procError } = await supabase
      .from('processes')
      .select('id, cod_processo, process_number')
      .eq('cod_escritorio', officeCode)
      .not('cod_processo', 'is', null);

    if (procError || !localProcesses?.length) {
      console.log('No processes found for cover sync');
      return 0;
    }

    console.log(`Fetching covers for ${localProcesses.length} processes`);

    let synced = 0;

    for (const proc of localProcesses) {
      try {
        const coversData = await client.get('/BuscaDadosCapaProcessoPorProcesso', { codProcesso: proc.cod_processo });

        if (!Array.isArray(coversData) || coversData.length === 0) {
          continue;
        }

        for (const cover of coversData) {
          const codAgrupador = cover.codAgrupador || null;

          // Find or skip grouper
          let grouperId = null;
          if (codAgrupador) {
            const { data: grp } = await supabase
              .from('process_groupers')
              .select('id')
              .eq('cod_agrupador', codAgrupador)
              .maybeSingle();
            grouperId = grp?.id || null;
          }

          let valorCausa = null;
          if (cover.valor) {
            const valorStr = String(cover.valor).replace(/[R$\s.]/g, '').replace(',', '.');
            valorCausa = parseFloat(valorStr) || null;
          }

          const coverInsert = {
            process_id: proc.id,
            grouper_id: grouperId,
            cod_agrupador: codAgrupador,
            cod_processo: cover.codProcesso,
            comarca: cover.comarca || null,
            vara: cover.vara || null,
            tribunal: cover.tribunal || null,
            assunto: cover.assunto || null,
            natureza: cover.natureza || null,
            tipo_acao: cover.tipoAcao || null,
            juiz: cover.juiz || null,
            area: cover.area || null,
            valor_causa: valorCausa,
            data_distribuicao: cover.dataDistribuicao || null,
            digital: cover.digital ?? null,
            link_consulta_processo: cover.linkConsultaProcesso || null,
            sigla_sistema: cover.siglaSistema || null,
            nome_sistema: cover.nomeSistema || null,
            cod_sistema: cover.codSistema || null,
            raw_data: cover,
          };

          const { error: coverError } = await supabase
            .from('process_covers')
            .upsert(coverInsert, { onConflict: 'process_id,cod_agrupador' });

          if (coverError) {
            console.error(`Error upserting cover for process ${proc.cod_processo}:`, coverError);
            continue;
          }

          // Parties: autor + reu + outrosEnvolvidos
          const allParties = [
            ...(Array.isArray(cover.autor) ? cover.autor : []),
            ...(Array.isArray(cover.reu) ? cover.reu : []),
            ...(Array.isArray(cover.outrosEnvolvidos) ? cover.outrosEnvolvidos : []),
          ];

          for (const polo of allParties) {
            if (!polo.nome) continue;
            await supabase
              .from('process_parties')
              .upsert({
                process_id: proc.id,
                cod_processo_polo: polo.codProcessoPolo || null,
                cod_agrupador: polo.codAgrupador || codAgrupador || null,
                tipo_polo: polo.tipoPolo || (polo.descricaoTipoPolo === 'Ativo' ? 1 : 2),
                nome: polo.nome,
                cpf: polo.cpf || null,
                cnpj: polo.cnpj || null,
                tipo_pessoa: polo.tipoPessoa || null,
                raw_data: polo,
              }, { onConflict: 'process_id,nome,tipo_polo', ignoreDuplicates: true });
          }

          // Lawyers
          if (Array.isArray(cover.advogadoProcesso)) {
            for (const adv of cover.advogadoProcesso) {
              if (!adv.nome) continue;
              await supabase
                .from('process_lawyers')
                .upsert({
                  process_id: proc.id,
                  cod_processo_polo: adv.codProcessoPolo || null,
                  cod_agrupador: adv.codAgrupador || codAgrupador || null,
                  nome_advogado: adv.nome,
                  num_oab: adv.oab || null,
                  raw_data: adv,
                }, { onConflict: 'process_id,cod_processo_polo,nome_advogado', ignoreDuplicates: true });
            }
          }

          synced++;
        }

        // Update last_cover_sync_at
        await supabase
          .from('processes')
          .update({ last_cover_sync_at: new Date().toISOString() })
          .eq('id', proc.id);

      } catch (coverErr) {
        console.error(`Error fetching cover for codProcesso ${proc.cod_processo}:`, coverErr);
      }
    }

    console.log(`Synced ${synced} covers`);
    return synced;
  } catch (error) {
    console.error('Error syncing covers:', error);
    return 0;
  }
}

/**
 * Confirm receipt of synced items
 * Controlled by partner_services.confirm_receipt flag
 */
async function confirmReceipt(client: RestClient, supabase: any, type: string, ids: number[]): Promise<void> {
  try {
    const endpoints: Record<string, string> = {
      groupers: '/ConfirmaRecebimentoAgrupador',
      dependencies: '/ConfirmaRecebimentoDependencia',
      movements: '/ConfirmaRecebimentoAndamento',
      documents: '/ConfirmaRecebimentoDocumento',
    };

    const confirmPropertyNames: Record<string, string> = {
      groupers: 'codAgrupador',
      dependencies: 'codDependencia',
      movements: 'codAndamento',
      documents: 'codDocumento',
    };

    const endpoint = endpoints[type];
    const propName = confirmPropertyNames[type];
    if (!endpoint || !propName) return;

    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const confirmArray = batch.map(id => ({ [propName]: id }));
      await client.post(endpoint, confirmArray);
    }

    const tables: Record<string, string> = {
      groupers: 'process_groupers',
      dependencies: 'process_dependencies',
      movements: 'process_movements',
      documents: 'process_documents',
    };

    const idColumns: Record<string, string> = {
      groupers: 'cod_agrupador',
      dependencies: 'cod_dependencia',
      movements: 'cod_andamento',
      documents: 'cod_documento',
    };

    const table = tables[type];
    const idColumn = idColumns[type];
    
    if (table && idColumn) {
      await supabase
        .from(table)
        .update({ is_confirmed: true })
        .in(idColumn, ids);
    }

    console.log(`Confirmed ${ids.length} ${type}`);
  } catch (error) {
    console.error(`Error confirming ${type}:`, error);
  }
}
