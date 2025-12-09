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

        // 3. Sync Movements (Andamentos)
        if (syncType === 'full' || syncType === 'movements') {
          const movementsSynced = await syncMovements(client, supabase, service);
          totalSynced += movementsSynced;
          console.log(`Synced ${movementsSynced} movements`);
        }

        // 4. Sync Documents
        if (syncType === 'full' || syncType === 'documents') {
          const docsSynced = await syncDocuments(client, supabase, service);
          totalSynced += docsSynced;
          console.log(`Synced ${docsSynced} documents`);
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
    let synced = 0;
    const confirmIds: number[] = [];

    for (const grouper of data) {
      // Find or create process
      const { data: process } = await supabase
        .from('processes')
        .select('id')
        .eq('cod_processo', grouper.codProcesso)
        .maybeSingle();

      const { error } = await supabase
        .from('process_groupers')
        .upsert({
          cod_agrupador: grouper.codAgrupador,
          cod_processo: grouper.codProcesso,
          process_id: process?.id || null,
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
        }, {
          onConflict: 'cod_agrupador,cod_processo',
        });

      if (!error) {
        synced++;
        confirmIds.push(grouper.codAgrupador);
      } else {
        console.error('Error upserting grouper:', error);
      }
    }

    // Confirm receipt
    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'groupers', confirmIds);
    }

    return synced;
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
    let synced = 0;
    const confirmIds: number[] = [];

    for (const dep of data) {
      const { data: process } = await supabase
        .from('processes')
        .select('id')
        .eq('cod_processo', dep.codProcesso)
        .maybeSingle();

      const { error } = await supabase
        .from('process_dependencies')
        .upsert({
          cod_dependencia: dep.codDependencia,
          cod_processo: dep.codProcesso,
          process_id: process?.id || null,
          num_processo: dep.numProcesso || null,
          instancia: dep.instancia || null,
          titulo: dep.titulo || null,
          is_confirmed: false,
          raw_data: dep,
        }, {
          onConflict: 'cod_dependencia,cod_processo',
        });

      if (!error) {
        synced++;
        confirmIds.push(dep.codDependencia);
      } else {
        console.error('Error upserting dependency:', error);
      }
    }

    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'dependencies', confirmIds);
    }

    return synced;
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
    let synced = 0;
    const confirmIds: number[] = [];

    for (const mov of data) {
      const { data: process } = await supabase
        .from('processes')
        .select('id')
        .eq('cod_processo', mov.codProcesso)
        .maybeSingle();

      const { error } = await supabase
        .from('process_movements')
        .upsert({
          cod_andamento: mov.codAndamento,
          cod_agrupador: mov.codAgrupador || null,
          process_id: process?.id || null,
          movement_type: mov.tipoAndamento || null,
          tipo_andamento: mov.tipoAndamento || null,
          movement_date: mov.dataAndamento || null,
          data_andamento: mov.dataAndamento || null,
          description: mov.descricao || null,
          raw_data: mov,
        }, {
          onConflict: 'cod_andamento',
        });

      if (!error) {
        synced++;
        confirmIds.push(mov.codAndamento);
      } else {
        console.error('Error upserting movement:', error);
      }
    }

    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'movements', confirmIds);
    }

    return synced;
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
    let synced = 0;
    const confirmIds: number[] = [];

    for (const doc of data) {
      const { data: process } = await supabase
        .from('processes')
        .select('id')
        .eq('cod_processo', doc.codProcesso)
        .maybeSingle();

      // Find movement if exists
      let movementId = null;
      if (doc.codAndamento) {
        const { data: movement } = await supabase
          .from('process_movements')
          .select('id')
          .eq('cod_andamento', doc.codAndamento)
          .maybeSingle();
        movementId = movement?.id;
      }

      const { error } = await supabase
        .from('process_documents')
        .upsert({
          cod_documento: doc.codDocumento,
          cod_processo: doc.codProcesso,
          cod_andamento: doc.codAndamento || null,
          cod_agrupador: doc.codAgrupador || null,
          process_id: process?.id || null,
          movement_id: movementId,
          tipo_documento: doc.tipoDocumento || null,
          nome_arquivo: doc.nomeArquivo || null,
          documento_url: doc.urlDocumento || null,
          tamanho_bytes: doc.tamanhoBytes || null,
          is_confirmed: false,
          raw_data: doc,
        }, {
          onConflict: 'cod_documento',
        });

      if (!error) {
        synced++;
        confirmIds.push(doc.codDocumento);
      } else {
        console.error('Error upserting document:', error);
      }
    }

    if (confirmIds.length > 0) {
      await confirmReceipt(client, supabase, 'documents', confirmIds);
    }

    return synced;
  } catch (error) {
    console.error('Error syncing documents:', error);
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

    // Get cover details for these processes
    const codProcessos = processesWithUpdates.map((p: any) => p.codProcesso || p).filter(Boolean);
    
    if (codProcessos.length === 0) return 0;

    // POST /BuscaDadosCapaEStatusVariosProcessos with body { codProcessos: [...] }
    const coversData = await client.post('/BuscaDadosCapaEStatusVariosProcessos', {
      codProcessos: codProcessos,
    });

    if (!Array.isArray(coversData) || coversData.length === 0) {
      console.log('No cover data returned');
      return 0;
    }

    console.log(`Got cover data for ${coversData.length} processes`);

    let synced = 0;
    const confirmIds: number[] = [];

    for (const cover of coversData) {
      const { data: process } = await supabase
        .from('processes')
        .select('id')
        .eq('cod_processo', cover.codProcesso)
        .maybeSingle();

      if (!process) {
        console.log(`Process not found for codProcesso: ${cover.codProcesso}`);
        continue;
      }

      // Find grouper if exists
      let grouperId = null;
      if (cover.codAgrupador) {
        const { data: grouper } = await supabase
          .from('process_groupers')
          .select('id')
          .eq('cod_agrupador', cover.codAgrupador)
          .maybeSingle();
        grouperId = grouper?.id;
      }

      // Upsert cover
      const { data: coverRecord, error: coverError } = await supabase
        .from('process_covers')
        .upsert({
          process_id: process.id,
          grouper_id: grouperId,
          cod_agrupador: cover.codAgrupador || null,
          cod_processo: cover.codProcesso,
          comarca: cover.comarca || null,
          vara: cover.vara || null,
          tribunal: cover.tribunal || null,
          assunto: cover.assunto || null,
          natureza: cover.natureza || null,
          tipo_acao: cover.tipoAcao || null,
          classe: cover.classe || null,
          juiz: cover.juiz || null,
          situacao: cover.situacao || null,
          area: cover.area || null,
          valor_causa: cover.valorCausa || null,
          data_distribuicao: cover.dataDistribuicao || null,
          data_atualizacao: cover.dataAtualizacao || null,
          raw_data: cover,
        }, {
          onConflict: 'process_id,cod_agrupador',
        })
        .select()
        .maybeSingle();

      if (coverError) {
        console.error('Error upserting cover:', coverError);
        continue;
      }

      synced++;
      confirmIds.push(cover.codProcesso);

      // Sync parties (polos)
      if (Array.isArray(cover.polos)) {
        for (const polo of cover.polos) {
          const { data: partyRecord } = await supabase
            .from('process_parties')
            .upsert({
              process_id: process.id,
              cover_id: coverRecord?.id,
              cod_processo_polo: polo.codProcessoPolo,
              cod_agrupador: cover.codAgrupador || null,
              tipo_polo: polo.tipoPolo,
              nome: polo.nome,
              cpf: polo.cpf || null,
              cnpj: polo.cnpj || null,
              tipo_pessoa: polo.tipoPessoa || null,
              raw_data: polo,
            }, {
              onConflict: 'cod_processo_polo,cod_agrupador',
            })
            .select()
            .maybeSingle();

          // Sync lawyers for this party
          if (Array.isArray(polo.advogados)) {
            for (const adv of polo.advogados) {
              await supabase
                .from('process_lawyers')
                .upsert({
                  process_id: process.id,
                  party_id: partyRecord?.id || null,
                  cod_processo_polo: polo.codProcessoPolo,
                  cod_agrupador: cover.codAgrupador || null,
                  nome_advogado: adv.nomeAdvogado,
                  num_oab: adv.numOAB || null,
                  uf_oab: adv.ufOAB || null,
                  tipo_oab: adv.tipoOAB || null,
                  raw_data: adv,
                }, {
                  onConflict: 'cod_processo_polo,num_oab',
                });
            }
          }
        }
      }

      // Update last cover sync and process number in processes table
      const updateData: Record<string, any> = { 
        last_cover_sync_at: new Date().toISOString() 
      };
      
      // Update process_number if we have the actual number from the cover
      if (cover.numProcesso) {
        updateData.process_number = cover.numProcesso;
      }

      await supabase
        .from('processes')
        .update(updateData)
        .eq('id', process.id);
    }

    // Confirm receipt of cover updates
    if (confirmIds.length > 0) {
      try {
        // POST /ConfirmaRecebimentoProcessosComCapaAtualizada
        await client.post('/ConfirmaRecebimentoProcessosComCapaAtualizada', {
          codProcessos: confirmIds,
        });
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
 * POST /ConfirmaRecebimento{Type} with body { codigos: [...] }
 */
async function confirmReceipt(client: RestClient, supabase: any, type: string, ids: number[]): Promise<void> {
  try {
    const endpoints: Record<string, string> = {
      groupers: '/ConfirmaRecebimentoAgrupador',
      dependencies: '/ConfirmaRecebimentoDependencia',
      movements: '/ConfirmaRecebimentoAndamento',
      documents: '/ConfirmaRecebimentoDocumento',
    };

    const endpoint = endpoints[type];
    if (!endpoint) return;

    // Confirm in batches of 100
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await client.post(endpoint, { codigos: batch });
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
