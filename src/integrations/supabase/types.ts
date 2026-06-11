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
      chat_audit_log: {
        Row: {
          created_at: string
          evidence: Json
          flags: Json
          id: string
          lang: string
          message: string
          model: string
          question: string
          request_id: string
          sources: Json
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          evidence?: Json
          flags?: Json
          id?: string
          lang?: string
          message: string
          model?: string
          question: string
          request_id?: string
          sources?: Json
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          evidence?: Json
          flags?: Json
          id?: string
          lang?: string
          message?: string
          model?: string
          question?: string
          request_id?: string
          sources?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_eval_runs: {
        Row: {
          actual_answer: string | null
          citation_count: number
          created_at: string
          expected_keywords: string[]
          id: string
          must_cite: boolean
          notes: string | null
          passed: boolean
          question: string
          run_id: string
        }
        Insert: {
          actual_answer?: string | null
          citation_count?: number
          created_at?: string
          expected_keywords?: string[]
          id?: string
          must_cite?: boolean
          notes?: string | null
          passed?: boolean
          question: string
          run_id: string
        }
        Update: {
          actual_answer?: string | null
          citation_count?: number
          created_at?: string
          expected_keywords?: string[]
          id?: string
          must_cite?: boolean
          notes?: string | null
          passed?: boolean
          question?: string
          run_id?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          address: string
          created_at: string
          id: string
          name: string
          package: string
          paid: boolean
          postcode: string
          user_id: string
          years_selected: number[]
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          name: string
          package: string
          paid?: boolean
          postcode: string
          user_id: string
          years_selected?: number[]
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          name?: string
          package?: string
          paid?: boolean
          postcode?: string
          user_id?: string
          years_selected?: number[]
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          content_hash: string
          embedding: string
          fetched_at: string
          id: string
          language: string
          model_version: string
          source_id: string | null
          source_tier: number
          source_title: string | null
          source_type: string
          source_url: string
        }
        Insert: {
          content: string
          content_hash: string
          embedding: string
          fetched_at?: string
          id?: string
          language?: string
          model_version?: string
          source_id?: string | null
          source_tier?: number
          source_title?: string | null
          source_type: string
          source_url: string
        }
        Update: {
          content?: string
          content_hash?: string
          embedding?: string
          fetched_at?: string
          id?: string
          language?: string
          model_version?: string
          source_id?: string | null
          source_tier?: number
          source_title?: string | null
          source_type?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          last_scraped_at: string | null
          last_status: string | null
          source_tier: number
          source_type: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          last_scraped_at?: string | null
          last_status?: string | null
          source_tier?: number
          source_type: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          last_scraped_at?: string | null
          last_status?: string | null
          source_tier?: number
          source_type?: string
          url?: string
        }
        Relationships: []
      }
      noise_logs: {
        Row: {
          altitude: number | null
          created_at: string
          db_level: number | null
          flight_number: string | null
          id: string
          lat: number | null
          lng: number | null
          timestamp: string
          user_id: string
        }
        Insert: {
          altitude?: number | null
          created_at?: string
          db_level?: number | null
          flight_number?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          timestamp?: string
          user_id: string
        }
        Update: {
          altitude?: number | null
          created_at?: string
          db_level?: number | null
          flight_number?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          postcode: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id: string
          postcode?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          postcode?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          content: string
          fetched_at: string
          id: string
          similarity: number
          source_tier: number
          source_title: string
          source_type: string
          source_url: string
        }[]
      }
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
