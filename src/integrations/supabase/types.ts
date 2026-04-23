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
      analyses: {
        Row: {
          created_at: string
          id: string
          job_description: string
          match_score: number
          missing_keywords: Json
          resume_filename: string
          resume_text: string
          skills_detected: Json
          suggestions: Json
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_description: string
          match_score: number
          missing_keywords?: Json
          resume_filename: string
          resume_text: string
          skills_detected?: Json
          suggestions?: Json
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_description?: string
          match_score?: number
          missing_keywords?: Json
          resume_filename?: string
          resume_text?: string
          skills_detected?: Json
          suggestions?: Json
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rewrite_revisions: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          original_resume_text: string
          rewritten_experience_bullets: Json
          rewritten_project_bullets: Json
          rewritten_summary: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          original_resume_text: string
          rewritten_experience_bullets?: Json
          rewritten_project_bullets?: Json
          rewritten_summary: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          original_resume_text?: string
          rewritten_experience_bullets?: Json
          rewritten_project_bullets?: Json
          rewritten_summary?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          analysis_id: string | null
          content: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          content: string
          created_at?: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          content?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      cover_letters: {
        Row: {
          analysis_id: string | null
          company: string | null
          content: string
          created_at: string
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          company?: string | null
          content: string
          created_at?: string
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interview_attempts: {
        Row: {
          analysis_id: string | null
          answer: string
          created_at: string
          feedback: string
          id: string
          question: string
          scores: Json
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          answer: string
          created_at?: string
          feedback: string
          id?: string
          question: string
          scores?: Json
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          answer?: string
          created_at?: string
          feedback?: string
          id?: string
          question?: string
          scores?: Json
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          analysis_id: string | null
          applied_at: string | null
          company: string
          created_at: string
          id: string
          notes: string | null
          outcome: string | null
          resume_version_id: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          applied_at?: string | null
          company: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          resume_version_id?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          applied_at?: string | null
          company?: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          resume_version_id?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
