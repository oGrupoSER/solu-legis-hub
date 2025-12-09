/**
 * Sync Process Updates Edge Function
 * Synchronizes complete process data from Solucionare API V3:
 * - Groupers (Agrupadores)
 * - Dependencies (Dependências)
 * - Movements (Andamentos)
 * - Documents (Documentos)
 * - Covers (Capas)
 * - Parties (Partes/Polos)
 * - Lawyers (Advogados)
 * 
 * API V3 uses query params for authentication (nomeRelacional + token)
 * All BuscaNovos* endpoints return max 500 items and require confirmation via ConfirmaRecebimento*
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

    console.log(`Starting process updates sync. Type: ${syncType}`);

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

        await logger.start({
          partner_service_id: service.id,
          sync_type: `process_updates_${syncType}`,
        });

        // API V3 uses query params for authentication
        const client = new RestClient({
          baseUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
          authInQuery: true, // API V3 requires auth via query params
        });

        let totalSynced = 0;

        // 1. Sync Groupers (Agrupadores)
        if (syncType === 'full' || syncType === 'groupers') {
          const groupersSynced = await syncGroupers(client, supabase, service);
          totalSynced += groupersSynced;
          console.log(`Synced ${groupersSynced} groupers`);
        }

        // 2. Sync Dependencies
        if (syncType === 'full' || syncType === 'dependencies') {
          const depsSynced = await syncDependencies(client, supabase, service);
          totalSynced += depsSynced;
          console.log(`Synced ${depsSynced} dependencies`);
        }

        // 3. Sync Movements (Andamentos) - Loop until no more data
        if (syncType === 'full' || syncType === 'movements') {
          let totalMovements = 0;
          let batchCount = 0;
          const maxBatches = 20; // Safety limit
          
          while (batchCount < maxBatches) {
            const movementsSynced = await syncMovements(client, supabase, service);
            totalMovements += movementsSynced;
            batchCount++;
            
            if (movementsSynced === 0 || movementsSynced < 500) {
              break; // No more data or last batch
            }
            console.log(`Movements batch ${batchCount}: ${movementsSynced} synced`);
          }
          
          totalSynced += totalMovements;
          console.log(`Total synced ${totalMovements} movements in ${batchCount} batches`);
        }

        // 4. Sync Documents - Loop until no more data
        if (syncType === 'full' || syncType === 'documents') {
          let totalDocs = 0;
          let batchCount = 0;
          const maxBatches = 20; // Safety limit
          
          while (batchCount < maxBatches) {
            const docsSynced = await syncDocuments(client, supabase, service);
            totalDocs += docsSynced;
            batchCount++;
            
            if (docsSynced === 0 || docsSynced < 500) {
              break; // No more data or last batch
            }
            console.log(`Documents batch ${batchCount}: ${docsSynced} synced`);
          }
          
          totalSynced += totalDocs;
          console.log(`Total synced ${totalDocs} documents in ${batchCount} batches`);
        }

        // 4.1 Link orphan documents to processes
        if (syncType === 'full' || syncType === 'documents') {
          const linkedDocs = await linkOrphanDocuments(supabase);
          console.log(`Linked ${linkedDocs} orphan documents to processes`);
        }

        // 5. Sync Covers (Capas) with Parties and Lawyers
        if (syncType === 'full' || syncType === 'covers') {
          const coversSynced = await syncCovers(client, supabase, service);
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
 * GET /BuscaNovosAgrupadores - returns max 500 unconfirmed groupers
 * POST /ConfirmaRecebimentoAgrupador - confirms receipt
 */
async function syncGroupers(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    const data = await client.get('/BuscaNovosAgrupadores');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new groupers found');
      return 0;
    }

    console.log(`Found ${data.length} new groupers`);

    // Step 1: Get unique codProcesso values and create processes in batch
    const uniqueCodProcessos = [...new Set(data.map((g: any) => g.codProcesso).filter(Boolean))];
    
    // Batch upsert all processes first
    const processInserts = uniqueCodProcessos.map(codProcesso => {
      const grouper = data.find((g: any) => g.codProcesso === codProcesso);
      return {
        cod_processo: codProcesso,
        cod_escritorio: grouper?.codEscritorio || null,
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

    // Step 4: Confirm receipt
    const confirmIds = data.map((g: any) => g.codAgrupador);
    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'groupers', confirmIds);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing groupers:', error);
    return 0;
  }
}

