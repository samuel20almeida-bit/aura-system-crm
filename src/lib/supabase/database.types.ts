export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          task_id: string | null
          user_id: string | null
          verb: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
          verb: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          initials: string | null
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          initials?: string | null
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          initials?: string | null
          note?: string | null
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          author_id: string | null
          client_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          author_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          author_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_since: string | null
          code_prefix: string
          color: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          segment: string | null
          status: string
        }
        Insert: {
          client_since?: string | null
          code_prefix: string
          color?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          segment?: string | null
          status?: string
        }
        Update: {
          client_since?: string | null
          code_prefix?: string
          color?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          segment?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          cidade: string | null
          code_prefix: string | null
          criado_em: string
          decisor_nome: string | null
          dono_id: string | null
          email: string | null
          endereco: string | null
          fase: Database["public"]["Enums"]["conta_fase"]
          id: string
          nicho: string | null
          nome: string
          origem: string | null
          site: string | null
          software_atual: string | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          cidade?: string | null
          code_prefix?: string | null
          criado_em?: string
          decisor_nome?: string | null
          dono_id?: string | null
          email?: string | null
          endereco?: string | null
          fase?: Database["public"]["Enums"]["conta_fase"]
          id?: string
          nicho?: string | null
          nome: string
          origem?: string | null
          site?: string | null
          software_atual?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          cidade?: string | null
          code_prefix?: string | null
          criado_em?: string
          decisor_nome?: string | null
          dono_id?: string | null
          email?: string | null
          endereco?: string | null
          fase?: Database["public"]["Enums"]["conta_fase"]
          id?: string
          nicho?: string | null
          nome?: string
          origem?: string | null
          site?: string | null
          software_atual?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_dono_id_fkey"
            columns: ["dono_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          contract_type: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          value: number | null
        }
        Insert: {
          client_id: string
          contract_type: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          value?: number | null
        }
        Update: {
          client_id?: string
          contract_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      credenciais: {
        Row: {
          atualizado_em: string
          categoria_id: string
          cliente_id: string | null
          conta_id: string | null
          criado_em: string
          id: string
          nome: string
          notas: string | null
          senha: string | null
          url: string | null
          usuario: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria_id: string
          cliente_id?: string | null
          conta_id?: string | null
          criado_em?: string
          id?: string
          nome: string
          notas?: string | null
          senha?: string | null
          url?: string | null
          usuario?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string
          cliente_id?: string | null
          conta_id?: string | null
          criado_em?: string
          id?: string
          nome?: string
          notas?: string | null
          senha?: string | null
          url?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credenciais_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "credencial_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credenciais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credenciais_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      credencial_categorias: {
        Row: {
          criado_em: string
          id: string
          nome: string
          position: number
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          position?: number
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          position?: number
        }
        Relationships: []
      }
      deals: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          name: string
          owner_id: string | null
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          area: string
          created_at: string
          current: number
          id: string
          owner_id: string | null
          position: number
          quarter: string
          target: number
          title: string
          unit: string
        }
        Insert: {
          area: string
          created_at?: string
          current?: number
          id?: string
          owner_id?: string | null
          position?: number
          quarter: string
          target: number
          title: string
          unit?: string
        }
        Update: {
          area?: string
          created_at?: string
          current?: number
          id?: string
          owner_id?: string | null
          position?: number
          quarter?: string
          target?: number
          title?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_etapas: {
        Row: {
          espera: Database["public"]["Enums"]["etapa_espera"]
          nome: string
          posicao: number
          sla_dias: number
        }
        Insert: {
          espera?: Database["public"]["Enums"]["etapa_espera"]
          nome: string
          posicao: number
          sla_dias: number
        }
        Update: {
          espera?: Database["public"]["Enums"]["etapa_espera"]
          nome?: string
          posicao?: number
          sla_dias?: number
        }
        Relationships: []
      }
      implantacoes: {
        Row: {
          concluida_em: string | null
          conta_id: string
          criado_em: string
          dono_id: string | null
          etapa: number
          etapa_desde: string
          id: string
          negocio_id: string
        }
        Insert: {
          concluida_em?: string | null
          conta_id: string
          criado_em?: string
          dono_id?: string | null
          etapa?: number
          etapa_desde?: string
          id?: string
          negocio_id: string
        }
        Update: {
          concluida_em?: string | null
          conta_id?: string
          criado_em?: string
          dono_id?: string | null
          etapa?: number
          etapa_desde?: string
          id?: string
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacoes_dono_id_fkey"
            columns: ["dono_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacoes_etapa_fkey"
            columns: ["etapa"]
            isOneToOne: false
            referencedRelation: "implantacao_etapas"
            referencedColumns: ["posicao"]
          },
          {
            foreignKeyName: "implantacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          contract_id: string | null
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          reference_period: string
          status: string
        }
        Insert: {
          amount: number
          client_id: string
          contract_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          reference_period: string
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string
          contract_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          reference_period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          conta_id: string
          criado_em: string
          desconto: number
          dono_id: string | null
          estagio: Database["public"]["Enums"]["negocio_estagio"]
          fechado_em: string | null
          id: string
          mexido_em: string
          motivo_perda: string | null
          mrr: number | null
          plano_id: string | null
          proximo_passo: string | null
          proximo_passo_em: string | null
          resultado: Database["public"]["Enums"]["negocio_resultado"] | null
          setup: number | null
        }
        Insert: {
          conta_id: string
          criado_em?: string
          desconto?: number
          dono_id?: string | null
          estagio?: Database["public"]["Enums"]["negocio_estagio"]
          fechado_em?: string | null
          id?: string
          mexido_em?: string
          motivo_perda?: string | null
          mrr?: number | null
          plano_id?: string | null
          proximo_passo?: string | null
          proximo_passo_em?: string | null
          resultado?: Database["public"]["Enums"]["negocio_resultado"] | null
          setup?: number | null
        }
        Update: {
          conta_id?: string
          criado_em?: string
          desconto?: number
          dono_id?: string | null
          estagio?: Database["public"]["Enums"]["negocio_estagio"]
          fechado_em?: string | null
          id?: string
          mexido_em?: string
          motivo_perda?: string | null
          mrr?: number | null
          plano_id?: string | null
          proximo_passo?: string | null
          proximo_passo_em?: string | null
          resultado?: Database["public"]["Enums"]["negocio_resultado"] | null
          setup?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_dono_id_fkey"
            columns: ["dono_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          id: string
          mrr: number
          nicho: string
          nome: string
          posicao: number
          setup: number
        }
        Insert: {
          ativo?: boolean
          id?: string
          mrr: number
          nicho: string
          nome: string
          posicao?: number
          setup: number
        }
        Update: {
          ativo?: boolean
          id?: string
          mrr?: number
          nicho?: string
          nome?: string
          posicao?: number
          setup?: number
        }
        Relationships: []
      }
      playbook_categories: {
        Row: {
          id: string
          name: string
          position: number
        }
        Insert: {
          id?: string
          name: string
          position?: number
        }
        Update: {
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      playbook_run_steps: {
        Row: {
          done: boolean
          id: string
          run_id: string
          step_id: string
        }
        Insert: {
          done?: boolean
          id?: string
          run_id: string
          step_id: string
        }
        Update: {
          done?: boolean
          id?: string
          run_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "playbook_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_run_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "playbook_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_runs: {
        Row: {
          client_id: string | null
          completed_at: string | null
          conta_id: string | null
          id: string
          playbook_id: string
          started_at: string
          status: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          conta_id?: string | null
          id?: string
          playbook_id: string
          started_at?: string
          status?: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          conta_id?: string | null
          id?: string
          playbook_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_runs_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_runs_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_steps: {
        Row: {
          id: string
          playbook_id: string
          position: number
          title: string
        }
        Insert: {
          id?: string
          playbook_id: string
          position?: number
          title: string
        }
        Update: {
          id?: string
          playbook_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_steps_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          category_id: string
          created_at: string
          estimated_days: number | null
          id: string
          name: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          name: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "playbook_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          initials: string
          role_title: string | null
          weekly_capacity_hours: number
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          initials: string
          role_title?: string | null
          weekly_capacity_hours?: number
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          initials?: string
          role_title?: string | null
          weekly_capacity_hours?: number
        }
        Relationships: []
      }
      task_areas: {
        Row: {
          criado_em: string
          id: string
          nome: string
          position: number
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          position?: number
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          position?: number
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          storage_path: string | null
          task_id: string
          url: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          storage_path?: string | null
          task_id: string
          url?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          storage_path?: string | null
          task_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          assignee_id: string | null
          done: boolean
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          area: string | null
          assignee_id: string | null
          client_id: string | null
          code: string
          conta_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_internal: boolean
          labels: string[]
          position: number
          priority: string
          recurrence: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assignee_id?: string | null
          client_id?: string | null
          code: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_internal?: boolean
          labels?: string[]
          position?: number
          priority?: string
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assignee_id?: string | null
          client_id?: string | null
          code?: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_internal?: boolean
          labels?: string[]
          position?: number
          priority?: string
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      conta_fase: "prospect" | "implantacao" | "cliente" | "perdido" | "churn"
      etapa_espera: "nos" | "cliente"
      negocio_estagio:
        | "lead"
        | "contato"
        | "qualificado"
        | "diagnostico"
        | "proposta"
      negocio_resultado: "ganho" | "perdido"
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
    Enums: {
      conta_fase: ["prospect", "implantacao", "cliente", "perdido", "churn"],
      etapa_espera: ["nos", "cliente"],
      negocio_estagio: [
        "lead",
        "contato",
        "qualificado",
        "diagnostico",
        "proposta",
      ],
      negocio_resultado: ["ganho", "perdido"],
    },
  },
} as const
