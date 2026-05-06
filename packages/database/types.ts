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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip_hash: string | null
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          resource_id: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          client: string
          created_at: string
          display_order: number
          id: string
          industries: string[]
          is_active: boolean
          logo_big: string | null
          logo_sm: string | null
          paragraph_1: string | null
          paragraph_2: string | null
          program_tags: string[]
          stats: Json
          tag: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client: string
          created_at?: string
          display_order?: number
          id: string
          industries?: string[]
          is_active?: boolean
          logo_big?: string | null
          logo_sm?: string | null
          paragraph_1?: string | null
          paragraph_2?: string | null
          program_tags?: string[]
          stats?: Json
          tag?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client?: string
          created_at?: string
          display_order?: number
          id?: string
          industries?: string[]
          is_active?: boolean
          logo_big?: string | null
          logo_sm?: string | null
          paragraph_1?: string | null
          paragraph_2?: string | null
          program_tags?: string[]
          stats?: Json
          tag?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_persons: {
        Row: {
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          email?: string | null
          id: string
          is_active?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_persons_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          email: string
          executed_at: string | null
          executed_by: string | null
          id: string
          notes: string | null
          reason: string | null
          reject_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deletion_status"]
        }
        Insert: {
          email: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reject_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deletion_status"]
        }
        Update: {
          email?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reject_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deletion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_clauses: {
        Row: {
          is_current: boolean
          text: string
          text_hash: string
          valid_from: string
          version: string
        }
        Insert: {
          is_current?: boolean
          text: string
          text_hash: string
          valid_from?: string
          version: string
        }
        Update: {
          is_current?: boolean
          text?: string
          text_hash?: string
          valid_from?: string
          version?: string
        }
        Relationships: []
      }
      ip_hash_salts: {
        Row: {
          rotated_at: string
          salt: string
          version: number
        }
        Insert: {
          rotated_at?: string
          salt: string
          version?: never
        }
        Update: {
          rotated_at?: string
          salt?: string
          version?: never
        }
        Relationships: []
      }
      offer_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          ip_hash: string | null
          ip_salt_version: number | null
          offer_id: string
          payload: Json
          type: Database["public"]["Enums"]["event_type"]
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          ip_salt_version?: number | null
          offer_id: string
          payload?: Json
          type: Database["public"]["Enums"]["event_type"]
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          ip_salt_version?: number | null
          offer_id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["event_type"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_events_ip_salt_version_fkey"
            columns: ["ip_salt_version"]
            isOneToOne: false
            referencedRelation: "ip_hash_salts"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "offer_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          accepted_fee: number | null
          accepted_variant:
            | Database["public"]["Enums"]["pricing_variant"]
            | null
          assigned_consultant_id: string | null
          case_study_id: string | null
          client_comment: string | null
          client_company_size: string | null
          client_industry: string | null
          client_name: string
          client_nip: string | null
          client_token: string
          client_voivodeship: string | null
          contact_person_id: string | null
          content: Json
          created_at: string
          created_by: string
          deleted_at: string | null
          expires_at: string | null
          first_viewed_at: string | null
          funding_rate: number
          gdpr_accepted_at: string | null
          gdpr_clause_version: string | null
          gdpr_text_hash: string | null
          id: string
          last_viewed_at: string | null
          offer_number: string
          offered_variants: Database["public"]["Enums"]["pricing_variant"][]
          pricing_override: Json
          pricing_snapshot: Json
          program_custom_name: string | null
          program_id: string | null
          program_label: string
          project_count: number
          project_value: number
          reject_reason: string | null
          rejected_at: string | null
          rejected_by_email: string | null
          rejected_by_name: string | null
          returning_client: boolean
          selected_variant: Database["public"]["Enums"]["pricing_variant"]
          sent_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
          view_count: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_fee?: number | null
          accepted_variant?:
            | Database["public"]["Enums"]["pricing_variant"]
            | null
          assigned_consultant_id?: string | null
          case_study_id?: string | null
          client_comment?: string | null
          client_company_size?: string | null
          client_industry?: string | null
          client_name: string
          client_nip?: string | null
          client_token?: string
          client_voivodeship?: string | null
          contact_person_id?: string | null
          content?: Json
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          funding_rate: number
          gdpr_accepted_at?: string | null
          gdpr_clause_version?: string | null
          gdpr_text_hash?: string | null
          id?: string
          last_viewed_at?: string | null
          offer_number: string
          offered_variants?: Database["public"]["Enums"]["pricing_variant"][]
          pricing_override?: Json
          pricing_snapshot: Json
          program_custom_name?: string | null
          program_id?: string | null
          program_label: string
          project_count?: number
          project_value: number
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by_email?: string | null
          rejected_by_name?: string | null
          returning_client?: boolean
          selected_variant?: Database["public"]["Enums"]["pricing_variant"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          view_count?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_fee?: number | null
          accepted_variant?:
            | Database["public"]["Enums"]["pricing_variant"]
            | null
          assigned_consultant_id?: string | null
          case_study_id?: string | null
          client_comment?: string | null
          client_company_size?: string | null
          client_industry?: string | null
          client_name?: string
          client_nip?: string | null
          client_token?: string
          client_voivodeship?: string | null
          contact_person_id?: string | null
          content?: Json
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          funding_rate?: number
          gdpr_accepted_at?: string | null
          gdpr_clause_version?: string | null
          gdpr_text_hash?: string | null
          id?: string
          last_viewed_at?: string | null
          offer_number?: string
          offered_variants?: Database["public"]["Enums"]["pricing_variant"][]
          pricing_override?: Json
          pricing_snapshot?: Json
          program_custom_name?: string | null
          program_id?: string | null
          program_label?: string
          project_count?: number
          project_value?: number
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by_email?: string | null
          rejected_by_name?: string | null
          returning_client?: boolean
          selected_variant?: Database["public"]["Enums"]["pricing_variant"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_case_study_id_fkey"
            columns: ["case_study_id"]
            isOneToOne: false
            referencedRelation: "case_studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_gdpr_clause_version_fkey"
            columns: ["gdpr_clause_version"]
            isOneToOne: false
            referencedRelation: "gdpr_clauses"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          crm_enabled_targets: string[]
          crm_hubspot_token: string | null
          crm_pipedrive_token: string | null
          id: string
          loyalty_discount: number
          min_base_fee: number
          min_sf_amount: number
          multi_discount: number
          updated_at: string
        }
        Insert: {
          crm_enabled_targets?: string[]
          crm_hubspot_token?: string | null
          crm_pipedrive_token?: string | null
          id?: string
          loyalty_discount?: number
          min_base_fee?: number
          min_sf_amount?: number
          multi_discount?: number
          updated_at?: string
        }
        Update: {
          crm_enabled_targets?: string[]
          crm_hubspot_token?: string | null
          crm_pipedrive_token?: string | null
          id?: string
          loyalty_discount?: number
          min_base_fee?: number
          min_sf_amount?: number
          multi_discount?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_segments: {
        Row: {
          base_fee: number
          created_at: string
          display_order: number
          funding_max: number | null
          funding_min: number
          id: string
          label: string
          monthly_fee: number
          sf_variant_1: number
          sf_variant_2: number
          sf_variant_3: number
          updated_at: string
        }
        Insert: {
          base_fee: number
          created_at?: string
          display_order: number
          funding_max?: number | null
          funding_min: number
          id: string
          label: string
          monthly_fee: number
          sf_variant_1: number
          sf_variant_2: number
          sf_variant_3: number
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          display_order?: number
          funding_max?: number | null
          funding_min?: number
          id?: string
          label?: string
          monthly_fee?: number
          sf_variant_1?: number
          sf_variant_2?: number
          sf_variant_3?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          group_name: string
          id: string
          is_active: boolean
          is_custom: boolean
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          group_name: string
          id: string
          is_active?: boolean
          is_custom?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          group_name?: string
          id?: string
          is_active?: boolean
          is_custom?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_jobs: {
        Row: {
          attempts: number
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          event: string
          headers: Json
          id: string
          last_error: string | null
          last_response_status: number | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          status: Database["public"]["Enums"]["webhook_status"]
          target: string
          url: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          event: string
          headers?: Json
          id?: string
          last_error?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_attempt_at?: string
          payload: Json
          status?: Database["public"]["Enums"]["webhook_status"]
          target: string
          url: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          event?: string
          headers?: Json
          id?: string
          last_error?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          status?: Database["public"]["Enums"]["webhook_status"]
          target?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_offer_view_count: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      next_offer_number: { Args: never; Returns: string }
      stats_by_consultant: { Args: never; Returns: Json }
      stats_overview: { Args: never; Returns: Json }
      stats_pipeline_by_month: { Args: { months_back?: number }; Returns: Json }
      user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      deletion_status: "requested" | "approved" | "executed" | "rejected"
      event_type:
        | "created"
        | "updated"
        | "sent"
        | "viewed"
        | "scroll_depth"
        | "variant_hovered"
        | "variant_selected"
        | "accepted"
        | "rejected"
        | "pdf_downloaded"
        | "link_shared"
        | "email_sent"
      offer_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      pricing_variant: "I" | "II" | "III" | "IV"
      user_role: "super_admin" | "admin" | "consultant"
      webhook_status: "pending" | "processing" | "sent" | "failed" | "dead"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      deletion_status: ["requested", "approved", "executed", "rejected"],
      event_type: [
        "created",
        "updated",
        "sent",
        "viewed",
        "scroll_depth",
        "variant_hovered",
        "variant_selected",
        "accepted",
        "rejected",
        "pdf_downloaded",
        "link_shared",
        "email_sent",
      ],
      offer_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      pricing_variant: ["I", "II", "III", "IV"],
      user_role: ["super_admin", "admin", "consultant"],
      webhook_status: ["pending", "processing", "sent", "failed", "dead"],
    },
  },
} as const