/**
 * Sync Dependencies
 * GET /BuscaNovasDependencias - returns max 500 unconfirmed dependencies
 * POST /ConfirmaRecebimentoDependencia - confirms receipt
 */
async function syncDependencies(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    const data = await client.get('/BuscaNovasDependencias');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new dependencies found');
      return 0;
    }

    console.log(`Found ${data.length} new dependencies`);

    // Step 1: Get unique codProcesso values and create processes in batch
    const uniqueCodProcessos = [...new Set(data.map((d: any) => d.codProcesso).filter(Boolean))];
    
    // Batch upsert all processes first
    const processInserts = uniqueCodProcessos.map(codProcesso => {
      const dep = data.find((d: any) => d.codProcesso === codProcesso);
      return {
        cod_processo: codProcesso,
        cod_escritorio: dep?.codEscritorio || null,
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

    // Step 4: Confirm receipt
    const confirmIds = data.map((d: any) => d.codDependencia);
    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'dependencies', confirmIds);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing dependencies:', error);
    return 0;
  }
}

/**
 * Sync Movements (Andamentos)
 * GET /BuscaNovosAndamentos - returns max 500 unconfirmed movements
 * POST /ConfirmaRecebimentoAndamento - confirms receipt
 */
async function syncMovements(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    const data = await client.get('/BuscaNovosAndamentos');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new movements found');
      return 0;
    }

    console.log(`Found ${data.length} new movements`);

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
      description: mov.descricao || null,
      raw_data: mov,
    }));

    const { error: movError } = await supabase
      .from('process_movements')
      .upsert(movementInserts, { onConflict: 'cod_andamento' });

    if (movError) {
      console.error('Error batch upserting movements:', movError);
      return 0;
    }

    // Confirm receipt
    const confirmIds = data.map((m: any) => m.codAndamento);
    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'movements', confirmIds);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing movements:', error);
    return 0;
  }
}

/**
 * Sync Documents
 * GET /BuscaNovosDocumentos - returns max 500 unconfirmed documents
 * POST /ConfirmaRecebimentoDocumento - confirms receipt
 */
async function syncDocuments(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    const data = await client.get('/BuscaNovosDocumentos');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No new documents found');
      return 0;
    }

    console.log(`Found ${data.length} new documents`);

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

    // Confirm receipt
    const confirmIds = data.map((d: any) => d.codDocumento);
    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'documents', confirmIds);
    }

    return data.length;
  } catch (error) {
    console.error('Error syncing documents:', error);
    return 0;
  }
}

/**
 * Link orphan documents to processes and movements
 * Updates documents that have cod_processo but no process_id
 */
