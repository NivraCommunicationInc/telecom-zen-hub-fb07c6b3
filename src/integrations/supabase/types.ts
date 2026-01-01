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
          actor_email: string | null
          actor_name: string | null
          actor_role: string | null
          changed_field: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changed_field?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changed_field?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          admin_id: string | null
          client_email: string | null
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
          activation_fee: number | null
          amount: number
          client_email: string | null
          created_at: string
          credits: number | null
          delivery_fee: number | null
          discount_amount: number | null
          due_date: string | null
          equipment_id: string | null
          fees: number | null
          id: string
          installation_fee: number | null
          invoice_number: string | null
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_reference: string | null
          related_order_number: string | null
          status: string
          subtotal: number | null
          tps_amount: number | null
          tvq_amount: number | null
          user_id: string
        }
        Insert: {
          activation_fee?: number | null
          amount: number
          client_email?: string | null
          created_at?: string
          credits?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          due_date?: string | null
          equipment_id?: string | null
          fees?: number | null
          id?: string
          installation_fee?: number | null
          invoice_number?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          related_order_number?: string | null
          status?: string
          subtotal?: number | null
          tps_amount?: number | null
          tvq_amount?: number | null
          user_id: string
        }
        Update: {
          activation_fee?: number | null
          amount?: number
          client_email?: string | null
          created_at?: string
          credits?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          due_date?: string | null
          equipment_id?: string | null
          fees?: number | null
          id?: string
          installation_fee?: number | null
          invoice_number?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          related_order_number?: string | null
          status?: string
          subtotal?: number | null
          tps_amount?: number | null
          tvq_amount?: number | null
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
      channel_packages: {
        Row: {
          category: string
          channels: Json
          created_at: string
          description: string | null
          discounted_price: number
          id: string
          is_active: boolean | null
          name: string
          original_price: number
          savings_percent: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          channels?: Json
          created_at?: string
          description?: string | null
          discounted_price?: number
          id?: string
          is_active?: boolean | null
          name: string
          original_price?: number
          savings_percent?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          channels?: Json
          created_at?: string
          description?: string | null
          discounted_price?: number
          id?: string
          is_active?: boolean | null
          name?: string
          original_price?: number
          savings_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      channel_selections: {
        Row: {
          channels: Json
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          notes: string | null
          related_ticket_id: string | null
          status: string
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          related_ticket_id?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          related_ticket_id?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_selections_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
          request_number: string | null
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
          request_number?: string | null
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
          request_number?: string | null
          status?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_name: string
          contract_number: string | null
          contract_url: string
          created_at: string
          id: string
          is_signed: boolean | null
          signed_at: string | null
          user_id: string
        }
        Insert: {
          contract_name: string
          contract_number?: string | null
          contract_url: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          signed_at?: string | null
          user_id: string
        }
        Update: {
          contract_name?: string
          contract_number?: string | null
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
          activation_fee: number | null
          amount_paid: number | null
          appointment_date: string | null
          appointment_notes: string | null
          audit_timeline: Json | null
          category: string | null
          channel_assigned_by: string | null
          channel_selection_locked: boolean | null
          client_email: string | null
          created_at: string
          created_by: string | null
          credits_applied: number | null
          delivery_fee: number | null
          discount_amount: number | null
          discount_code: string | null
          equipment_details: Json | null
          equipment_id: string | null
          id: string
          id_verification_notes: string | null
          id_verification_status: string | null
          id_verified_at: string | null
          id_verified_by: string | null
          imei_number: string | null
          installation_credit: number | null
          installation_fee: number | null
          installation_type: string | null
          internal_notes: string | null
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          notes: string | null
          order_number: string | null
          payment_reference: string | null
          payment_status: string | null
          processed_at: string | null
          processed_by: string | null
          related_contract_id: string | null
          related_ticket_id: string | null
          risk_flags: Json | null
          router_fee: number | null
          savings_estimated: number | null
          selected_channels: Json | null
          serial_number: string | null
          service_type: string
          sim_number: string | null
          status: string
          subtotal: number | null
          technician_id: string | null
          terminal_count: number | null
          terminal_fee: number | null
          total_amount: number | null
          tps_amount: number | null
          tps_rate: number | null
          tracking_number: string | null
          tracking_url: string | null
          tvq_amount: number | null
          tvq_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_fee?: number | null
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_notes?: string | null
          audit_timeline?: Json | null
          category?: string | null
          channel_assigned_by?: string | null
          channel_selection_locked?: boolean | null
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          discount_code?: string | null
          equipment_details?: Json | null
          equipment_id?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          processed_at?: string | null
          processed_by?: string | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          risk_flags?: Json | null
          router_fee?: number | null
          savings_estimated?: number | null
          selected_channels?: Json | null
          serial_number?: string | null
          service_type: string
          sim_number?: string | null
          status?: string
          subtotal?: number | null
          technician_id?: string | null
          terminal_count?: number | null
          terminal_fee?: number | null
          total_amount?: number | null
          tps_amount?: number | null
          tps_rate?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          tvq_amount?: number | null
          tvq_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_fee?: number | null
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_notes?: string | null
          audit_timeline?: Json | null
          category?: string | null
          channel_assigned_by?: string | null
          channel_selection_locked?: boolean | null
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          discount_code?: string | null
          equipment_details?: Json | null
          equipment_id?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          processed_at?: string | null
          processed_by?: string | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          risk_flags?: Json | null
          router_fee?: number | null
          savings_estimated?: number | null
          selected_channels?: Json | null
          serial_number?: string | null
          service_type?: string
          sim_number?: string | null
          status?: string
          subtotal?: number | null
          technician_id?: string | null
          terminal_count?: number | null
          terminal_fee?: number | null
          total_amount?: number | null
          tps_amount?: number | null
          tps_rate?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          tvq_amount?: number | null
          tvq_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
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
      payments: {
        Row: {
          amount: number
          billing_id: string | null
          card_last_four: string | null
          card_type: string | null
          created_at: string
          etransfer_amount: number | null
          etransfer_sender_name: string | null
          id: string
          notes: string | null
          payment_method: string
          payment_reference: string | null
          received_by: string | null
          reference_number: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_id?: string | null
          card_last_four?: string | null
          card_type?: string | null
          created_at?: string
          etransfer_amount?: number | null
          etransfer_sender_name?: string | null
          id?: string
          notes?: string | null
          payment_method: string
          payment_reference?: string | null
          received_by?: string | null
          reference_number: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_id?: string | null
          card_last_four?: string | null
          card_type?: string | null
          created_at?: string
          etransfer_amount?: number | null
          etransfer_sender_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          received_by?: string | null
          reference_number?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string | null
          balance: number | null
          client_number: string | null
          client_type: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          employer_discount: string | null
          employer_sector: string | null
          first_name: string | null
          full_name: string | null
          id: string
          id_expiration: string | null
          id_number: string | null
          id_province: string | null
          id_type: string | null
          internal_notes: string | null
          last_name: string | null
          phone: string | null
          sector_tags: string[] | null
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          service_province: string | null
          store_credit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string | null
          balance?: number | null
          client_number?: string | null
          client_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          employer_discount?: string | null
          employer_sector?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          id_expiration?: string | null
          id_number?: string | null
          id_province?: string | null
          id_type?: string | null
          internal_notes?: string | null
          last_name?: string | null
          phone?: string | null
          sector_tags?: string[] | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          store_credit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string | null
          balance?: number | null
          client_number?: string | null
          client_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          employer_discount?: string | null
          employer_sector?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          id_expiration?: string | null
          id_number?: string | null
          id_province?: string | null
          id_type?: string | null
          internal_notes?: string | null
          last_name?: string | null
          phone?: string | null
          sector_tags?: string[] | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          store_credit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_admin: boolean
          request_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_admin?: boolean
          request_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
        ]
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
          ticket_number: string | null
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
          ticket_number?: string | null
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
          ticket_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          specializations: string[] | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string | null
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
      tv_channels: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_4k: boolean | null
          is_active: boolean | null
          is_hd: boolean | null
          name: string
          price: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name: string
          price?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name?: string
          price?: number | null
        }
        Relationships: []
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
      generate_client_number: { Args: never; Returns: string }
      generate_contract_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_payment_number: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      generate_request_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "technician" | "employee"
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
      app_role: ["admin", "client", "technician", "employee"],
    },
  },
} as const
