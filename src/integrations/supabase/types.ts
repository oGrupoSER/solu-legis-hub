export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_requests: {
        Row: {
          client_system_id: string | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          request_time: string | null
          response_time_ms: number | null
          status_code: number | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          client_system_id?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          request_time?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          client_system_id?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_time?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_requests_client_system_id_fkey"
            columns: ["client_system_id"]
            isOneToOne: false
            referencedRelation: "client_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_requests_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          client_system_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          token: string
        }
        Insert: {
          client_system_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          token: string
        }
        Update: {
          client_system_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_client_system_id_fkey"
            columns: ["client_system_id"]
            isOneToOne: false
            referencedRelation: "client_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      client_system_services: {
        Row: {
          client_system_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          partner_service_id: string
          updated_at: string | null
        }
        Insert: {
          client_system_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_service_id: string
          updated_at?: string | null
        }
        Update: {
          client_system_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_system_services_client_system_id_fkey"
            columns: ["client_system_id"]
            isOneToOne: false
            referencedRelation: "client_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_system_services_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_systems: {
        Row: {
          contact_email: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          office_code: number | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          office_code?: number | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          office_code?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_webhooks: {
        Row: {
          client_system_id: string
          created_at: string | null
          events: string[]
          id: string
          is_active: boolean | null
          secret: string | null
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          client_system_id: string
          created_at?: string | null
          events: string[]
          id?: string
          is_active?: boolean | null
          secret?: string | null
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          client_system_id?: string
          created_at?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          secret?: string | null
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_webhooks_client_system_id_fkey"
            columns: ["client_system_id"]
            isOneToOne: false
            referencedRelation: "client_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_status: {
        Row: {
          cod_mapa_diario: number
          consulta_date: string
          created_at: string | null
          data_disponibilizacao: string | null
          data_publicacao: string | null
          esfera_diario: string | null
          estado: string | null
          id: string
          nome_diario: string | null
          partner_service_id: string | null
          raw_data: Json
          sigla_diario: string | null
          status: string | null
          tribunal: string | null
        }
        Insert: {
          cod_mapa_diario: number
          consulta_date: string
          created_at?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          esfera_diario?: string | null
          estado?: string | null
          id?: string
          nome_diario?: string | null
          partner_service_id?: string | null
          raw_data?: Json
          sigla_diario?: string | null
          status?: string | null
          tribunal?: string | null
        }
        Update: {
          cod_mapa_diario?: number
          consulta_date?: string
          created_at?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          esfera_diario?: string | null
          estado?: string | null
          id?: string
          nome_diario?: string | null
          partner_service_id?: string | null
          raw_data?: Json
          sigla_diario?: string | null
          status?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_status_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          created_at: string | null
          distribution_date: string | null
          id: string
          partner_id: string | null
          partner_service_id: string | null
          process_number: string
          raw_data: Json
          term: string | null
          tribunal: string | null
        }
        Insert: {
          created_at?: string | null
          distribution_date?: string | null
          id?: string
          partner_id?: string | null
          partner_service_id?: string | null
          process_number: string
          raw_data: Json
          term?: string | null
          tribunal?: string | null
        }
        Update: {
          created_at?: string | null
          distribution_date?: string | null
          id?: string
          partner_id?: string | null
          partner_service_id?: string | null
          process_number?: string
          raw_data?: Json
          term?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          config: Json | null
          confirm_receipt: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          nome_relacional: string
          partner_id: string
          service_name: string
          service_type: string
          service_url: string
          token: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          confirm_receipt?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          nome_relacional: string
          partner_id: string
          service_name: string
          service_type: string
          service_url: string
          token: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          confirm_receipt?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          nome_relacional?: string
          partner_id?: string
          service_name?: string
          service_type?: string
          service_url?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          api_base_url: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string | null
          description: string | null
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          is_active: boolean | null
          logradouro: string | null
          name: string
          numero: string | null
          razao_social: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          api_base_url?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean | null
          logradouro?: string | null
          name: string
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          api_base_url?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean | null
          logradouro?: string | null
          name?: string
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      process_covers: {
        Row: {
          area: string | null
          assunto: string | null
          classe: string | null
          cod_agrupador: number | null
          cod_processo: number | null
          comarca: string | null
          created_at: string | null
          data_atualizacao: string | null
          data_distribuicao: string | null
          grouper_id: string | null
          id: string
          juiz: string | null
          natureza: string | null
          process_id: string | null
          raw_data: Json
          situacao: string | null
          tipo_acao: string | null
          tribunal: string | null
          updated_at: string | null
          valor_causa: number | null
          vara: string | null
        }
        Insert: {
          area?: string | null
          assunto?: string | null
          classe?: string | null
          cod_agrupador?: number | null
          cod_processo?: number | null
          comarca?: string | null
          created_at?: string | null
          data_atualizacao?: string | null
          data_distribuicao?: string | null
          grouper_id?: string | null
          id?: string
          juiz?: string | null
          natureza?: string | null
          process_id?: string | null
          raw_data?: Json
          situacao?: string | null
          tipo_acao?: string | null
          tribunal?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          vara?: string | null
        }
        Update: {
          area?: string | null
          assunto?: string | null
          classe?: string | null
          cod_agrupador?: number | null
          cod_processo?: number | null
          comarca?: string | null
          created_at?: string | null
          data_atualizacao?: string | null
          data_distribuicao?: string | null
          grouper_id?: string | null
          id?: string
          juiz?: string | null
          natureza?: string | null
          process_id?: string | null
          raw_data?: Json
          situacao?: string | null
          tipo_acao?: string | null
          tribunal?: string | null
          updated_at?: string | null
          valor_causa?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_covers_grouper_id_fkey"
            columns: ["grouper_id"]
            isOneToOne: false
            referencedRelation: "process_groupers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_covers_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_dependencies: {
        Row: {
          cod_dependencia: number
          cod_processo: number
          created_at: string | null
          id: string
          instancia: number | null
          is_confirmed: boolean | null
          num_processo: string | null
          process_id: string | null
          raw_data: Json
          titulo: string | null
        }
        Insert: {
          cod_dependencia: number
          cod_processo: number
          created_at?: string | null
          id?: string
          instancia?: number | null
          is_confirmed?: boolean | null
          num_processo?: string | null
          process_id?: string | null
          raw_data?: Json
          titulo?: string | null
        }
        Update: {
          cod_dependencia?: number
          cod_processo?: number
          created_at?: string | null
          id?: string
          instancia?: number | null
          is_confirmed?: boolean | null
          num_processo?: string | null
          process_id?: string | null
          raw_data?: Json
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_dependencies_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_documents: {
        Row: {
          cod_agrupador: number | null
          cod_andamento: number | null
          cod_documento: number
          cod_processo: number | null
          created_at: string | null
          documento_url: string | null
          id: string
          is_confirmed: boolean | null
          movement_id: string | null
          nome_arquivo: string | null
          process_id: string | null
          raw_data: Json
          tamanho_bytes: number | null
          tipo_documento: string | null
        }
        Insert: {
          cod_agrupador?: number | null
          cod_andamento?: number | null
          cod_documento: number
          cod_processo?: number | null
          created_at?: string | null
          documento_url?: string | null
          id?: string
          is_confirmed?: boolean | null
          movement_id?: string | null
          nome_arquivo?: string | null
          process_id?: string | null
          raw_data?: Json
          tamanho_bytes?: number | null
          tipo_documento?: string | null
        }
        Update: {
          cod_agrupador?: number | null
          cod_andamento?: number | null
          cod_documento?: number
          cod_processo?: number | null
          created_at?: string | null
          documento_url?: string | null
          id?: string
          is_confirmed?: boolean | null
          movement_id?: string | null
          nome_arquivo?: string | null
          process_id?: string | null
          raw_data?: Json
          tamanho_bytes?: number | null
          tipo_documento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "process_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_groupers: {
        Row: {
          cod_agrupador: number
          cod_processo: number
          comarca: string | null
          created_at: string | null
          data_cadastro: string | null
          id: string
          instancia: number | null
          is_confirmed: boolean | null
          num_processo: string | null
          posicao: number | null
          process_id: string | null
          raw_data: Json
          titulo: string | null
          tribunal: string | null
          updated_at: string | null
          vara: string | null
        }
        Insert: {
          cod_agrupador: number
          cod_processo: number
          comarca?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          id?: string
          instancia?: number | null
          is_confirmed?: boolean | null
          num_processo?: string | null
          posicao?: number | null
          process_id?: string | null
          raw_data?: Json
          titulo?: string | null
          tribunal?: string | null
          updated_at?: string | null
          vara?: string | null
        }
        Update: {
          cod_agrupador?: number
          cod_processo?: number
          comarca?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          id?: string
          instancia?: number | null
          is_confirmed?: boolean | null
          num_processo?: string | null
          posicao?: number | null
          process_id?: string | null
          raw_data?: Json
          titulo?: string | null
          tribunal?: string | null
          updated_at?: string | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_groupers_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_lawyers: {
        Row: {
          cod_agrupador: number | null
          cod_processo_polo: number | null
          created_at: string | null
          id: string
          nome_advogado: string
          num_oab: string | null
          party_id: string | null
          process_id: string | null
          raw_data: Json
          tipo_oab: string | null
          uf_oab: string | null
        }
        Insert: {
          cod_agrupador?: number | null
          cod_processo_polo?: number | null
          created_at?: string | null
          id?: string
          nome_advogado: string
          num_oab?: string | null
          party_id?: string | null
          process_id?: string | null
          raw_data?: Json
          tipo_oab?: string | null
          uf_oab?: string | null
        }
        Update: {
          cod_agrupador?: number | null
          cod_processo_polo?: number | null
          created_at?: string | null
          id?: string
          nome_advogado?: string
          num_oab?: string | null
          party_id?: string | null
          process_id?: string | null
          raw_data?: Json
          tipo_oab?: string | null
          uf_oab?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_lawyers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "process_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_lawyers_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_movements: {
        Row: {
          cod_agrupador: number | null
          cod_andamento: number | null
          created_at: string | null
          data_andamento: string | null
          description: string | null
          id: string
          movement_date: string | null
          movement_type: string | null
          process_id: string | null
          raw_data: Json
          tipo_andamento: string | null
        }
        Insert: {
          cod_agrupador?: number | null
          cod_andamento?: number | null
          created_at?: string | null
          data_andamento?: string | null
          description?: string | null
          id?: string
          movement_date?: string | null
          movement_type?: string | null
          process_id?: string | null
          raw_data: Json
          tipo_andamento?: string | null
        }
        Update: {
          cod_agrupador?: number | null
          cod_andamento?: number | null
          created_at?: string | null
          data_andamento?: string | null
          description?: string | null
          id?: string
          movement_date?: string | null
          movement_type?: string | null
          process_id?: string | null
          raw_data?: Json
          tipo_andamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_movements_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_parties: {
        Row: {
          cnpj: string | null
          cod_agrupador: number | null
          cod_processo_polo: number | null
          cover_id: string | null
          cpf: string | null
          created_at: string | null
          id: string
          nome: string
          process_id: string | null
          raw_data: Json
          tipo_pessoa: string | null
          tipo_polo: number
        }
        Insert: {
          cnpj?: string | null
          cod_agrupador?: number | null
          cod_processo_polo?: number | null
          cover_id?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          nome: string
          process_id?: string | null
          raw_data?: Json
          tipo_pessoa?: string | null
          tipo_polo: number
        }
        Update: {
          cnpj?: string | null
          cod_agrupador?: number | null
          cod_processo_polo?: number | null
          cover_id?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          process_id?: string | null
          raw_data?: Json
          tipo_pessoa?: string | null
          tipo_polo?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_parties_cover_id_fkey"
            columns: ["cover_id"]
            isOneToOne: false
            referencedRelation: "process_covers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_parties_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          cod_escritorio: number | null
          cod_processo: number | null
          created_at: string | null
          id: string
          instance: string | null
          last_cover_sync_at: string | null
          last_sync_at: string | null
          partner_id: string | null
          partner_service_id: string | null
          process_number: string
          raw_data: Json
          status: string | null
          status_code: number | null
          status_description: string | null
          tribunal: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          cod_escritorio?: number | null
          cod_processo?: number | null
          created_at?: string | null
          id?: string
          instance?: string | null
          last_cover_sync_at?: string | null
          last_sync_at?: string | null
          partner_id?: string | null
          partner_service_id?: string | null
          process_number: string
          raw_data: Json
          status?: string | null
          status_code?: number | null
          status_description?: string | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_escritorio?: number | null
          cod_processo?: number | null
          created_at?: string | null
          id?: string
          instance?: string | null
          last_cover_sync_at?: string | null
          last_sync_at?: string | null
          partner_id?: string | null
          partner_service_id?: string | null
          process_number?: string
          raw_data?: Json
          status?: string | null
          status_code?: number | null
          status_description?: string | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          cod_publicacao: number | null
          content: string | null
          created_at: string | null
          gazette_name: string | null
          id: string
          matched_terms: string[] | null
          partner_id: string | null
          partner_service_id: string | null
          publication_date: string | null
          raw_data: Json
        }
        Insert: {
          cod_publicacao?: number | null
          content?: string | null
          created_at?: string | null
          gazette_name?: string | null
          id?: string
          matched_terms?: string[] | null
          partner_id?: string | null
          partner_service_id?: string | null
          publication_date?: string | null
          raw_data: Json
        }
        Update: {
          cod_publicacao?: number | null
          content?: string | null
          created_at?: string | null
          gazette_name?: string | null
          id?: string
          matched_terms?: string[] | null
          partner_id?: string | null
          partner_service_id?: string | null
          publication_date?: string | null
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "publications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      search_terms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          partner_id: string | null
          partner_service_id: string | null
          term: string
          term_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_id?: string | null
          partner_service_id?: string | null
          term: string
          term_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_id?: string | null
          partner_service_id?: string | null
          term?: string
          term_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_terms_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_terms_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          partner_id: string | null
          partner_service_id: string | null
          records_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          partner_id?: string | null
          partner_service_id?: string | null
          records_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          partner_id?: string | null
          partner_service_id?: string | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_partner_service_id_fkey"
            columns: ["partner_service_id"]
            isOneToOne: false
            referencedRelation: "partner_services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