async function linkOrphanDocuments(supabase: any): Promise<number> {
  try {
    // Get orphan documents (have cod_processo but no process_id)
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

    // Get unique codProcesso values
    const uniqueCodProcessos = [...new Set(orphanDocs.map((d: any) => d.cod_processo))];
    const uniqueCodAndamentos = [...new Set(orphanDocs.map((d: any) => d.cod_andamento).filter(Boolean))];

    // Get process mappings
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);

    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    // Get movement mappings if any
    let movementMap = new Map();
    if (uniqueCodAndamentos.length > 0) {
      const { data: movements } = await supabase
        .from('process_movements')
        .select('id, cod_andamento')
        .in('cod_andamento', uniqueCodAndamentos);
      
      movementMap = new Map((movements || []).map((m: any) => [m.cod_andamento, m.id]));
    }

    // Update documents in batches
    let linkedCount = 0;
    for (const doc of orphanDocs) {
      const processId = processMap.get(doc.cod_processo);
      const movementId = doc.cod_andamento ? movementMap.get(doc.cod_andamento) : null;

      if (processId) {
        const { error } = await supabase
          .from('process_documents')
          .update({ 
            process_id: processId,
            movement_id: movementId
          })
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
 * GET /BuscaProcessosComCapaAtualizada - returns list of codProcesso with updated covers
 * POST /BuscaDadosCapaEStatusVariosProcessos - gets cover details for multiple processes
 * POST /ConfirmaRecebimentoProcessosComCapaAtualizada - confirms receipt
 */
async function syncCovers(client: RestClient, supabase: any, service: any): Promise<number> {
  try {
    // First get processes with updated covers
    const processesWithUpdates = await client.get('/BuscaProcessosComCapaAtualizada');
    
    if (!Array.isArray(processesWithUpdates) || processesWithUpdates.length === 0) {
      console.log('No processes with updated covers found');
      return 0;
    }

    console.log(`Found ${processesWithUpdates.length} processes with updated covers`);

    // Create a map from codProcesso to codProcessoCapaAtualizada for confirmation
    const confirmationMap = new Map<number, number>();
    for (const p of processesWithUpdates) {
      if (p.codProcesso && p.codProcessoCapaAtualizada) {
        confirmationMap.set(p.codProcesso, p.codProcessoCapaAtualizada);
      }
    }

    // Get cover details for these processes
    const codProcessos = processesWithUpdates.map((p: any) => p.codProcesso || p).filter(Boolean);
    
    if (codProcessos.length === 0) return 0;

    // POST /BuscaDadosCapaEStatusVariosProcessos expects array of codProcesso directly
    const coversData = await client.post('/BuscaDadosCapaEStatusVariosProcessos', codProcessos);

    if (!Array.isArray(coversData) || coversData.length === 0) {
      console.log('No cover data returned');
      return 0;
    }

    console.log(`Got cover data for ${coversData.length} processes`);

    // Get all process IDs and grouper IDs in batch
    const uniqueCodProcessos = [...new Set(coversData.map((c: any) => c.codProcesso).filter(Boolean))];
    const uniqueCodAgrupadores = [...new Set(coversData.map((c: any) => c.codAgrupador).filter(Boolean))];

    // First, auto-create any processes that don't exist yet
    const { data: existingProcesses } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const existingCodProcessos = new Set((existingProcesses || []).map((p: any) => p.cod_processo));
    const missingCodProcessos = uniqueCodProcessos.filter(cp => !existingCodProcessos.has(cp));

    if (missingCodProcessos.length > 0) {
      console.log(`Auto-creating ${missingCodProcessos.length} missing processes from covers`);
      
      // Insert each missing process one by one to handle errors gracefully
      for (const codProcesso of missingCodProcessos) {
        const cover = coversData.find((c: any) => c.codProcesso === codProcesso);
        const processNumber = cover?.numProcesso || `unknown-${codProcesso}`;
        
        // Try to update existing process by cod_processo first
        const { data: existingByCod } = await supabase
          .from('processes')
          .select('id')
          .eq('cod_processo', codProcesso)
          .single();
        
        if (existingByCod) {
          console.log(`Process already exists for cod_processo: ${codProcesso}`);
          continue;
        }
        
        // Insert new process
        const { error: insertError } = await supabase
          .from('processes')
          .insert({
            process_number: processNumber,
            cod_processo: codProcesso,
            cod_escritorio: cover?.codEscritorio || null,
            partner_service_id: service.id,
            partner_id: service.partner_id,
            status_code: 4,
            status_description: 'Cadastrado',
            raw_data: { source: 'cover_sync', codProcesso },
          });
        
        if (insertError) {
          // If process_number already exists, try to update it with cod_processo
          if (insertError.code === '23505') {
            console.log(`Process number ${processNumber} already exists, updating cod_processo`);
            const { error: updateError } = await supabase
              .from('processes')
              .update({ 
                cod_processo: codProcesso,
                cod_escritorio: cover?.codEscritorio || null,
              })
              .eq('process_number', processNumber)
              .is('cod_processo', null);
            
            if (updateError) {
              console.error(`Error updating process ${processNumber}:`, updateError);
            }
          } else {
            console.error(`Error inserting process ${processNumber}:`, insertError);
          }
        }
      }
    }

    // Re-fetch processes after auto-creation
    const { data: processes } = await supabase
      .from('processes')
      .select('id, cod_processo')
      .in('cod_processo', uniqueCodProcessos);
    
    const processMap = new Map((processes || []).map((p: any) => [p.cod_processo, p.id]));

    const { data: groupers } = await supabase
      .from('process_groupers')
      .select('id, cod_agrupador')
      .in('cod_agrupador', uniqueCodAgrupadores);
    
    const grouperMap = new Map((groupers || []).map((g: any) => [g.cod_agrupador, g.id]));


    let synced = 0;
    const confirmIds: number[] = [];
    const coverInserts: any[] = [];
    const partyInserts: any[] = [];
    const lawyerInserts: any[] = [];
    const processUpdates: any[] = [];

    for (const cover of coversData) {
      const processId = processMap.get(cover.codProcesso);
      if (!processId) {
        console.log(`Process not found for codProcesso: ${cover.codProcesso}`);
        continue;
      }

      // Extract cover data from dadosCapa array (API returns nested structure)
      const dadosCapa = Array.isArray(cover.dadosCapa) && cover.dadosCapa.length > 0 
        ? cover.dadosCapa[0] 
        : {};
      
      const codAgrupador = dadosCapa.codAgrupador || cover.codAgrupador || null;
      const grouperId = codAgrupador ? grouperMap.get(codAgrupador) || null : null;

      // Parse valor from string like "R$ 5.000,00" to number
      let valorCausa = null;
      if (dadosCapa.valor) {
        const valorStr = dadosCapa.valor.replace(/[R$\s.]/g, '').replace(',', '.');
        valorCausa = parseFloat(valorStr) || null;
      }

      // Prepare cover insert with data extracted from dadosCapa
      coverInserts.push({
        process_id: processId,
        grouper_id: grouperId,
        cod_agrupador: codAgrupador,
        cod_processo: cover.codProcesso,
        comarca: dadosCapa.comarca || null,
        vara: dadosCapa.vara || null,
        tribunal: dadosCapa.tribunal || cover.nomeSistema || null,
        assunto: dadosCapa.assunto || null,
        natureza: dadosCapa.natureza || null,
        tipo_acao: dadosCapa.tipoAcao || null,
        classe: dadosCapa.classe || null,
        juiz: dadosCapa.juiz || null,
        situacao: cover.status || dadosCapa.situacao || null,
        area: dadosCapa.area || null,
        valor_causa: valorCausa,
        data_distribuicao: dadosCapa.dataDistribuicao || null,
        data_atualizacao: dadosCapa.dataRecebimento || cover.dataUltimaConsultaProcesso || null,
        raw_data: cover,
      });

      // Use codProcessoCapaAtualizada for confirmation if available
      const confirmId = confirmationMap.get(cover.codProcesso);
      if (confirmId) {
        confirmIds.push(confirmId);
      }
      synced++;

      // Collect parties from autor and reu arrays (API structure)
      const allParties = [
        ...(Array.isArray(cover.autor) ? cover.autor : []),
        ...(Array.isArray(cover.reu) ? cover.reu : []),
        ...(Array.isArray(cover.outrosEnvolvidos) ? cover.outrosEnvolvidos : []),
      ];
      
      for (const polo of allParties) {
        if (!polo.nome) continue;
        partyInserts.push({
          process_id: processId,
          cod_processo_polo: polo.codProcessoPolo || null,
          cod_agrupador: polo.codAgrupador || codAgrupador || null,
          tipo_polo: polo.tipoPolo || (polo.descricaoTipoPolo === 'Ativo' ? 1 : 2),
          nome: polo.nome,
          cpf: polo.cpf || null,
          cnpj: polo.cnpj || null,
          tipo_pessoa: polo.tipoPessoa || null,
          raw_data: polo,
        });
      }

      // Collect lawyers from advogadoProcesso array
      if (Array.isArray(cover.advogadoProcesso)) {
        for (const adv of cover.advogadoProcesso) {
          if (!adv.nome) continue;
          lawyerInserts.push({
            process_id: processId,
            cod_processo_polo: adv.codProcessoPolo || null,
            cod_agrupador: adv.codAgrupador || codAgrupador || null,
            nome_advogado: adv.nome || adv.nomeAdvogado,
            num_oab: adv.oab || adv.numOAB || null,
            uf_oab: adv.ufOAB || null,
            tipo_oab: adv.tipoOAB || null,
            raw_data: adv,
          });
        }
      }

      // Prepare process update
      processUpdates.push({
        id: processId,
        last_cover_sync_at: new Date().toISOString(),
        process_number: cover.numProcesso || undefined,
      });
    }

    // Batch upsert covers
    if (coverInserts.length > 0) {
      const { error: coverError } = await supabase
        .from('process_covers')
        .upsert(coverInserts, { onConflict: 'process_id,cod_agrupador' });
      
      if (coverError) {
        console.error('Error batch upserting covers:', coverError);
      } else {
        console.log(`Batch upserted ${coverInserts.length} covers`);
      }
    }

    // Batch upsert parties using new unique index
    if (partyInserts.length > 0) {
      const { error: partyError } = await supabase
        .from('process_parties')
        .upsert(partyInserts, { 
          onConflict: 'process_id,nome,tipo_polo',
          ignoreDuplicates: true 
        });
      
      if (partyError) {
        console.error('Error batch upserting parties:', partyError);
      } else {
        console.log(`Batch upserted ${partyInserts.length} parties`);
      }
    }

    // Batch upsert lawyers using new unique index
    if (lawyerInserts.length > 0) {
      const { error: lawyerError } = await supabase
        .from('process_lawyers')
        .upsert(lawyerInserts, { 
          onConflict: 'process_id,cod_processo_polo,nome_advogado',
          ignoreDuplicates: true 
        });
      
      if (lawyerError) {
        console.error('Error batch upserting lawyers:', lawyerError);
      } else {
        console.log(`Batch upserted ${lawyerInserts.length} lawyers`);
      }
    }

    // Update processes
    for (const update of processUpdates) {
      const { id, ...data } = update;
      await supabase.from('processes').update(data).eq('id', id);
    }

    // Confirm receipt of cover updates
    // API expects array of objects with codProcessoCapaAtualizada (from processesWithUpdates)
    if (confirmIds.length > 0) {
      try {
        // The API expects array of objects like [{ codProcessoCapaAtualizada: X }, ...]
        // We pass codProcesso directly as that's what we have
        const confirmArray = confirmIds.map(id => ({ codProcessoCapaAtualizada: id }));
        await client.post('/ConfirmaRecebimentoProcessosComCapaAtualizada', confirmArray);
        console.log(`Confirmed receipt of ${confirmIds.length} cover updates`);
      } catch (error) {
        console.error('Error confirming cover receipts:', error);
      }
    }

    return synced;
  } catch (error) {
    console.error('Error syncing covers:', error);
    return 0;
  }
}

/**
 * Confirm receipt of synced items
 * API V3 expects objects with specific property names:
 * - Groupers: { codAgrupadorConfirmado: X }
 * - Dependencies: { codDependenciaConfirmado: X }
 * - Movements: { codAndamentoConfirmado: X }
 * - Documents: { codDocumentoConfirmado: X }
 */
async function confirmReceipt(client: RestClient, supabase: any, type: string, ids: number[]): Promise<void> {
  try {
    const endpoints: Record<string, string> = {
      groupers: '/ConfirmaRecebimentoAgrupador',
      dependencies: '/ConfirmaRecebimentoDependencia',
      movements: '/ConfirmaRecebimentoAndamento',
      documents: '/ConfirmaRecebimentoDocumento',
    };

    // API expects object format with specific property names
    const confirmPropertyNames: Record<string, string> = {
      groupers: 'codAgrupadorConfirmado',
      dependencies: 'codDependenciaConfirmado',
      movements: 'codAndamentoConfirmado',
      documents: 'codDocumentoConfirmado',
    };

    const endpoint = endpoints[type];
    const propName = confirmPropertyNames[type];
    if (!endpoint || !propName) return;

    // Confirm in batches of 100 - API expects array of objects
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      // Convert to array of objects with the correct property name
      const confirmArray = batch.map(id => ({ [propName]: id }));
      await client.post(endpoint, confirmArray);
    }

    // Update confirmed status in database
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
