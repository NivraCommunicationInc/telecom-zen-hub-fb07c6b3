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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          admin_id: string | null
          client_email: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          scheduled_at: string
          status: string | null
          title: string
        }
        Insert: {
          admin_id?: string | null
          client_email?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          scheduled_at: string
          status?: string | null
          title: string
        }
        Update: {
          admin_id?: string | null
          client_email?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          scheduled_at?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      billing: {
        Row: {
          amount: number
          client_email: string | null
          created_at: string
          credits: number | null
          due_date: string | null
          fees: number | null
          id: string
          invoice_number: string | null
          late_fee_applied: boolean | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          client_email?: string | null
          created_at?: string
          credits?: number | null
          due_date?: string | null
          fees?: number | null
          id?: string
          invoice_number?: string | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_email?: string | null
          created_at?: string
          credits?: number | null
          due_date?: string | null
          fees?: number | null
          id?: string
          invoice_number?: string | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string | null
          document_url: string
          id: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type?: string | null
          document_url: string
          id?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string | null
          document_url?: string
          id?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          name: string
          notes: string | null
          phone: string
          priority: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          name: string
          notes?: string | null
          phone: string
          priority?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          name?: string
          notes?: string | null
          phone?: string
          priority?: string | null
          status?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_name: string
          contract_url: string
          created_at: string
          id: string
          is_signed: boolean | null
          signed_at: string | null
          user_id: string
        }
        Insert: {
          contract_name: string
          contract_url: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          signed_at?: string | null
          user_id: string
        }
        Update: {
          contract_name?: string
          contract_url?: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          signed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          created_at: string
          cv_filename: string | null
          cv_path: string | null
          email: string
          full_name: string
          id: string
          job_id: string | null
          message: string | null
          phone: string
          position: string
          status: string
        }
        Insert: {
          created_at?: string
          cv_filename?: string | null
          cv_path?: string | null
          email: string
          full_name: string
          id?: string
          job_id?: string | null
          message?: string | null
          phone: string
          position: string
          status?: string
        }
        Update: {
          created_at?: string
          cv_filename?: string | null
          cv_path?: string | null
          email?: string
          full_name?: string
          id?: string
          job_id?: string | null
          message?: string | null
          phone?: string
          position?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          department: string
          description: string | null
          id: string
          is_active: boolean | null
          location: string
          requirements: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          location: string
          requirements?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string
          requirements?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string
          related_order_id: string | null
          related_request_id: string | null
          sender_id: string
          subject: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id: string
          related_order_id?: string | null
          related_request_id?: string | null
          sender_id: string
          subject?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          related_order_id?: string | null
          related_request_id?: string | null
          sender_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_email: string | null
          created_at: string
          id: string
          imei_number: string | null
          notes: string | null
          serial_number: string | null
          service_type: string
          sim_number: string | null
          status: string
          total_amount: number | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          created_at?: string
          id?: string
          imei_number?: string | null
          notes?: string | null
          serial_number?: string | null
          service_type: string
          sim_number?: string | null
          status?: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          created_at?: string
          id?: string
          imei_number?: string | null
          notes?: string | null
          serial_number?: string | null
          service_type?: string
          sim_number?: string | null
          status?: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          card_type: string
          created_at: string
          expiry_month: number
          expiry_year: number
          id: string
          is_default: boolean
          last_four: string
          user_id: string
        }
        Insert: {
          card_type: string
          created_at?: string
          expiry_month: number
          expiry_year: number
          id?: string
          is_default?: boolean
          last_four: string
          user_id: string
        }
        Update: {
          card_type?: string
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_default?: boolean
          last_four?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          employer_discount: string | null
          full_name: string | null
          id: string
          internal_notes: string | null
          phone: string | null
          sector_tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employer_discount?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          sector_tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employer_discount?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          sector_tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          id: string
          next_billing_date: string | null
          plan_name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle?: string
          created_at?: string
          id?: string
          next_billing_date?: string | null
          plan_name: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          id?: string
          next_billing_date?: string | null
          plan_name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          client_email: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telecom_analytics: {
        Row: {
          activations_count: number | null
          contract_savings: number | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activations_count?: number | null
          contract_savings?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activations_count?: number | null
          contract_savings?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_admin: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
