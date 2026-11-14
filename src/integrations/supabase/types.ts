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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assistant_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          ui_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
          ui_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          ui_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_ai_notes: {
        Row: {
          call_id: string
          contact_last_at: string | null
          follow_up: boolean
          generated_at: string
          note: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          call_id: string
          contact_last_at?: string | null
          follow_up?: boolean
          generated_at?: string
          note: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          call_id?: string
          contact_last_at?: string | null
          follow_up?: boolean
          generated_at?: string
          note?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_notes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          contact_name: string | null
          created_at: string
          device_id: string
          device_name: string | null
          direction: string
          duration_seconds: number
          external_id: string
          id: string
          is_video: boolean
          phone_number: string | null
          sim_label: string | null
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          device_id: string
          device_name?: string | null
          direction: string
          duration_seconds?: number
          external_id: string
          id?: string
          is_video?: boolean
          phone_number?: string | null
          sim_label?: string | null
          source: string
          started_at: string
          user_id?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          direction?: string
          duration_seconds?: number
          external_id?: string
          id?: string
          is_video?: boolean
          phone_number?: string | null
          sim_label?: string | null
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_digests: {
        Row: {
          day: string
          generated_at: string
          summary: string
        }
        Insert: {
          day: string
          generated_at?: string
          summary: string
        }
        Update: {
          day?: string
          generated_at?: string
          summary?: string
        }
        Relationships: []
      }
      device_upload_tokens: {
        Row: {
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          token_hash: string
          user_id?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_setup_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          issued_by: string
          staff_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by: string
          staff_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string
          staff_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_setup_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_setup_codes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      support_ai_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          citations: Json
          created_at: string
          created_by: string
          id: string
          kind: string
          mode: string
          status: string
          team_id: string
          ticket_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          citations?: Json
          created_at?: string
          created_by?: string
          id?: string
          kind: string
          mode: string
          status?: string
          team_id: string
          ticket_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          citations?: Json
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          mode?: string
          status?: string
          team_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ai_drafts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ai_drafts_team_id_ticket_id_fkey"
            columns: ["team_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["team_id", "id"]
          },
        ]
      }
      support_article_versions: {
        Row: {
          article_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          source_url: string
          state: string
          team_id: string
          title: string
          version: number
        }
        Insert: {
          article_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          source_url: string
          state: string
          team_id: string
          title: string
          version: number
        }
        Update: {
          article_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          source_url?: string
          state?: string
          team_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_article_versions_team_id_article_id_fkey"
            columns: ["team_id", "article_id"]
            isOneToOne: false
            referencedRelation: "support_articles"
            referencedColumns: ["team_id", "id"]
          },
          {
            foreignKeyName: "support_article_versions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_articles: {
        Row: {
          body: string
          category: string
          id: string
          source_url: string
          state: string
          team_id: string
          title: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          body: string
          category?: string
          id?: string
          source_url?: string
          state?: string
          team_id: string
          title: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Update: {
          body?: string
          category?: string
          id?: string
          source_url?: string
          state?: string
          team_id?: string
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_articles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          content_base64: string
          created_at: string
          created_by: string
          id: string
          mime: string
          name: string
          size_bytes: number
          team_id: string
          ticket_id: string
        }
        Insert: {
          content_base64: string
          created_at?: string
          created_by?: string
          id?: string
          mime: string
          name: string
          size_bytes: number
          team_id: string
          ticket_id: string
        }
        Update: {
          content_base64?: string
          created_at?: string
          created_by?: string
          id?: string
          mime?: string
          name?: string
          size_bytes?: number
          team_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_team_id_ticket_id_fkey"
            columns: ["team_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["team_id", "id"]
          },
        ]
      }
      support_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          team_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          team_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_audit_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_call_ai_control: {
        Row: {
          last_success_at: string | null
          lease_token: string | null
          lease_until: string | null
          pause_reason: string | null
          paused: boolean
          team_id: string
        }
        Insert: {
          last_success_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          team_id: string
        }
        Update: {
          last_success_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_call_ai_control_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_call_ai_jobs: {
        Row: {
          call_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          lease_token: string | null
          reply: string | null
          state: string
          summary: string | null
          team_id: string
          ticket_id: string | null
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lease_token?: string | null
          reply?: string | null
          state?: string
          summary?: string | null
          team_id: string
          ticket_id?: string | null
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lease_token?: string | null
          reply?: string | null
          state?: string
          summary?: string | null
          team_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_call_ai_jobs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_call_ai_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_call_ai_jobs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_customer_contacts: {
        Row: {
          customer_id: string
          email: string
          phone: string
          team_id: string
        }
        Insert: {
          customer_id: string
          email?: string
          phone?: string
          team_id: string
        }
        Update: {
          customer_id?: string
          email?: string
          phone?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_customer_contacts_team_id_customer_id_fkey"
            columns: ["team_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["team_id", "id"]
          },
          {
            foreignKeyName: "support_customer_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_customers: {
        Row: {
          communication_preference: string
          consent: boolean
          created_at: string
          id: string
          name: string
          notes: string
          phone_last4: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          communication_preference?: string
          consent?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone_last4?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          communication_preference?: string
          consent?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone_last4?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_customers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_members: {
        Row: {
          display_name: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          ai_draft_id: string | null
          author_id: string
          body: string
          created_at: string
          delivery_state: string
          id: string
          request_key: string
          team_id: string
          ticket_id: string
          visibility: string
        }
        Insert: {
          ai_draft_id?: string | null
          author_id?: string
          body: string
          created_at?: string
          delivery_state?: string
          id?: string
          request_key: string
          team_id: string
          ticket_id: string
          visibility: string
        }
        Update: {
          ai_draft_id?: string | null
          author_id?: string
          body?: string
          created_at?: string
          delivery_state?: string
          id?: string
          request_key?: string
          team_id?: string
          ticket_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_team_id_ai_draft_id_fkey"
            columns: ["team_id", "ai_draft_id"]
            isOneToOne: false
            referencedRelation: "support_ai_drafts"
            referencedColumns: ["team_id", "id"]
          },
          {
            foreignKeyName: "support_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_team_id_ticket_id_fkey"
            columns: ["team_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["team_id", "id"]
          },
        ]
      }
      support_teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          settings: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          settings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "support_teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          call_id: string | null
          category: string
          channel: string
          created_at: string
          created_by: string
          customer_id: string | null
          description: string
          first_response_at: string | null
          id: string
          merged_into: string | null
          priority: string
          reopen_count: number
          request_key: string
          resolved_at: string | null
          revision: number
          sla_due_at: string
          status: string
          subject: string
          tags: string[]
          team_id: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          call_id?: string | null
          category?: string
          channel?: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          merged_into?: string | null
          priority?: string
          reopen_count?: number
          request_key: string
          resolved_at?: string | null
          revision?: number
          sla_due_at: string
          status?: string
          subject: string
          tags?: string[]
          team_id: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          call_id?: string | null
          category?: string
          channel?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          merged_into?: string | null
          priority?: string
          reopen_count?: number
          request_key?: string
          resolved_at?: string | null
          revision?: number
          sla_due_at?: string
          status?: string
          subject?: string
          tags?: string[]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_team_id_assignee_id_fkey"
            columns: ["team_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "support_members"
            referencedColumns: ["team_id", "user_id"]
          },
          {
            foreignKeyName: "support_tickets_team_id_customer_id_fkey"
            columns: ["team_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["team_id", "id"]
          },
          {
            foreignKeyName: "support_tickets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_team_id_merged_into_fkey"
            columns: ["team_id", "merged_into"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["team_id", "id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_phone_setup_code: { Args: { _hash: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      support_available_people: {
        Args: { _team: string }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      support_claim_call_ai: {
        Args: { _team: string; _token: string }
        Returns: {
          call_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          lease_token: string | null
          reply: string | null
          state: string
          summary: string | null
          team_id: string
          ticket_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "support_call_ai_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      support_customer_case: {
        Args: {
          _body: string
          _customer: string
          _key: string
          _subject: string
        }
        Returns: string
      }
      support_finish_call_ai: {
        Args: {
          _citations: Json
          _job: string
          _reply: string
          _summary: string
          _token: string
        }
        Returns: string
      }
      support_mark_read: { Args: { _ticket: string }; Returns: undefined }
      support_mutate: {
        Args: { _action: string; _payload: Json; _team: string }
        Returns: string
      }
      support_portal: { Args: never; Returns: Json }
      support_role: { Args: { _team: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "member"],
    },
  },
} as const
