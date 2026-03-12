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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      client_rates: {
        Row: {
          client_id: string
          created_at: string
          id: string
          rate_amount: number
          rate_name: string
          reference_number: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          rate_amount: number
          rate_name: string
          reference_number?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          rate_amount?: number
          rate_name?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          hourly_rate: number
          id: string
          km_rate: number
          name: string
          phone: string | null
          ref_number: string | null
          service_description: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number
          id?: string
          km_rate?: number
          name: string
          phone?: string | null
          ref_number?: string | null
          service_description?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number
          id?: string
          km_rate?: number
          name?: string
          phone?: string | null
          ref_number?: string | null
          service_description?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fixed_shifts: {
        Row: {
          client_id: string
          created_at: string
          day_of_week: number
          default_hours: number
          expenses: string | null
          hourly_rate: number | null
          id: string
          mileage: number | null
          mileage_rate: number | null
          notes: string | null
          rate_id: string | null
          rate_name: string | null
          reference_number: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          day_of_week: number
          default_hours: number
          expenses?: string | null
          hourly_rate?: number | null
          id?: string
          mileage?: number | null
          mileage_rate?: number | null
          notes?: string | null
          rate_id?: string | null
          rate_name?: string | null
          reference_number?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          day_of_week?: number
          default_hours?: number
          expenses?: string | null
          hourly_rate?: number | null
          id?: string
          mileage?: number | null
          mileage_rate?: number | null
          notes?: string | null
          rate_id?: string | null
          rate_name?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_shifts_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "client_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_shifts: {
        Row: {
          created_at: string
          day_name: string | null
          expenses: Json | null
          expenses_total: number
          hourly_rate: number
          hours: number
          id: string
          invoice_amount: number
          invoice_hours: number
          invoice_id: string
          invoice_rate: number
          km: number
          km_rate: number
          rate_name: string | null
          reference_number: string | null
          shift_date: string
          shift_total: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          day_name?: string | null
          expenses?: Json | null
          expenses_total?: number
          hourly_rate?: number
          hours?: number
          id?: string
          invoice_amount?: number
          invoice_hours?: number
          invoice_id: string
          invoice_rate?: number
          km?: number
          km_rate?: number
          rate_name?: string | null
          reference_number?: string | null
          shift_date: string
          shift_total?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          day_name?: string | null
          expenses?: Json | null
          expenses_total?: number
          hourly_rate?: number
          hours?: number
          id?: string
          invoice_amount?: number
          invoice_hours?: number
          invoice_id?: string
          invoice_rate?: number
          km?: number
          km_rate?: number
          rate_name?: string | null
          reference_number?: string | null
          shift_date?: string
          shift_total?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_shifts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invoice_date: string
          invoice_number: number
          notes: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number: number
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number?: number
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          abn: string | null
          account_number: string | null
          bsb: string | null
          color_scheme: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          abn?: string | null
          account_number?: string | null
          bsb?: string | null
          color_scheme?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          abn?: string | null
          account_number?: string | null
          bsb?: string | null
          color_scheme?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
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
