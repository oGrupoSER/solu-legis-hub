/**
 * Sync Process Management Edge Function
 * Manages process registration, exclusion and status check with Solucionare API V3
 * 
 * Actions:
 * - register: CadastraNovoProcesso
 * - delete: ExcluirProcesso  
 * - status: BuscaStatusProcesso
 * - list: BuscaProcessos (lista processos do escritório)
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

// Status codes from Solucionare
const STATUS_CODES: Record<number, string> = {
  2: 'Validando',
  4: 'Cadastrado',
  5: 'Arquivado',
  6: 'Segredo de Justiça',
  7: 'Erro na Validação',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, serviceId, processNumber, officeCode, uf, instance } = body;

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
      
      if (error || !data) {
        throw new Error('Service not found or inactive');
      }
      service = data;
    } else {
      const services = await getActiveServices('processes');
      if (services.length === 0) {
        throw new Error('No active process services found');
      }
      service = services[0];
    }

    validateService(service);

    const client = new RestClient({
      baseUrl: service.service_url,
      nomeRelacional: service.nome_relacional,
      token: service.token,
    });

    let result;

    switch (action) {
      case 'register': {
        // CadastraNovoProcesso
        if (!processNumber || !officeCode) {
          throw new Error('processNumber and officeCode are required');
        }

        await logger.start({
          partner_service_id: service.id,
          sync_type: 'process_register',
        });

        console.log(`Registering process: ${processNumber}`);
        
        const registerData = await client.post('/CadastraNovoProcesso', {
          numProcesso: processNumber,
          codEscritorio: officeCode,
          UF: uf || '',
          instancia: instance || 0,
        });

        // Insert or update process in database
        const { data: processRecord, error: insertError } = await supabase
          .from('processes')
          .upsert({
            process_number: processNumber,
            partner_service_id: service.id,
            partner_id: service.partner_id,
            cod_escritorio: officeCode,
            cod_processo: registerData?.codProcesso || null,
            status_code: 2, // Validando
            status_description: STATUS_CODES[2],
            uf: uf || null,
            instance: instance?.toString() || null,
            raw_data: registerData || {},
          }, {
            onConflict: 'process_number',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting process:', insertError);
          throw insertError;
        }

        await logger.success(1);
        result = { 
          success: true, 
          message: 'Process registered successfully',
          process: processRecord,
          solucionareResponse: registerData,
        };
        break;
      }

      case 'delete': {
        // ExcluirProcesso
        if (!processNumber) {
          throw new Error('processNumber is required');
        }

        await logger.start({
          partner_service_id: service.id,
          sync_type: 'process_delete',
        });

        console.log(`Deleting process: ${processNumber}`);

        // Get process from database to get cod_processo
        const { data: existingProcess } = await supabase
          .from('processes')
          .select('id, cod_processo')
          .eq('process_number', processNumber)
          .single();

        if (!existingProcess?.cod_processo) {
          throw new Error('Process not found or missing cod_processo');
        }

        const deleteData = await client.delete('/ExcluirProcesso', {
          codProcesso: existingProcess.cod_processo,
        });

        // Update status in database
        await supabase
          .from('processes')
          .update({
            status_code: 5, // Arquivado
            status_description: 'Excluído',
            raw_data: deleteData || {},
          })
          .eq('id', existingProcess.id);

        await logger.success(1);
        result = { 
          success: true, 
          message: 'Process deleted successfully',
          solucionareResponse: deleteData,
        };
        break;
      }

      case 'status': {
        // BuscaStatusProcesso
        if (!processNumber) {
          throw new Error('processNumber is required');
        }

        console.log(`Checking status for process: ${processNumber}`);

        const statusData = await client.get('/BuscaStatusProcesso', {
          numProcesso: processNumber,
        });

        // Update status in database if process exists
        if (statusData?.codStatus) {
          await supabase
            .from('processes')
            .update({
              status_code: statusData.codStatus,
              status_description: STATUS_CODES[statusData.codStatus] || statusData.descricaoStatus,
              cod_processo: statusData.codProcesso || null,
            })
            .eq('process_number', processNumber);
        }

        result = { 
          success: true, 
          status: statusData,
          statusDescription: STATUS_CODES[statusData?.codStatus] || 'Unknown',
        };
        break;
      }

      case 'list': {
        // BuscaProcessos - lista todos os processos do escritório
        console.log(`Listing all processes for service: ${service.service_name}`);

        const processesData = await client.get('/BuscaProcessos');

        result = { 
          success: true, 
          processes: processesData || [],
          count: Array.isArray(processesData) ? processesData.length : 0,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: register, delete, status, list`);
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
