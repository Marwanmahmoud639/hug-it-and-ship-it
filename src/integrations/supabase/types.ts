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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_team_session: {
        Row: {
          acting_team_id: string
          set_at: string
          user_id: string
        }
        Insert: {
          acting_team_id: string
          set_at?: string
          user_id: string
        }
        Update: {
          acting_team_id?: string
          set_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_team_session_acting_team_id_fkey"
            columns: ["acting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          campaign_id: string | null
          channel: string | null
          contact_id: string | null
          created_at: string
          id: string
          note: string | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          campaign_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          kind: string
          storage_path: string | null
          team_id: string
          title: string
          tokens: number
          uploaded_by: string | null
        }
        Insert: {
          agent_id: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string | null
          team_id: string
          title: string
          tokens?: number
          uploaded_by?: string | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string | null
          team_id?: string
          title?: string
          tokens?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_objections: {
        Row: {
          agent_id: string
          approved: boolean
          auto_learned: boolean
          created_at: string
          id: string
          objection: string
          rebuttal: string
          team_id: string
          times_encountered: number
          times_resolved: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          approved?: boolean
          auto_learned?: boolean
          created_at?: string
          id?: string
          objection: string
          rebuttal?: string
          team_id: string
          times_encountered?: number
          times_resolved?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          approved?: boolean
          auto_learned?: boolean
          created_at?: string
          id?: string
          objection?: string
          rebuttal?: string
          team_id?: string
          times_encountered?: number
          times_resolved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_objections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_objections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lookup_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          query: Json
          query_hash: string
          result: Json
          source: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          query: Json
          query_hash: string
          result: Json
          source: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          query?: Json
          query_hash?: string
          result?: Json
          source?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
          tokens_in: number | null
          tokens_out: number | null
          tool_args: Json | null
          tool_call_id: string | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_personalization_jobs: {
        Row: {
          ai_provider: string | null
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          contact_id: string
          created_at: string
          edited_message: string | null
          error: string | null
          generated_message: string | null
          id: string
          status: string
          team_id: string
          updated_at: string
          variant: string
        }
        Insert: {
          ai_provider?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          contact_id: string
          created_at?: string
          edited_message?: string | null
          error?: string | null
          generated_message?: string | null
          id?: string
          status?: string
          team_id: string
          updated_at?: string
          variant?: string
        }
        Update: {
          ai_provider?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          contact_id?: string
          created_at?: string
          edited_message?: string | null
          error?: string | null
          generated_message?: string | null
          id?: string
          status?: string
          team_id?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_personalization_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_personalization_jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_personalization_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          path: string | null
          props: Json
          referrer: string | null
          session_id: string | null
          team_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          path?: string | null
          props?: Json
          referrer?: string | null
          session_id?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          path?: string | null
          props?: Json
          referrer?: string | null
          session_id?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      api_credit_snapshots: {
        Row: {
          balance: number | null
          balance_unit: string | null
          created_at: string
          error: string | null
          fetched_at: string
          id: string
          provider: string
          raw: Json
          team_id: string
        }
        Insert: {
          balance?: number | null
          balance_unit?: string | null
          created_at?: string
          error?: string | null
          fetched_at?: string
          id?: string
          provider: string
          raw?: Json
          team_id: string
        }
        Update: {
          balance?: number | null
          balance_unit?: string | null
          created_at?: string
          error?: string | null
          fetched_at?: string
          id?: string
          provider?: string
          raw?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_credit_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_emails: {
        Row: {
          approved_at: string
          approved_by: string | null
          email: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          email: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          email?: string
        }
        Relationships: []
      }
      blacklist_checks: {
        Row: {
          check_provider: string
          checked_at: string
          domain: string
          id: string
          is_listed: boolean
          listed_on: string[]
          team_id: string
        }
        Insert: {
          check_provider?: string
          checked_at?: string
          domain: string
          id?: string
          is_listed?: boolean
          listed_on?: string[]
          team_id: string
        }
        Update: {
          check_provider?: string
          checked_at?: string
          domain?: string
          id?: string
          is_listed?: boolean
          listed_on?: string[]
          team_id?: string
        }
        Relationships: []
      }
      business_intel: {
        Row: {
          active_buyer_signal: boolean
          attom_last_checked: string | null
          contact_id: string
          created_at: string
          description: string | null
          employee_count: number | null
          founded_year: number | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          industry_tags: string[]
          is_real_estate_investor: boolean
          last_transaction_date: string | null
          llc_mailing_address: string | null
          llc_registered_agent: string | null
          portfolio_size: string | null
          properties_owned: number | null
          recent_transactions_12mo: number | null
          scrape_status: string | null
          services: string[]
          sos_last_checked: string | null
          team_id: string
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          active_buyer_signal?: boolean
          attom_last_checked?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          employee_count?: number | null
          founded_year?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          industry_tags?: string[]
          is_real_estate_investor?: boolean
          last_transaction_date?: string | null
          llc_mailing_address?: string | null
          llc_registered_agent?: string | null
          portfolio_size?: string | null
          properties_owned?: number | null
          recent_transactions_12mo?: number | null
          scrape_status?: string | null
          services?: string[]
          sos_last_checked?: string | null
          team_id: string
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          active_buyer_signal?: boolean
          attom_last_checked?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          employee_count?: number | null
          founded_year?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          industry_tags?: string[]
          is_real_estate_investor?: boolean
          last_transaction_date?: string | null
          llc_mailing_address?: string | null
          llc_registered_agent?: string | null
          portfolio_size?: string | null
          properties_owned?: number | null
          recent_transactions_12mo?: number | null
          scrape_status?: string | null
          services?: string[]
          sos_last_checked?: string | null
          team_id?: string
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_run_id: string
          content: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          role: string | null
          team_id: string
        }
        Insert: {
          call_run_id: string
          content?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          role?: string | null
          team_id: string
        }
        Update: {
          call_run_id?: string
          content?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          role?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_run_id_fkey"
            columns: ["call_run_id"]
            isOneToOne: false
            referencedRelation: "call_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      call_history: {
        Row: {
          call_status: string | null
          contact_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          id: string
          phone_number: string
          recording_url: string | null
          team_id: string
          transcription: string | null
          user_id: string
        }
        Insert: {
          call_status?: string | null
          contact_id?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          id?: string
          phone_number: string
          recording_url?: string | null
          team_id: string
          transcription?: string | null
          user_id: string
        }
        Update: {
          call_status?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          phone_number?: string
          recording_url?: string | null
          team_id?: string
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      call_runs: {
        Row: {
          agent_id: string
          contact_id: string | null
          cost_usd: number
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          initiated_by: string | null
          objections_encountered: string[]
          outcome: string | null
          phone_number: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          summary: string | null
          team_id: string
          transcript: string
        }
        Insert: {
          agent_id: string
          contact_id?: string | null
          cost_usd?: number
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          initiated_by?: string | null
          objections_encountered?: string[]
          outcome?: string | null
          phone_number?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          team_id: string
          transcript?: string
        }
        Update: {
          agent_id?: string
          contact_id?: string | null
          cost_usd?: number
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          initiated_by?: string | null
          objections_encountered?: string[]
          outcome?: string | null
          phone_number?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          team_id?: string
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_runs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          id: string
          opened_at: string | null
          personalized_message: string | null
          replied_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["contact_status"]
          team_id: string
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          personalized_message?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          team_id: string
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          personalized_message?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          bounce_rate: number
          campaign_id: string
          cost_per_lead: number
          created_at: string
          id: string
          last_evaluated_at: string
          leads_generated: number
          reply_rate: number
          team_id: string
          total_bounced: number
          total_contacts: number
          total_delivered: number
          total_opened: number
          total_replied: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          bounce_rate?: number
          campaign_id: string
          cost_per_lead?: number
          created_at?: string
          id?: string
          last_evaluated_at?: string
          leads_generated?: number
          reply_rate?: number
          team_id: string
          total_bounced?: number
          total_contacts?: number
          total_delivered?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          bounce_rate?: number
          campaign_id?: string
          cost_per_lead?: number
          created_at?: string
          id?: string
          last_evaluated_at?: string
          leads_generated?: number
          reply_rate?: number
          team_id?: string
          total_bounced?: number
          total_contacts?: number
          total_delivered?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ai_personalization: boolean
          auto_scaled_at: string | null
          body: string
          campaign_round: number
          cost_per_lead_threshold: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_campaign_id: string | null
          pause_reason: string | null
          paused_at: string | null
          scheduled_at: string | null
          sending_days: string[]
          sending_end_time: string | null
          sending_inbox_ids: string[]
          sending_start_time: string | null
          sending_strategy: string
          sending_window_enabled: boolean
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string | null
          team_id: string
          timezone: string
          total_cost: number
          type: Database["public"]["Enums"]["campaign_type"]
        }
        Insert: {
          ai_personalization?: boolean
          auto_scaled_at?: string | null
          body?: string
          campaign_round?: number
          cost_per_lead_threshold?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_campaign_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          scheduled_at?: string | null
          sending_days?: string[]
          sending_end_time?: string | null
          sending_inbox_ids?: string[]
          sending_start_time?: string | null
          sending_strategy?: string
          sending_window_enabled?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          team_id: string
          timezone?: string
          total_cost?: number
          type: Database["public"]["Enums"]["campaign_type"]
        }
        Update: {
          ai_personalization?: boolean
          auto_scaled_at?: string | null
          body?: string
          campaign_round?: number
          cost_per_lead_threshold?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_campaign_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          scheduled_at?: string | null
          sending_days?: string[]
          sending_end_time?: string | null
          sending_inbox_ids?: string[]
          sending_start_time?: string | null
          sending_strategy?: string
          sending_window_enabled?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          team_id?: string
          timezone?: string
          total_cost?: number
          type?: Database["public"]["Enums"]["campaign_type"]
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portals: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          date_range: string
          expires_at: string | null
          filter_type: string
          filter_value: string
          id: string
          last_viewed_at: string | null
          name: string
          team_id: string
          token: string
          view_count: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          date_range?: string
          expires_at?: string | null
          filter_type: string
          filter_value: string
          id?: string
          last_viewed_at?: string | null
          name: string
          team_id: string
          token?: string
          view_count?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          date_range?: string
          expires_at?: string | null
          filter_type?: string
          filter_value?: string
          id?: string
          last_viewed_at?: string | null
          name?: string
          team_id?: string
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          domain: string | null
          employee_count: number | null
          founded_year: number | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          industry: string | null
          name: string
          normalized_name: string
          primary_contact_id: string | null
          state: string | null
          team_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          founded_year?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          industry?: string | null
          name: string
          normalized_name: string
          primary_contact_id?: string | null
          state?: string | null
          team_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          founded_year?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          normalized_name?: string
          primary_contact_id?: string | null
          state?: string | null
          team_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      compliance_log: {
        Row: {
          campaign_id: string | null
          compliance_passed: boolean
          contacts_sent: number
          contacts_suppressed_dnc: number
          contacts_suppressed_internal_dnc: number
          contacts_suppressed_non_mobile: number
          contacts_suppressed_timezone: number
          contacts_total: number
          id: string
          log_data: Json
          run_at: string
          team_id: string
        }
        Insert: {
          campaign_id?: string | null
          compliance_passed?: boolean
          contacts_sent?: number
          contacts_suppressed_dnc?: number
          contacts_suppressed_internal_dnc?: number
          contacts_suppressed_non_mobile?: number
          contacts_suppressed_timezone?: number
          contacts_total?: number
          id?: string
          log_data?: Json
          run_at?: string
          team_id: string
        }
        Update: {
          campaign_id?: string | null
          compliance_passed?: boolean
          contacts_sent?: number
          contacts_suppressed_dnc?: number
          contacts_suppressed_internal_dnc?: number
          contacts_suppressed_non_mobile?: number
          contacts_suppressed_timezone?: number
          contacts_total?: number
          id?: string
          log_data?: Json
          run_at?: string
          team_id?: string
        }
        Relationships: []
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          is_unsubscribed: boolean
          mx_valid: boolean
          smtp_pinged: boolean
          smtp_result: string | null
          source_type: Database["public"]["Enums"]["email_source_type"]
          sources: string[]
          sources_confirmed: number
          team_id: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          verified_status: Database["public"]["Enums"]["email_verify_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          is_unsubscribed?: boolean
          mx_valid?: boolean
          smtp_pinged?: boolean
          smtp_result?: string | null
          source_type?: Database["public"]["Enums"]["email_source_type"]
          sources?: string[]
          sources_confirmed?: number
          team_id: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          verified_status?: Database["public"]["Enums"]["email_verify_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          is_unsubscribed?: boolean
          mx_valid?: boolean
          smtp_pinged?: boolean
          smtp_result?: string | null
          source_type?: Database["public"]["Enums"]["email_source_type"]
          sources?: string[]
          sources_confirmed?: number
          team_id?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          verified_status?: Database["public"]["Enums"]["email_verify_status"]
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          id: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          id?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          carrier_lookup_date: string | null
          carrier_name: string | null
          confidence_score: number
          contact_id: string
          created_at: string
          id: string
          is_dnc: boolean
          is_primary: boolean
          is_sms_eligible: boolean
          line_type: string | null
          phone_number: string
          phone_type: Database["public"]["Enums"]["phone_type"]
          sources: string[]
          team_id: string
          verified: boolean
        }
        Insert: {
          carrier_lookup_date?: string | null
          carrier_name?: string | null
          confidence_score?: number
          contact_id: string
          created_at?: string
          id?: string
          is_dnc?: boolean
          is_primary?: boolean
          is_sms_eligible?: boolean
          line_type?: string | null
          phone_number: string
          phone_type?: Database["public"]["Enums"]["phone_type"]
          sources?: string[]
          team_id: string
          verified?: boolean
        }
        Update: {
          carrier_lookup_date?: string | null
          carrier_name?: string | null
          confidence_score?: number
          contact_id?: string
          created_at?: string
          id?: string
          is_dnc?: boolean
          is_primary?: boolean
          is_sms_eligible?: boolean
          line_type?: string | null
          phone_number?: string
          phone_type?: Database["public"]["Enums"]["phone_type"]
          sources?: string[]
          team_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          ai_verified_at: string | null
          assigned_to: string | null
          auto_added_by_discovery: boolean
          auto_purge_at: string | null
          city: string | null
          company: string | null
          company_id: string | null
          contact_frequency: string | null
          country: string | null
          created_at: string
          custom_field_1: string | null
          custom_field_2: string | null
          custom_field_3: string | null
          custom_fields: Json
          deal_value: number | null
          detected_timezone: string | null
          discovery_keyword: string | null
          dnc_added_at: string | null
          dnc_reason: string | null
          do_not_contact: boolean
          email: string | null
          email_ai_confidence: number | null
          email_ai_reason: string | null
          email_verified: boolean
          email_verified_by_ai: boolean
          facebook_url: string | null
          geocoded_at: string | null
          icp_fit_reason: string | null
          icp_fit_score: number | null
          icp_matches: boolean | null
          id: string
          industry: string | null
          instagram_url: string | null
          is_dnc_federal: boolean
          is_dnc_internal: boolean
          last_activity_at: string | null
          last_contacted_at: string | null
          last_message_at: string | null
          last_message_channel: string | null
          lat: number | null
          lead_score: number
          linkedin_url: string | null
          lng: number | null
          name: string
          next_followup_at: string | null
          notes: string | null
          opted_out: boolean
          opted_out_channels: string[]
          phone: string | null
          phone_verified: boolean
          priority: string | null
          source: string
          state: string | null
          tags: string[]
          team_id: string
          timezone_confidence: string | null
          timezone_source: string | null
          title: string | null
          twitter_url: string | null
          unread_count: number
          updated_at: string
          verification_sources: string[]
          website: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          ai_verified_at?: string | null
          assigned_to?: string | null
          auto_added_by_discovery?: boolean
          auto_purge_at?: string | null
          city?: string | null
          company?: string | null
          company_id?: string | null
          contact_frequency?: string | null
          country?: string | null
          created_at?: string
          custom_field_1?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_fields?: Json
          deal_value?: number | null
          detected_timezone?: string | null
          discovery_keyword?: string | null
          dnc_added_at?: string | null
          dnc_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          email_ai_confidence?: number | null
          email_ai_reason?: string | null
          email_verified?: boolean
          email_verified_by_ai?: boolean
          facebook_url?: string | null
          geocoded_at?: string | null
          icp_fit_reason?: string | null
          icp_fit_score?: number | null
          icp_matches?: boolean | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          is_dnc_federal?: boolean
          is_dnc_internal?: boolean
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_message_at?: string | null
          last_message_channel?: string | null
          lat?: number | null
          lead_score?: number
          linkedin_url?: string | null
          lng?: number | null
          name?: string
          next_followup_at?: string | null
          notes?: string | null
          opted_out?: boolean
          opted_out_channels?: string[]
          phone?: string | null
          phone_verified?: boolean
          priority?: string | null
          source?: string
          state?: string | null
          tags?: string[]
          team_id: string
          timezone_confidence?: string | null
          timezone_source?: string | null
          title?: string | null
          twitter_url?: string | null
          unread_count?: number
          updated_at?: string
          verification_sources?: string[]
          website?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          ai_verified_at?: string | null
          assigned_to?: string | null
          auto_added_by_discovery?: boolean
          auto_purge_at?: string | null
          city?: string | null
          company?: string | null
          company_id?: string | null
          contact_frequency?: string | null
          country?: string | null
          created_at?: string
          custom_field_1?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_fields?: Json
          deal_value?: number | null
          detected_timezone?: string | null
          discovery_keyword?: string | null
          dnc_added_at?: string | null
          dnc_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          email_ai_confidence?: number | null
          email_ai_reason?: string | null
          email_verified?: boolean
          email_verified_by_ai?: boolean
          facebook_url?: string | null
          geocoded_at?: string | null
          icp_fit_reason?: string | null
          icp_fit_score?: number | null
          icp_matches?: boolean | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          is_dnc_federal?: boolean
          is_dnc_internal?: boolean
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_message_at?: string | null
          last_message_channel?: string | null
          lat?: number | null
          lead_score?: number
          linkedin_url?: string | null
          lng?: number | null
          name?: string
          next_followup_at?: string | null
          notes?: string | null
          opted_out?: boolean
          opted_out_channels?: string[]
          phone?: string | null
          phone_verified?: boolean
          priority?: string | null
          source?: string
          state?: string | null
          tags?: string[]
          team_id?: string
          timezone_confidence?: string | null
          timezone_source?: string | null
          title?: string | null
          twitter_url?: string | null
          unread_count?: number
          updated_at?: string
          verification_sources?: string[]
          website?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: Json
          file_name: string
          id: string
          imported_rows: number
          skipped_rows: number
          started_at: string
          status: string
          team_id: string
          total_rows: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: Json
          file_name: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
          started_at?: string
          status?: string
          team_id: string
          total_rows?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: Json
          file_name?: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
          started_at?: string
          status?: string
          team_id?: string
          total_rows?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_field_defs: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          options: string[] | null
          team_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          label: string
          options?: string[] | null
          team_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: string[] | null
          team_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_suppression_list: {
        Row: {
          added_at: string
          added_by_user_id: string | null
          id: string
          phone_or_email: string
          reason: string | null
          source: string
          team_id: string
          type: string
        }
        Insert: {
          added_at?: string
          added_by_user_id?: string | null
          id?: string
          phone_or_email: string
          reason?: string | null
          source: string
          team_id: string
          type: string
        }
        Update: {
          added_at?: string
          added_by_user_id?: string | null
          id?: string
          phone_or_email?: string
          reason?: string | null
          source?: string
          team_id?: string
          type?: string
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          api_key: string | null
          created_at: string
          daily_limit: number
          from_email: string
          from_name: string | null
          id: string
          is_active: boolean
          label: string | null
          last_sent_date: string | null
          oauth_refresh_token: string | null
          provider: string
          sent_today: number
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          team_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          daily_limit?: number
          from_email: string
          from_name?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_sent_date?: string | null
          oauth_refresh_token?: string | null
          provider: string
          sent_today?: number
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          team_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          daily_limit?: number
          from_email?: string
          from_name?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_sent_date?: string | null
          oauth_refresh_token?: string | null
          provider?: string
          sent_today?: number
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_blocks: {
        Row: {
          blocked_by: string | null
          created_at: string
          email: string
          expires_at: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          reason?: string | null
        }
        Relationships: []
      }
      enrichment_jobs: {
        Row: {
          avg_score_after: number | null
          avg_score_before: number | null
          completed_at: string | null
          created_at: string
          enriched_count: number
          file_name: string | null
          id: string
          linkedin_added: number
          new_emails_found: number
          new_phones_found: number
          rows: Json
          source: string
          status: string
          team_id: string
          total_contacts: number
        }
        Insert: {
          avg_score_after?: number | null
          avg_score_before?: number | null
          completed_at?: string | null
          created_at?: string
          enriched_count?: number
          file_name?: string | null
          id?: string
          linkedin_added?: number
          new_emails_found?: number
          new_phones_found?: number
          rows?: Json
          source?: string
          status?: string
          team_id: string
          total_contacts?: number
        }
        Update: {
          avg_score_after?: number | null
          avg_score_before?: number | null
          completed_at?: string | null
          created_at?: string
          enriched_count?: number
          file_name?: string | null
          id?: string
          linkedin_added?: number
          new_emails_found?: number
          new_phones_found?: number
          rows?: Json
          source?: string
          status?: string
          team_id?: string
          total_contacts?: number
        }
        Relationships: []
      }
      follow_up_sequences: {
        Row: {
          campaign_id: string
          channel: Database["public"]["Enums"]["campaign_type"]
          created_at: string
          delay_days: number
          id: string
          message: string
          message_if_not_opened: string | null
          message_if_opened: string | null
          open_aware: boolean
          step_number: number
          team_id: string
        }
        Insert: {
          campaign_id: string
          channel: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          delay_days?: number
          id?: string
          message?: string
          message_if_not_opened?: string | null
          message_if_opened?: string | null
          open_aware?: boolean
          step_number: number
          team_id: string
        }
        Update: {
          campaign_id?: string
          channel?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          delay_days?: number
          id?: string
          message?: string
          message_if_not_opened?: string | null
          message_if_opened?: string | null
          open_aware?: boolean
          step_number?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_sequences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_search_results: {
        Row: {
          auto_added_to_pipeline: boolean | null
          city: string | null
          company_name: string | null
          confidence_score: number | null
          contact_id: string | null
          country: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          first_name: string | null
          full_name: string
          id: string
          instagram_handle: string | null
          is_new_contact: boolean | null
          last_name: string | null
          linkedin_url: string | null
          phone: string | null
          raw_data: Json | null
          reddit_username: string | null
          role: string | null
          search_id: string
          sources: string[]
          state: string | null
          team_id: string
          twitter_handle: string | null
        }
        Insert: {
          auto_added_to_pipeline?: boolean | null
          city?: string | null
          company_name?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          instagram_handle?: string | null
          is_new_contact?: boolean | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          raw_data?: Json | null
          reddit_username?: string | null
          role?: string | null
          search_id: string
          sources?: string[]
          state?: string | null
          team_id: string
          twitter_handle?: string | null
        }
        Update: {
          auto_added_to_pipeline?: boolean | null
          city?: string | null
          company_name?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          instagram_handle?: string | null
          is_new_contact?: boolean | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          raw_data?: Json | null
          reddit_username?: string | null
          role?: string | null
          search_id?: string
          sources?: string[]
          state?: string | null
          team_id?: string
          twitter_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "individual_search_results_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "individual_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_search_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_searches: {
        Row: {
          auto_added_to_pipeline: number | null
          avg_score: number | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_text: string | null
          id: string
          individuals_found: number
          keyword: string
          location: string | null
          locations_geocoded: Json | null
          map_center_lat: number | null
          map_center_lng: number | null
          platforms: string[]
          served_from_cache: boolean
          sources_failed: Json | null
          sources_success: Json | null
          status: string
          team_id: string
          user_id: string
          verified_count: number
        }
        Insert: {
          auto_added_to_pipeline?: number | null
          avg_score?: number | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_text?: string | null
          id?: string
          individuals_found?: number
          keyword: string
          location?: string | null
          locations_geocoded?: Json | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          platforms?: string[]
          served_from_cache?: boolean
          sources_failed?: Json | null
          sources_success?: Json | null
          status?: string
          team_id: string
          user_id: string
          verified_count?: number
        }
        Update: {
          auto_added_to_pipeline?: number | null
          avg_score?: number | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_text?: string | null
          id?: string
          individuals_found?: number
          keyword?: string
          location?: string | null
          locations_geocoded?: Json | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          platforms?: string[]
          served_from_cache?: boolean
          sources_failed?: Json | null
          sources_success?: Json | null
          status?: string
          team_id?: string
          user_id?: string
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "individual_searches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: Database["public"]["Enums"]["job_status"]
          team_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          status?: Database["public"]["Enums"]["job_status"]
          team_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          status?: Database["public"]["Enums"]["job_status"]
          team_id?: string
        }
        Relationships: []
      }
      login_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          ip_address: string | null
          requested_at: string
          status: string
          user_agent: string | null
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          ip_address?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          ai_suggested: boolean
          body: string
          campaign_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          from_address: string | null
          id: string
          is_opt_out_detected: boolean
          raw_payload: Json
          read_at: string | null
          replied_at: string | null
          status: string
          subject: string | null
          team_id: string
          to_address: string | null
        }
        Insert: {
          ai_suggested?: boolean
          body?: string
          campaign_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          from_address?: string | null
          id?: string
          is_opt_out_detected?: boolean
          raw_payload?: Json
          read_at?: string | null
          replied_at?: string | null
          status?: string
          subject?: string | null
          team_id: string
          to_address?: string | null
        }
        Update: {
          ai_suggested?: boolean
          body?: string
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          from_address?: string | null
          id?: string
          is_opt_out_detected?: boolean
          raw_payload?: Json
          read_at?: string | null
          replied_at?: string | null
          status?: string
          subject?: string | null
          team_id?: string
          to_address?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          next_retry_at: string
          payload: Json
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          team_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          team_id: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          team_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          attempt: number
          channel: string
          created_at: string
          error: string | null
          event_type: string
          id: string
          status: string
          summary: string | null
          team_id: string
          title: string | null
        }
        Insert: {
          attempt?: number
          channel: string
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          status: string
          summary?: string | null
          team_id: string
          title?: string | null
        }
        Update: {
          attempt?: number
          channel?: string
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          status?: string
          summary?: string | null
          team_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          buyer_email: string | null
          created_at: string
          currency: string | null
          id: string
          raw: Json | null
          signup_id: string | null
          status: string
          user_id: string | null
          whop_membership_id: string | null
          whop_payment_id: string | null
          whop_plan_id: string | null
        }
        Insert: {
          amount?: number | null
          buyer_email?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          raw?: Json | null
          signup_id?: string | null
          status: string
          user_id?: string | null
          whop_membership_id?: string | null
          whop_payment_id?: string | null
          whop_plan_id?: string | null
        }
        Update: {
          amount?: number | null
          buyer_email?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          raw?: Json | null
          signup_id?: string | null
          status?: string
          user_id?: string | null
          whop_membership_id?: string | null
          whop_payment_id?: string | null
          whop_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_signup_id_fkey"
            columns: ["signup_id"]
            isOneToOne: false
            referencedRelation: "signups"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_leads: {
        Row: {
          assigned_campaign_id: string | null
          contact_id: string
          created_at: string
          gone_cold: boolean
          id: string
          notes: string | null
          re_engagement_triggered: boolean
          stage_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_campaign_id?: string | null
          contact_id: string
          created_at?: string
          gone_cold?: boolean
          id?: string
          notes?: string | null
          re_engagement_triggered?: boolean
          stage_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_campaign_id?: string | null
          contact_id?: string
          created_at?: string
          gone_cold?: boolean
          id?: string
          notes?: string | null
          re_engagement_triggered?: boolean
          stage_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          team_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          team_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          seats: number
          slug: string
          sort_order: number
          updated_at: string
          whop_checkout_url: string | null
          whop_plan_id: string | null
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_monthly: number
          seats?: number
          slug: string
          sort_order?: number
          updated_at?: string
          whop_checkout_url?: string | null
          whop_plan_id?: string | null
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          seats?: number
          slug?: string
          sort_order?: number
          updated_at?: string
          whop_checkout_url?: string | null
          whop_plan_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          name: string
          onboarding_skipped: boolean
          phone: string | null
          preferred_language: string | null
          team_id: string | null
          timezone: string | null
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          name?: string
          onboarding_skipped?: boolean
          phone?: string | null
          preferred_language?: string | null
          team_id?: string | null
          timezone?: string | null
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          name?: string
          onboarding_skipped?: boolean
          phone?: string | null
          preferred_language?: string | null
          team_id?: string | null
          timezone?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          business_name: string
          created_at: string
          created_by: string | null
          cta_url: string | null
          current_lead_method: string | null
          expires_at: string | null
          first_viewed_at: string | null
          guarantee_text: string | null
          id: string
          industry: string | null
          last_viewed_at: string | null
          location: string | null
          monthly_lead_goal: number | null
          notes: string | null
          package_price: number | null
          package_selected: string | null
          prospect_name: string
          sample_leads: Json
          status: string
          team_id: string
          testimonial: string | null
          token: string
          view_count: number
        }
        Insert: {
          business_name: string
          created_at?: string
          created_by?: string | null
          cta_url?: string | null
          current_lead_method?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          guarantee_text?: string | null
          id?: string
          industry?: string | null
          last_viewed_at?: string | null
          location?: string | null
          monthly_lead_goal?: number | null
          notes?: string | null
          package_price?: number | null
          package_selected?: string | null
          prospect_name: string
          sample_leads?: Json
          status?: string
          team_id: string
          testimonial?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          business_name?: string
          created_at?: string
          created_by?: string | null
          cta_url?: string | null
          current_lead_method?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          guarantee_text?: string | null
          id?: string
          industry?: string | null
          last_viewed_at?: string | null
          location?: string | null
          monthly_lead_goal?: number | null
          notes?: string | null
          package_price?: number | null
          package_selected?: string | null
          prospect_name?: string
          sample_leads?: Json
          status?: string
          team_id?: string
          testimonial?: string | null
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      search_activity: {
        Row: {
          count: number | null
          created_at: string
          icon: string | null
          id: string
          message: string
          percent: number | null
          search_id: string
          status: string
          step: string
          team_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string
          icon?: string | null
          id?: string
          message: string
          percent?: number | null
          search_id: string
          status?: string
          step: string
          team_id: string
        }
        Update: {
          count?: number | null
          created_at?: string
          icon?: string | null
          id?: string
          message?: string
          percent?: number | null
          search_id?: string
          status?: string
          step?: string
          team_id?: string
        }
        Relationships: []
      }
      search_monitors: {
        Row: {
          auto_add_threshold: number
          created_at: string
          created_by: string | null
          frequency: string
          frequency_day: number | null
          id: string
          industry_filter: string | null
          keyword: string
          last_run_at: string | null
          location: string | null
          name: string
          next_run_at: string | null
          notification_prefs: Json
          status: string
          team_id: string
          title_filters: string[]
          total_new_leads: number
          total_runs: number
          updated_at: string
        }
        Insert: {
          auto_add_threshold?: number
          created_at?: string
          created_by?: string | null
          frequency?: string
          frequency_day?: number | null
          id?: string
          industry_filter?: string | null
          keyword: string
          last_run_at?: string | null
          location?: string | null
          name: string
          next_run_at?: string | null
          notification_prefs?: Json
          status?: string
          team_id: string
          title_filters?: string[]
          total_new_leads?: number
          total_runs?: number
          updated_at?: string
        }
        Update: {
          auto_add_threshold?: number
          created_at?: string
          created_by?: string | null
          frequency?: string
          frequency_day?: number | null
          id?: string
          industry_filter?: string | null
          keyword?: string
          last_run_at?: string | null
          location?: string | null
          name?: string
          next_run_at?: string | null
          notification_prefs?: Json
          status?: string
          team_id?: string
          title_filters?: string[]
          total_new_leads?: number
          total_runs?: number
          updated_at?: string
        }
        Relationships: []
      }
      search_results: {
        Row: {
          auto_added_to_pipeline: boolean
          contact_id: string
          created_at: string
          id: string
          is_new: boolean
          raw_sources_data: Json
          search_id: string
          team_id: string
        }
        Insert: {
          auto_added_to_pipeline?: boolean
          contact_id: string
          created_at?: string
          id?: string
          is_new?: boolean
          raw_sources_data?: Json
          search_id: string
          team_id: string
        }
        Update: {
          auto_added_to_pipeline?: boolean
          contact_id?: string
          created_at?: string
          id?: string
          is_new?: boolean
          raw_sources_data?: Json
          search_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      search_results_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          filters: Json
          id: string
          keyword: string
          location: string | null
          payload: Json
          search_type: string
          team_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          filters?: Json
          id?: string
          keyword: string
          location?: string | null
          payload: Json
          search_type: string
          team_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          filters?: Json
          id?: string
          keyword?: string
          location?: string | null
          payload?: Json
          search_type?: string
          team_id?: string
        }
        Relationships: []
      }
      search_steps: {
        Row: {
          completed_at: string | null
          detail: Json
          id: string
          search_id: string
          sources_failed: string[]
          sources_success: string[]
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["search_step_name"]
          sub_status: string | null
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          detail?: Json
          id?: string
          search_id: string
          sources_failed?: string[]
          sources_success?: string[]
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["search_step_name"]
          sub_status?: string | null
          team_id: string
        }
        Update: {
          completed_at?: string | null
          detail?: Json
          id?: string
          search_id?: string
          sources_failed?: string[]
          sources_success?: string[]
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step?: Database["public"]["Enums"]["search_step_name"]
          sub_status?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_steps_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          auto_added_to_pipeline: number
          avg_lead_score: number
          businesses_found: number
          completed_at: string | null
          created_at: string
          decision_makers_found: number
          duplicates: Json
          duplicates_count: number
          duration_seconds: number | null
          error_text: string | null
          id: string
          industry_filter: string | null
          keyword: string
          location: string | null
          locations_geocoded: Json | null
          map_center_lat: number | null
          map_center_lng: number | null
          pattern_verified_emails: number
          served_from_cache: boolean
          sources_failed: Json
          sources_success: Json
          status: Database["public"]["Enums"]["search_status"]
          team_id: string
          title_filters: string[]
          user_id: string
          verified_emails: number
          verified_phones: number
        }
        Insert: {
          auto_added_to_pipeline?: number
          avg_lead_score?: number
          businesses_found?: number
          completed_at?: string | null
          created_at?: string
          decision_makers_found?: number
          duplicates?: Json
          duplicates_count?: number
          duration_seconds?: number | null
          error_text?: string | null
          id?: string
          industry_filter?: string | null
          keyword: string
          location?: string | null
          locations_geocoded?: Json | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          pattern_verified_emails?: number
          served_from_cache?: boolean
          sources_failed?: Json
          sources_success?: Json
          status?: Database["public"]["Enums"]["search_status"]
          team_id: string
          title_filters?: string[]
          user_id: string
          verified_emails?: number
          verified_phones?: number
        }
        Update: {
          auto_added_to_pipeline?: number
          avg_lead_score?: number
          businesses_found?: number
          completed_at?: string | null
          created_at?: string
          decision_makers_found?: number
          duplicates?: Json
          duplicates_count?: number
          duration_seconds?: number | null
          error_text?: string | null
          id?: string
          industry_filter?: string | null
          keyword?: string
          location?: string | null
          locations_geocoded?: Json | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          pattern_verified_emails?: number
          served_from_cache?: boolean
          sources_failed?: Json
          sources_success?: Json
          status?: Database["public"]["Enums"]["search_status"]
          team_id?: string
          title_filters?: string[]
          user_id?: string
          verified_emails?: number
          verified_phones?: number
        }
        Relationships: []
      }
      sending_domains: {
        Row: {
          bounce_rate: number
          created_at: string
          dkim_configured: boolean
          dkim_public_key: string | null
          dmarc_configured: boolean
          domain: string
          health_score: number
          id: string
          spam_rate: number
          spf_configured: boolean
          team_id: string
          tracking_cname_configured: boolean
          warming_status: string
        }
        Insert: {
          bounce_rate?: number
          created_at?: string
          dkim_configured?: boolean
          dkim_public_key?: string | null
          dmarc_configured?: boolean
          domain: string
          health_score?: number
          id?: string
          spam_rate?: number
          spf_configured?: boolean
          team_id: string
          tracking_cname_configured?: boolean
          warming_status?: string
        }
        Update: {
          bounce_rate?: number
          created_at?: string
          dkim_configured?: boolean
          dkim_public_key?: string | null
          dmarc_configured?: boolean
          domain?: string
          health_score?: number
          id?: string
          spam_rate?: number
          spf_configured?: boolean
          team_id?: string
          tracking_cname_configured?: boolean
          warming_status?: string
        }
        Relationships: []
      }
      sending_inboxes: {
        Row: {
          bounce_rate: number
          created_at: string
          daily_limit: number
          days_active: number
          domain_id: string
          email_address: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          sent_today: number
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          spam_rate: number
          team_id: string
          warm_up_stage: number
        }
        Insert: {
          bounce_rate?: number
          created_at?: string
          daily_limit?: number
          days_active?: number
          domain_id: string
          email_address: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          sent_today?: number
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          spam_rate?: number
          team_id: string
          warm_up_stage?: number
        }
        Update: {
          bounce_rate?: number
          created_at?: string
          daily_limit?: number
          days_active?: number
          domain_id?: string
          email_address?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          sent_today?: number
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          spam_rate?: number
          team_id?: string
          warm_up_stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "sending_inboxes_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "sending_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      signups: {
        Row: {
          access_code: string | null
          access_code_expires_at: string | null
          access_code_used_at: string | null
          approved_at: string | null
          approved_by: string | null
          business_type: string | null
          company: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          selected_plan_slug: string | null
          status: string
          team_size: string | null
          updated_at: string
          user_id: string | null
          whop_payment_id: string | null
        }
        Insert: {
          access_code?: string | null
          access_code_expires_at?: string | null
          access_code_used_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          selected_plan_slug?: string | null
          status?: string
          team_size?: string | null
          updated_at?: string
          user_id?: string | null
          whop_payment_id?: string | null
        }
        Update: {
          access_code?: string | null
          access_code_expires_at?: string | null
          access_code_used_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          selected_plan_slug?: string | null
          status?: string
          team_size?: string | null
          updated_at?: string
          user_id?: string | null
          whop_payment_id?: string | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          from_number: string
          id: string
          sent_at: string
          sent_by: string | null
          status: string | null
          team_id: string
          thread_id: string
          to_number: string
          twilio_sid: string | null
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          from_number: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string | null
          team_id: string
          thread_id: string
          to_number: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          from_number?: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string | null
          team_id?: string
          thread_id?: string
          to_number?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "sms_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_threads: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          last_message_at: string
          last_preview: string | null
          phone_number: string
          team_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_preview?: string | null
          phone_number: string
          team_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_preview?: string | null
          phone_number?: string
          team_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_threads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subdomain_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          denial_reason: string | null
          id: string
          requested_by: string
          status: string
          subdomain: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          denial_reason?: string | null
          id?: string
          requested_by: string
          status?: string
          subdomain: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          denial_reason?: string | null
          id?: string
          requested_by?: string
          status?: string
          subdomain?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subdomain_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_slug: string | null
          seats: number | null
          status: string
          updated_at: string
          user_id: string | null
          whop_membership_id: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_slug?: string | null
          seats?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whop_membership_id?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_slug?: string | null
          seats?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whop_membership_id?: string | null
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_notified_at: string | null
          completed_at: string | null
          completion_notes: string | null
          contact_id: string | null
          created_at: string
          created_by_user_id: string | null
          due_at: string | null
          id: string
          notes: string | null
          priority: string
          reminder_offset_minutes: number | null
          reminder_sent_at: string | null
          source: string
          status: string
          task_type: string
          team_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          assigned_notified_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reminder_offset_minutes?: number | null
          reminder_sent_at?: string | null
          source?: string
          status?: string
          task_type?: string
          team_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          assigned_notified_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reminder_offset_minutes?: number | null
          reminder_sent_at?: string | null
          source?: string
          status?: string
          task_type?: string
          team_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_dialer_providers: {
        Row: {
          created_at: string
          credentials: Json
          display_name: string | null
          from_number: string | null
          id: string
          is_active: boolean
          provider: Database["public"]["Enums"]["dialer_provider"]
          team_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          credentials?: Json
          display_name?: string | null
          from_number?: string | null
          id?: string
          is_active?: boolean
          provider: Database["public"]["Enums"]["dialer_provider"]
          team_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          credentials?: Json
          display_name?: string | null
          from_number?: string | null
          id?: string
          is_active?: boolean
          provider?: Database["public"]["Enums"]["dialer_provider"]
          team_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_dialer_providers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          team_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          team_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_settings: {
        Row: {
          account_timezone: string
          ai_ark_endpoint: string | null
          ai_ark_key: string | null
          ai_features_enabled: Json
          ai_generations_reset_at: string | null
          ai_generations_this_month: number
          ai_model: string
          ai_provider: string
          apify_actor_id: string | null
          apify_key: string | null
          apollo_key: string | null
          attom_api_key: string | null
          auto_carrier_lookup: boolean
          auto_create_companies: boolean
          auto_pipeline_threshold: number
          batch_skip_trace_key: string | null
          batchleads_api_key: string | null
          blocked_keywords: string[]
          carrier_lookup_key: string | null
          carrier_lookup_provider: string | null
          claude_api_key: string | null
          clay_key: string | null
          clearbit_api_key: string | null
          cold_lead_days: number
          created_at: string
          daily_email_limit: number
          default_subreddits: string[]
          discord_channel_id: string | null
          discord_server_id: string | null
          discord_webhook_url: string | null
          dnc_api_key: string | null
          dnc_api_provider: string | null
          dnc_last_scrub: string | null
          email_verification_provider: string | null
          enforce_tcpa_hours: boolean
          facebook_api_key: string | null
          firecrawl_api_key: string | null
          gmail_connected: boolean
          gmail_email: string | null
          google_maps_key: string | null
          hunter_api_key: string | null
          icp_definition: string | null
          id: string
          idi_endpoint_url: string | null
          idi_request_template: Json | null
          inbound_email_poll_interval_minutes: number
          inbox_sms_webhook_secret: string | null
          leads_gorilla_key: string | null
          linkedin_dm_count_today: number
          linkedin_dm_reset_at: string | null
          linkedin_session: string | null
          lusha_api_key: string | null
          make_webhook_url: string | null
          meta_fb_page: Json | null
          meta_ig_account: Json | null
          meta_token: string | null
          mxtoolbox_api_key: string | null
          n8n_webhook_url: string | null
          neverbounce_api_key: string | null
          notification_prefs: Json
          propstream_api_key: string | null
          proxy_api_key: string | null
          proxy_provider: string | null
          proxy_url: string | null
          reddit_client_id: string | null
          respect_robots: boolean
          rocketreach_api_key: string | null
          seamless_key: string | null
          sending_strategy: string
          serper_api_key: string | null
          signalwire_from: string | null
          signalwire_project: string | null
          signalwire_space: string | null
          signalwire_token: string | null
          skip_trace_key: string | null
          skip_trace_key_2: string | null
          skip_trace_key_3: string | null
          skip_trace_key_4: string | null
          skip_trace_key_5: string | null
          skip_trace_provider_2: string | null
          skip_trace_provider_3: string | null
          skip_trace_provider_4: string | null
          skip_trace_provider_5: string | null
          skip_trace_waterfall_order: string[]
          slack_webhook: string | null
          sms_opt_out_footer: string
          sms_provider: string | null
          sms_template_a: string | null
          sms_template_b: string | null
          sms_template_c: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_provider: string | null
          smtp_user: string | null
          team_id: string
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          telnyx_from: string | null
          telnyx_key: string | null
          trestle_api_key: string | null
          twilio_from: string | null
          twilio_sid: string | null
          twilio_token: string | null
          updated_at: string
          whatsapp_access_token: string | null
          whatsapp_business_id: string | null
          whatsapp_connected: boolean
          whatsapp_default_to: string | null
          whatsapp_phone_id: string | null
          zerobounce_api_key: string | null
        }
        Insert: {
          account_timezone?: string
          ai_ark_endpoint?: string | null
          ai_ark_key?: string | null
          ai_features_enabled?: Json
          ai_generations_reset_at?: string | null
          ai_generations_this_month?: number
          ai_model?: string
          ai_provider?: string
          apify_actor_id?: string | null
          apify_key?: string | null
          apollo_key?: string | null
          attom_api_key?: string | null
          auto_carrier_lookup?: boolean
          auto_create_companies?: boolean
          auto_pipeline_threshold?: number
          batch_skip_trace_key?: string | null
          batchleads_api_key?: string | null
          blocked_keywords?: string[]
          carrier_lookup_key?: string | null
          carrier_lookup_provider?: string | null
          claude_api_key?: string | null
          clay_key?: string | null
          clearbit_api_key?: string | null
          cold_lead_days?: number
          created_at?: string
          daily_email_limit?: number
          default_subreddits?: string[]
          discord_channel_id?: string | null
          discord_server_id?: string | null
          discord_webhook_url?: string | null
          dnc_api_key?: string | null
          dnc_api_provider?: string | null
          dnc_last_scrub?: string | null
          email_verification_provider?: string | null
          enforce_tcpa_hours?: boolean
          facebook_api_key?: string | null
          firecrawl_api_key?: string | null
          gmail_connected?: boolean
          gmail_email?: string | null
          google_maps_key?: string | null
          hunter_api_key?: string | null
          icp_definition?: string | null
          id?: string
          idi_endpoint_url?: string | null
          idi_request_template?: Json | null
          inbound_email_poll_interval_minutes?: number
          inbox_sms_webhook_secret?: string | null
          leads_gorilla_key?: string | null
          linkedin_dm_count_today?: number
          linkedin_dm_reset_at?: string | null
          linkedin_session?: string | null
          lusha_api_key?: string | null
          make_webhook_url?: string | null
          meta_fb_page?: Json | null
          meta_ig_account?: Json | null
          meta_token?: string | null
          mxtoolbox_api_key?: string | null
          n8n_webhook_url?: string | null
          neverbounce_api_key?: string | null
          notification_prefs?: Json
          propstream_api_key?: string | null
          proxy_api_key?: string | null
          proxy_provider?: string | null
          proxy_url?: string | null
          reddit_client_id?: string | null
          respect_robots?: boolean
          rocketreach_api_key?: string | null
          seamless_key?: string | null
          sending_strategy?: string
          serper_api_key?: string | null
          signalwire_from?: string | null
          signalwire_project?: string | null
          signalwire_space?: string | null
          signalwire_token?: string | null
          skip_trace_key?: string | null
          skip_trace_key_2?: string | null
          skip_trace_key_3?: string | null
          skip_trace_key_4?: string | null
          skip_trace_key_5?: string | null
          skip_trace_provider_2?: string | null
          skip_trace_provider_3?: string | null
          skip_trace_provider_4?: string | null
          skip_trace_provider_5?: string | null
          skip_trace_waterfall_order?: string[]
          slack_webhook?: string | null
          sms_opt_out_footer?: string
          sms_provider?: string | null
          sms_template_a?: string | null
          sms_template_b?: string | null
          sms_template_c?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_provider?: string | null
          smtp_user?: string | null
          team_id: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telnyx_from?: string | null
          telnyx_key?: string | null
          trestle_api_key?: string | null
          twilio_from?: string | null
          twilio_sid?: string | null
          twilio_token?: string | null
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_business_id?: string | null
          whatsapp_connected?: boolean
          whatsapp_default_to?: string | null
          whatsapp_phone_id?: string | null
          zerobounce_api_key?: string | null
        }
        Update: {
          account_timezone?: string
          ai_ark_endpoint?: string | null
          ai_ark_key?: string | null
          ai_features_enabled?: Json
          ai_generations_reset_at?: string | null
          ai_generations_this_month?: number
          ai_model?: string
          ai_provider?: string
          apify_actor_id?: string | null
          apify_key?: string | null
          apollo_key?: string | null
          attom_api_key?: string | null
          auto_carrier_lookup?: boolean
          auto_create_companies?: boolean
          auto_pipeline_threshold?: number
          batch_skip_trace_key?: string | null
          batchleads_api_key?: string | null
          blocked_keywords?: string[]
          carrier_lookup_key?: string | null
          carrier_lookup_provider?: string | null
          claude_api_key?: string | null
          clay_key?: string | null
          clearbit_api_key?: string | null
          cold_lead_days?: number
          created_at?: string
          daily_email_limit?: number
          default_subreddits?: string[]
          discord_channel_id?: string | null
          discord_server_id?: string | null
          discord_webhook_url?: string | null
          dnc_api_key?: string | null
          dnc_api_provider?: string | null
          dnc_last_scrub?: string | null
          email_verification_provider?: string | null
          enforce_tcpa_hours?: boolean
          facebook_api_key?: string | null
          firecrawl_api_key?: string | null
          gmail_connected?: boolean
          gmail_email?: string | null
          google_maps_key?: string | null
          hunter_api_key?: string | null
          icp_definition?: string | null
          id?: string
          idi_endpoint_url?: string | null
          idi_request_template?: Json | null
          inbound_email_poll_interval_minutes?: number
          inbox_sms_webhook_secret?: string | null
          leads_gorilla_key?: string | null
          linkedin_dm_count_today?: number
          linkedin_dm_reset_at?: string | null
          linkedin_session?: string | null
          lusha_api_key?: string | null
          make_webhook_url?: string | null
          meta_fb_page?: Json | null
          meta_ig_account?: Json | null
          meta_token?: string | null
          mxtoolbox_api_key?: string | null
          n8n_webhook_url?: string | null
          neverbounce_api_key?: string | null
          notification_prefs?: Json
          propstream_api_key?: string | null
          proxy_api_key?: string | null
          proxy_provider?: string | null
          proxy_url?: string | null
          reddit_client_id?: string | null
          respect_robots?: boolean
          rocketreach_api_key?: string | null
          seamless_key?: string | null
          sending_strategy?: string
          serper_api_key?: string | null
          signalwire_from?: string | null
          signalwire_project?: string | null
          signalwire_space?: string | null
          signalwire_token?: string | null
          skip_trace_key?: string | null
          skip_trace_key_2?: string | null
          skip_trace_key_3?: string | null
          skip_trace_key_4?: string | null
          skip_trace_key_5?: string | null
          skip_trace_provider_2?: string | null
          skip_trace_provider_3?: string | null
          skip_trace_provider_4?: string | null
          skip_trace_provider_5?: string | null
          skip_trace_waterfall_order?: string[]
          slack_webhook?: string | null
          sms_opt_out_footer?: string
          sms_provider?: string | null
          sms_template_a?: string | null
          sms_template_b?: string | null
          sms_template_c?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_provider?: string | null
          smtp_user?: string | null
          team_id?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telnyx_from?: string | null
          telnyx_key?: string | null
          trestle_api_key?: string | null
          twilio_from?: string | null
          twilio_sid?: string | null
          twilio_token?: string | null
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_business_id?: string | null
          whatsapp_connected?: boolean
          whatsapp_default_to?: string | null
          whatsapp_phone_id?: string | null
          zerobounce_api_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          contact_limit: number
          created_at: string
          custom_domain: string | null
          foundation_owner_id: string | null
          id: string
          name: string
          owner_id: string
          parent_team_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          seat_limit: number
          subdomain: string | null
          white_label_color: string | null
          white_label_logo: string | null
          white_label_name: string | null
          white_label_secondary_color: string | null
        }
        Insert: {
          contact_limit?: number
          created_at?: string
          custom_domain?: string | null
          foundation_owner_id?: string | null
          id?: string
          name: string
          owner_id: string
          parent_team_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          seat_limit?: number
          subdomain?: string | null
          white_label_color?: string | null
          white_label_logo?: string | null
          white_label_name?: string | null
          white_label_secondary_color?: string | null
        }
        Update: {
          contact_limit?: number
          created_at?: string
          custom_domain?: string | null
          foundation_owner_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          parent_team_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          seat_limit?: number
          subdomain?: string | null
          white_label_color?: string | null
          white_label_logo?: string | null
          white_label_name?: string | null
          white_label_secondary_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          agent_id: string
          created_at: string
          duration_seconds: number
          id: string
          notes: string | null
          team_id: string
          title: string | null
          transcript: Json
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          notes?: string | null
          team_id: string
          title?: string | null
          transcript?: Json
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          notes?: string | null
          team_id?: string
          title?: string | null
          transcript?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          section_access: Json | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          section_access?: Json | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          section_access?: Json | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_agents: {
        Row: {
          avg_duration_seconds: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          language: string
          name: string
          script: string
          status: string
          system_prompt: string
          team_id: string
          total_calls: number
          total_connected: number
          total_converted: number
          updated_at: string
          voice_id: string
          voice_provider: string
        }
        Insert: {
          avg_duration_seconds?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          language?: string
          name: string
          script?: string
          status?: string
          system_prompt?: string
          team_id: string
          total_calls?: number
          total_connected?: number
          total_converted?: number
          updated_at?: string
          voice_id?: string
          voice_provider?: string
        }
        Update: {
          avg_duration_seconds?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          language?: string
          name?: string
          script?: string
          status?: string
          system_prompt?: string
          team_id?: string
          total_calls?: number
          total_connected?: number
          total_converted?: number
          updated_at?: string
          voice_id?: string
          voice_provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_agents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      whop_purchases: {
        Row: {
          created_at: string
          email: string
          id: string
          raw_payload: Json | null
          status: string
          tier: string
          updated_at: string
          whop_membership_id: string | null
          whop_session_id: string | null
          whop_user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          raw_payload?: Json | null
          status?: string
          tier: string
          updated_at?: string
          whop_membership_id?: string | null
          whop_session_id?: string | null
          whop_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          raw_payload?: Json | null
          status?: string
          tier?: string
          updated_at?: string
          whop_membership_id?: string | null
          whop_session_id?: string | null
          whop_user_id?: string | null
        }
        Relationships: []
      }
      workflow_instances: {
        Row: {
          completed_at: string | null
          contact_id: string
          current_step: number
          id: string
          started_at: string
          status: string
          stop_reason: string | null
          team_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          current_step?: number
          id?: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          team_id: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          current_step?: number
          id?: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          team_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          contacts_matched: number
          contacts_processed: number
          error_log: Json
          errors: number
          id: string
          started_at: string
          status: string
          team_id: string
          trigger_source: string
          triggered_by: string | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          contacts_matched?: number
          contacts_processed?: number
          error_log?: Json
          errors?: number
          id?: string
          started_at?: string
          status?: string
          team_id: string
          trigger_source?: string
          triggered_by?: string | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          contacts_matched?: number
          contacts_processed?: number
          error_log?: Json
          errors?: number
          id?: string
          started_at?: string
          status?: string
          team_id?: string
          trigger_source?: string
          triggered_by?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          enabled: boolean
          id: string
          last_run_at: string | null
          last_run_stats: Json
          name: string
          status: string
          steps: Json
          stop_conditions: Json
          team_id: string
          template_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_stats?: Json
          name: string
          status?: string
          steps?: Json
          stop_conditions?: Json
          team_id: string
          template_id?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_stats?: Json
          name?: string
          status?: string
          steps?: Json
          stop_conditions?: Json
          team_id?: string
          template_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_login_request: { Args: { _request_id: string }; Returns: Json }
      can_act_as_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      claim_jobs: {
        Args: { _job_types?: string[]; _limit?: number }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: Database["public"]["Enums"]["job_status"]
          team_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clear_team_switch: { Args: never; Returns: undefined }
      count_team_seats: { Args: { _team_id: string }; Returns: number }
      create_sub_account: {
        Args: {
          _name: string
          _plan?: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: {
          contact_limit: number
          created_at: string
          custom_domain: string | null
          foundation_owner_id: string | null
          id: string
          name: string
          owner_id: string
          parent_team_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          seat_limit: number
          subdomain: string | null
          white_label_color: string | null
          white_label_logo: string | null
          white_label_name: string | null
          white_label_secondary_color: string | null
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deny_login_request: {
        Args: { _reason?: string; _request_id: string }
        Returns: Json
      }
      email_has_account: { Args: { _email: string }; Returns: boolean }
      get_user_team: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _team_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_foundation_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_admin: {
        Args: { _child_team_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      purge_expired_discovery_contacts: { Args: never; Returns: number }
      request_login: {
        Args: { _email: string; _ip?: string; _user_agent?: string }
        Returns: Json
      }
      reserve_email_account: { Args: { p_team_id: string }; Returns: string }
      switch_team: {
        Args: { _team_id: string }
        Returns: {
          contact_limit: number
          created_at: string
          custom_domain: string | null
          foundation_owner_id: string | null
          id: string
          name: string
          owner_id: string
          parent_team_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          seat_limit: number
          subdomain: string | null
          white_label_color: string | null
          white_label_logo: string | null
          white_label_name: string | null
          white_label_secondary_color: string | null
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_foundation_owner: {
        Args: { _new_owner_id: string; _team_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      campaign_status: "draft" | "scheduled" | "running" | "paused" | "complete"
      campaign_type: "email" | "sms" | "linkedin" | "instagram" | "facebook"
      contact_status:
        | "pending"
        | "sent"
        | "delivered"
        | "opened"
        | "replied"
        | "bounced"
        | "failed"
      dialer_provider:
        | "twilio"
        | "telnyx"
        | "bandwidth"
        | "vonage"
        | "plivo"
        | "signalwire"
        | "custom_sip"
      email_source_type: "direct" | "pattern_generated"
      email_verify_status: "verified" | "unverified" | "invalid" | "pending"
      job_status: "pending" | "running" | "complete" | "failed" | "retry"
      phone_type: "mobile" | "direct" | "office" | "unknown"
      plan_tier: "starter" | "growth" | "agency"
      search_status: "pending" | "running" | "complete" | "failed" | "partial"
      search_step_name:
        | "business"
        | "decisionmakers"
        | "social"
        | "skiptrace"
        | "verify"
        | "score"
        | "finalize"
      step_status: "pending" | "running" | "complete" | "failed" | "skipped"
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
      app_role: ["admin", "manager", "agent"],
      campaign_status: ["draft", "scheduled", "running", "paused", "complete"],
      campaign_type: ["email", "sms", "linkedin", "instagram", "facebook"],
      contact_status: [
        "pending",
        "sent",
        "delivered",
        "opened",
        "replied",
        "bounced",
        "failed",
      ],
      dialer_provider: [
        "twilio",
        "telnyx",
        "bandwidth",
        "vonage",
        "plivo",
        "signalwire",
        "custom_sip",
      ],
      email_source_type: ["direct", "pattern_generated"],
      email_verify_status: ["verified", "unverified", "invalid", "pending"],
      job_status: ["pending", "running", "complete", "failed", "retry"],
      phone_type: ["mobile", "direct", "office", "unknown"],
      plan_tier: ["starter", "growth", "agency"],
      search_status: ["pending", "running", "complete", "failed", "partial"],
      search_step_name: [
        "business",
        "decisionmakers",
        "social",
        "skiptrace",
        "verify",
        "score",
        "finalize",
      ],
      step_status: ["pending", "running", "complete", "failed", "skipped"],
    },
  },
} as const
