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
      account_service_locations: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean | null
          label: string
          service_address: string
          service_city: string | null
          service_postal_code: string | null
          service_province: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string
          service_address: string
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string
          service_address?: string
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_service_locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_name: string | null
          account_number: string
          billing_address: string | null
          billing_city: string | null
          billing_cycle_day: number | null
          billing_cycle_timezone: string | null
          billing_postal_code: string | null
          billing_province: string | null
          client_id: string
          created_at: string
          credit_class: string | null
          credit_last_reviewed_at: string | null
          credit_last_reviewed_by_admin_id: string | null
          id: string
          primary_service_address: string | null
          primary_service_city: string | null
          primary_service_postal_code: string | null
          primary_service_province: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          billing_address?: string | null
          billing_city?: string | null
          billing_cycle_day?: number | null
          billing_cycle_timezone?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          client_id: string
          created_at?: string
          credit_class?: string | null
          credit_last_reviewed_at?: string | null
          credit_last_reviewed_by_admin_id?: string | null
          id?: string
          primary_service_address?: string | null
          primary_service_city?: string | null
          primary_service_postal_code?: string | null
          primary_service_province?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          billing_address?: string | null
          billing_city?: string | null
          billing_cycle_day?: number | null
          billing_cycle_timezone?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          client_id?: string
          created_at?: string
          credit_class?: string | null
          credit_last_reviewed_at?: string | null
          credit_last_reviewed_by_admin_id?: string | null
          id?: string
          primary_service_address?: string | null
          primary_service_city?: string | null
          primary_service_postal_code?: string | null
          primary_service_province?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_email: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          admin_id: string | null
          appointment_number: string | null
          cancellation_reason: string | null
          client_email: string | null
          client_id: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          delivery_fee: number | null
          description: string | null
          equipment_details: Json | null
          id: string
          installation_fee: number | null
          installation_method: string | null
          internal_notes: string | null
          order_id: string | null
          scheduled_at: string
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          service_type: string | null
          status: string | null
          technician_id: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          admin_id?: string | null
          appointment_number?: string | null
          cancellation_reason?: string | null
          client_email?: string | null
          client_id?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          description?: string | null
          equipment_details?: Json | null
          id?: string
          installation_fee?: number | null
          installation_method?: string | null
          internal_notes?: string | null
          order_id?: string | null
          scheduled_at: string
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_type?: string | null
          status?: string | null
          technician_id?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          admin_id?: string | null
          appointment_number?: string | null
          cancellation_reason?: string | null
          client_email?: string | null
          client_id?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          description?: string | null
          equipment_details?: Json | null
          id?: string
          installation_fee?: number | null
          installation_method?: string | null
          internal_notes?: string | null
          order_id?: string | null
          scheduled_at?: string
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_type?: string | null
          status?: string | null
          technician_id?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_users: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          created_by_role: string | null
          email: string | null
          full_name: string
          id: string
          is_primary: boolean | null
          notification_opt_in: boolean | null
          permission_level: string
          phone: string | null
          relationship_label: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean | null
          notification_opt_in?: boolean | null
          permission_level?: string
          phone?: string | null
          relationship_label?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean | null
          notification_opt_in?: boolean | null
          permission_level?: string
          phone?: string | null
          relationship_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing: {
        Row: {
          activation_fee: number | null
          amount: number
          amount_paid: number | null
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
          preauth_discount: number | null
          preauth_discount_applied: boolean | null
          related_order_number: string | null
          replacement_order_id: string | null
          replacement_ticket_id: string | null
          status: string
          subtotal: number | null
          tps_amount: number | null
          tvq_amount: number | null
          user_id: string
        }
        Insert: {
          activation_fee?: number | null
          amount: number
          amount_paid?: number | null
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
          preauth_discount?: number | null
          preauth_discount_applied?: boolean | null
          related_order_number?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
          status?: string
          subtotal?: number | null
          tps_amount?: number | null
          tvq_amount?: number | null
          user_id: string
        }
        Update: {
          activation_fee?: number | null
          amount?: number
          amount_paid?: number | null
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
          preauth_discount?: number | null
          preauth_discount_applied?: boolean | null
          related_order_number?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
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
          {
            foreignKeyName: "billing_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "replacement_internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_replacement_ticket_id_fkey"
            columns: ["replacement_ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_request_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          actor_name: string | null
          actor_role: string | null
          channel_id: string | null
          client_email: string | null
          client_id: string | null
          created_at: string | null
          field_changed: string | null
          id: string
          new_value: string | null
          notified_client: boolean | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          actor_name?: string | null
          actor_role?: string | null
          channel_id?: string | null
          client_email?: string | null
          client_id?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          new_value?: string | null
          notified_client?: boolean | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          actor_name?: string | null
          actor_role?: string | null
          channel_id?: string | null
          client_email?: string | null
          client_id?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          new_value?: string | null
          notified_client?: boolean | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_activity_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_activity_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
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
      client_access_logs: {
        Row: {
          access_method: string
          access_reason: string | null
          client_id: string
          client_name: string | null
          created_at: string
          failed_attempt_count: number | null
          id: string
          result: string
          staff_email: string | null
          staff_name: string
          staff_role: string
          staff_user_id: string
        }
        Insert: {
          access_method: string
          access_reason?: string | null
          client_id: string
          client_name?: string | null
          created_at?: string
          failed_attempt_count?: number | null
          id?: string
          result: string
          staff_email?: string | null
          staff_name: string
          staff_role: string
          staff_user_id: string
        }
        Update: {
          access_method?: string
          access_reason?: string | null
          client_id?: string
          client_name?: string | null
          created_at?: string
          failed_attempt_count?: number | null
          id?: string
          result?: string
          staff_email?: string | null
          staff_name?: string
          staff_role?: string
          staff_user_id?: string
        }
        Relationships: []
      }
      client_activity_logs: {
        Row: {
          action_type: string
          actor_name: string | null
          actor_role: string | null
          actor_user_id: string
          after_data: Json | null
          before_data: Json | null
          client_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          summary: string
        }
        Insert: {
          action_type: string
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id: string
          after_data?: Json | null
          before_data?: Json | null
          client_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          summary: string
        }
        Update: {
          action_type?: string
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string
          after_data?: Json | null
          before_data?: Json | null
          client_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          summary?: string
        }
        Relationships: []
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
      client_internal_notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by_name: string | null
          created_by_role: string
          created_by_user_id: string
          id: string
          note_type: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by_name?: string | null
          created_by_role: string
          created_by_user_id: string
          id?: string
          note_type: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string
          created_by_user_id?: string
          id?: string
          note_type?: string
        }
        Relationships: []
      }
      client_pin_logs: {
        Row: {
          action: string
          changed_by_id: string
          changed_by_name: string | null
          changed_by_role: string
          client_email: string | null
          client_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          changed_by_id: string
          changed_by_name?: string | null
          changed_by_role: string
          client_email?: string | null
          client_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          changed_by_id?: string
          changed_by_name?: string | null
          changed_by_role?: string
          client_email?: string | null
          client_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      client_streaming_subscriptions: {
        Row: {
          account_id: string | null
          created_at: string
          discount_amount: number | null
          end_date: string | null
          id: string
          internal_notes: string | null
          monthly_price: number | null
          promo_code: string | null
          start_date: string | null
          status: string | null
          streaming_service_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          discount_amount?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          monthly_price?: number | null
          promo_code?: string | null
          start_date?: string | null
          status?: string | null
          streaming_service_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          discount_amount?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          monthly_price?: number | null
          promo_code?: string | null
          start_date?: string | null
          status?: string | null
          streaming_service_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_streaming_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_streaming_subscriptions_streaming_service_id_fkey"
            columns: ["streaming_service_id"]
            isOneToOne: false
            referencedRelation: "streaming_services"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          address_apartment: string | null
          address_city: string | null
          address_postal_code: string | null
          address_province: string | null
          address_street: string | null
          consent_given: boolean | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          internal_notes: string | null
          last_name: string | null
          name: string
          notes: string | null
          phone: string
          preferred_contact: string | null
          priority: string | null
          request_number: string | null
          source: string | null
          status: string
          subject: string | null
        }
        Insert: {
          address_apartment?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          consent_given?: boolean | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string | null
          name: string
          notes?: string | null
          phone: string
          preferred_contact?: string | null
          priority?: string | null
          request_number?: string | null
          source?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          address_apartment?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          consent_given?: boolean | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string | null
          name?: string
          notes?: string | null
          phone?: string
          preferred_contact?: string | null
          priority?: string | null
          request_number?: string | null
          source?: string | null
          status?: string
          subject?: string | null
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
          pdf_generated_at: string | null
          pdf_hash: string | null
          signed_at: string | null
          template_id: string
          template_version: string
          user_id: string
        }
        Insert: {
          contract_name: string
          contract_number?: string | null
          contract_url: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          signed_at?: string | null
          template_id?: string
          template_version?: string
          user_id: string
        }
        Update: {
          contract_name?: string
          contract_number?: string | null
          contract_url?: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          signed_at?: string | null
          template_id?: string
          template_version?: string
          user_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          event_key: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          template_key: string
          template_vars: Json | null
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_key: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key: string
          template_vars?: Json | null
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_key?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
          template_vars?: Json | null
          to_email?: string
        }
        Relationships: []
      }
      employee_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          actor_role: string
          created_at: string
          details_json: Json | null
          id: string
          target_employee_email: string | null
          target_employee_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role: string
          created_at?: string
          details_json?: Json | null
          id?: string
          target_employee_email?: string | null
          target_employee_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string
          created_at?: string
          details_json?: Json | null
          id?: string
          target_employee_email?: string | null
          target_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_audit_logs_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          created_by_admin_id: string | null
          email: string
          failed_login_attempts: number | null
          full_name: string
          id: string
          is_active: boolean
          lockout_until: string | null
          permissions_json: Json
          phone: string | null
          pin_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          email: string
          failed_login_attempts?: number | null
          full_name: string
          id?: string
          is_active?: boolean
          lockout_until?: string | null
          permissions_json?: Json
          phone?: string | null
          pin_hash: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          email?: string
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          is_active?: boolean
          lockout_until?: string | null
          permissions_json?: Json
          phone?: string | null
          pin_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment_order_lines: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          item_name: string
          item_sku: string | null
          line_total: number
          order_id: string
          quantity: number
          requires_serial: boolean
          serial_numbers: Json | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_name: string
          item_sku?: string | null
          line_total?: number
          order_id: string
          quantity?: number
          requires_serial?: boolean
          serial_numbers?: Json | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          item_sku?: string | null
          line_total?: number
          order_id?: string
          quantity?: number
          requires_serial?: boolean
          serial_numbers?: Json | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_order_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_snapshots: {
        Row: {
          created_at: string
          delivery_fee: number | null
          delivery_method: string | null
          equipment_ids: Json | null
          id: string
          installation_fee: number | null
          installation_selected: boolean | null
          invoice_id: string | null
          invoice_number: string | null
          order_id: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          technician_eta: string | null
          technician_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
          updated_by_role: string | null
          version: number
        }
        Insert: {
          created_at?: string
          delivery_fee?: number | null
          delivery_method?: string | null
          equipment_ids?: Json | null
          id?: string
          installation_fee?: number | null
          installation_selected?: boolean | null
          invoice_id?: string | null
          invoice_number?: string | null
          order_id: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          technician_eta?: string | null
          technician_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          delivery_fee?: number | null
          delivery_method?: string | null
          equipment_ids?: Json | null
          id?: string
          installation_fee?: number | null
          installation_selected?: boolean | null
          invoice_id?: string | null
          invoice_number?: string | null
          order_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          technician_eta?: string | null
          technician_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_snapshots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_snapshots_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_ticket_replies: {
        Row: {
          author_email: string | null
          author_id: string
          author_name: string
          author_role: string
          content: string
          created_at: string
          id: string
          is_internal_note: boolean | null
          ticket_id: string
        }
        Insert: {
          author_email?: string | null
          author_id: string
          author_name: string
          author_role: string
          content: string
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          ticket_id: string
        }
        Update: {
          author_email?: string | null
          author_id?: string
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "internal_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tickets: {
        Row: {
          assigned_to_department: string
          assigned_to_id: string | null
          assigned_to_name: string | null
          category: string | null
          cc_departments: Json | null
          created_at: string
          created_by_email: string | null
          created_by_id: string
          created_by_name: string
          created_by_role: string
          description: string
          id: string
          internal_notes: string | null
          priority: string
          resolved_at: string | null
          resolved_by_id: string | null
          resolved_by_name: string | null
          status: string
          subject: string
          ticket_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_department: string
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          category?: string | null
          cc_departments?: Json | null
          created_at?: string
          created_by_email?: string | null
          created_by_id: string
          created_by_name: string
          created_by_role: string
          description: string
          id?: string
          internal_notes?: string | null
          priority?: string
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          status?: string
          subject: string
          ticket_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_department?: string
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          category?: string | null
          cc_departments?: Json | null
          created_at?: string
          created_by_email?: string | null
          created_by_id?: string
          created_by_name?: string
          created_by_role?: string
          description?: string
          id?: string
          internal_notes?: string | null
          priority?: string
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          status?: string
          subject?: string
          ticket_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          requires_serial: boolean
          sku: string | null
          sort_order: number | null
          status: string
          taxable: boolean
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          requires_serial?: boolean
          sku?: string | null
          sort_order?: number | null
          status?: string
          taxable?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          requires_serial?: boolean
          sku?: string | null
          sort_order?: number | null
          status?: string
          taxable?: boolean
          type?: string
          updated_at?: string
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
      monthly_invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          subscription_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity?: number
          subscription_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          subscription_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "monthly_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_invoice_lines_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_invoices: {
        Row: {
          amount_paid: number | null
          client_id: string
          created_at: string
          due_date: string
          id: string
          invoice_number: string | null
          issue_date: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          status: string
          subtotal: number
          total: number
          tps_amount: number | null
          tvq_amount: number | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          client_id: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          subtotal?: number
          total?: number
          tps_amount?: number | null
          tvq_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subtotal?: number
          total?: number
          tps_amount?: number | null
          tvq_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_id: string | null
          link_target: string | null
          message: string | null
          title: string
          type: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_target?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          link_target?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      order_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          file_size: number | null
          fulfillment_snapshot_id: string | null
          generated_at: string
          generated_by: string | null
          generated_by_role: string | null
          id: string
          order_id: string
          order_snapshot_id: string | null
          pdf_url: string | null
          version: number
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_size?: number | null
          fulfillment_snapshot_id?: string | null
          generated_at?: string
          generated_by?: string | null
          generated_by_role?: string | null
          id?: string
          order_id: string
          order_snapshot_id?: string | null
          pdf_url?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          fulfillment_snapshot_id?: string | null
          generated_at?: string
          generated_by?: string | null
          generated_by_role?: string | null
          id?: string
          order_id?: string
          order_snapshot_id?: string | null
          pdf_url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_fulfillment_snapshot_id_fkey"
            columns: ["fulfillment_snapshot_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_order_snapshot_id_fkey"
            columns: ["order_snapshot_id"]
            isOneToOne: false
            referencedRelation: "order_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      order_snapshots: {
        Row: {
          accepted_at: string
          accepted_ip: string | null
          accepted_method: string | null
          billing_snapshot: Json
          client_snapshot: Json
          created_at: string
          equipment_snapshot: Json
          fees_snapshot: Json
          id: string
          order_id: string
          services_snapshot: Json
          version: number
        }
        Insert: {
          accepted_at?: string
          accepted_ip?: string | null
          accepted_method?: string | null
          billing_snapshot?: Json
          client_snapshot?: Json
          created_at?: string
          equipment_snapshot?: Json
          fees_snapshot?: Json
          id?: string
          order_id: string
          services_snapshot?: Json
          version?: number
        }
        Update: {
          accepted_at?: string
          accepted_ip?: string | null
          accepted_method?: string | null
          billing_snapshot?: Json
          client_snapshot?: Json
          created_at?: string
          equipment_snapshot?: Json
          fees_snapshot?: Json
          id?: string
          order_id?: string
          services_snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string | null
          activation_fee: number | null
          agreement_version: number | null
          amount_paid: number | null
          appointment_date: string | null
          appointment_notes: string | null
          audit_timeline: Json | null
          carrier: string | null
          category: string | null
          channel_assigned_by: string | null
          channel_selection_locked: boolean | null
          client_email: string | null
          confirmation_number: string | null
          created_at: string
          created_by: string | null
          credits_applied: number | null
          delivery_fee: number | null
          delivery_method: string | null
          discount_amount: number | null
          discount_code: string | null
          equipment_details: Json | null
          equipment_id: string | null
          id: string
          id_verification_notes: string | null
          id_verification_status: string | null
          id_verified_at: string | null
          id_verified_by: string | null
          identity_snapshot: Json | null
          imei_number: string | null
          installation_credit: number | null
          installation_fee: number | null
          installation_type: string | null
          internal_notes: string | null
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          notes: string | null
          order_number: string | null
          order_type: string | null
          payment_reference: string | null
          payment_status: string | null
          port_request: Json | null
          preauth_card_id: string | null
          preauth_discount: number | null
          processed_at: string | null
          processed_by: string | null
          promo_code: string | null
          promo_details: Json | null
          promo_discount_amount: number | null
          related_contract_id: string | null
          related_ticket_id: string | null
          risk_flags: Json | null
          router_fee: number | null
          savings_estimated: number | null
          selected_channels: Json | null
          serial_number: string | null
          service_location_id: string | null
          service_type: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
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
          account_id?: string | null
          activation_fee?: number | null
          agreement_version?: number | null
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_notes?: string | null
          audit_timeline?: Json | null
          carrier?: string | null
          category?: string | null
          channel_assigned_by?: string | null
          channel_selection_locked?: boolean | null
          client_email?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          delivery_method?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          equipment_details?: Json | null
          equipment_id?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          identity_snapshot?: Json | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          order_type?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          port_request?: Json | null
          preauth_card_id?: string | null
          preauth_discount?: number | null
          processed_at?: string | null
          processed_by?: string | null
          promo_code?: string | null
          promo_details?: Json | null
          promo_discount_amount?: number | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          risk_flags?: Json | null
          router_fee?: number | null
          savings_estimated?: number | null
          selected_channels?: Json | null
          serial_number?: string | null
          service_location_id?: string | null
          service_type: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
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
          account_id?: string | null
          activation_fee?: number | null
          agreement_version?: number | null
          amount_paid?: number | null
          appointment_date?: string | null
          appointment_notes?: string | null
          audit_timeline?: Json | null
          carrier?: string | null
          category?: string | null
          channel_assigned_by?: string | null
          channel_selection_locked?: boolean | null
          client_email?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          delivery_method?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          equipment_details?: Json | null
          equipment_id?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          identity_snapshot?: Json | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          order_type?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          port_request?: Json | null
          preauth_card_id?: string | null
          preauth_discount?: number | null
          processed_at?: string | null
          processed_by?: string | null
          promo_code?: string | null
          promo_details?: Json | null
          promo_discount_amount?: number | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          risk_flags?: Json | null
          router_fee?: number | null
          savings_estimated?: number | null
          selected_channels?: Json | null
          serial_number?: string | null
          service_location_id?: string | null
          service_type?: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
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
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_preauth_card_id_fkey"
            columns: ["preauth_card_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "account_service_locations"
            referencedColumns: ["id"]
          },
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
          cardholder_name: string | null
          created_at: string
          encrypted_card_number: string | null
          expiry_month: number
          expiry_year: number
          id: string
          is_default: boolean
          is_preauthorized: boolean | null
          last_four: string
          preauthorized_at: string | null
          user_id: string
        }
        Insert: {
          card_type: string
          cardholder_name?: string | null
          created_at?: string
          encrypted_card_number?: string | null
          expiry_month: number
          expiry_year: number
          id?: string
          is_default?: boolean
          is_preauthorized?: boolean | null
          last_four: string
          preauthorized_at?: string | null
          user_id: string
        }
        Update: {
          card_type?: string
          cardholder_name?: string | null
          created_at?: string
          encrypted_card_number?: string | null
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_default?: boolean
          is_preauthorized?: boolean | null
          last_four?: string
          preauthorized_at?: string | null
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
          client_pin: string | null
          client_pin_hash: string | null
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
          pin_failed_attempts: number | null
          pin_is_default: boolean | null
          pin_lockout_until: string | null
          sector_tags: string[] | null
          security_alert_level: string | null
          security_flagged_at: string | null
          security_flagged_order_id: string | null
          security_reason: string | null
          security_requires_pin_reset: boolean | null
          security_status: string
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
          client_pin?: string | null
          client_pin_hash?: string | null
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
          pin_failed_attempts?: number | null
          pin_is_default?: boolean | null
          pin_lockout_until?: string | null
          sector_tags?: string[] | null
          security_alert_level?: string | null
          security_flagged_at?: string | null
          security_flagged_order_id?: string | null
          security_reason?: string | null
          security_requires_pin_reset?: boolean | null
          security_status?: string
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
          client_pin?: string | null
          client_pin_hash?: string | null
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
          pin_failed_attempts?: number | null
          pin_is_default?: boolean | null
          pin_lockout_until?: string | null
          sector_tags?: string[] | null
          security_alert_level?: string | null
          security_flagged_at?: string | null
          security_flagged_order_id?: string | null
          security_reason?: string | null
          security_requires_pin_reset?: boolean | null
          security_status?: string
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
      promotion_redemptions: {
        Row: {
          client_email: string
          client_id: string | null
          currency: string
          discount_amount: number
          id: string
          order_id: string | null
          order_number: string | null
          promotion_id: string
          redeemed_at: string
        }
        Insert: {
          client_email: string
          client_id?: string | null
          currency?: string
          discount_amount: number
          id?: string
          order_id?: string | null
          order_number?: string | null
          promotion_id: string
          redeemed_at?: string
        }
        Update: {
          client_email?: string
          client_id?: string | null
          currency?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_number?: string | null
          promotion_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: Json
          code: string
          created_at: string
          created_by_admin_id: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_at: string | null
          id: string
          max_discount_amount: number | null
          min_subtotal: number | null
          name: string
          restricted_client_ids: string[] | null
          restricted_email_domains: string[] | null
          scope: string
          stackable: boolean
          start_at: string | null
          status: string
          updated_at: string
          usage_limit_per_client: number | null
          usage_limit_total: number | null
        }
        Insert: {
          applies_to?: Json
          code: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_at?: string | null
          id?: string
          max_discount_amount?: number | null
          min_subtotal?: number | null
          name: string
          restricted_client_ids?: string[] | null
          restricted_email_domains?: string[] | null
          scope?: string
          stackable?: boolean
          start_at?: string | null
          status?: string
          updated_at?: string
          usage_limit_per_client?: number | null
          usage_limit_total?: number | null
        }
        Update: {
          applies_to?: Json
          code?: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_at?: string | null
          id?: string
          max_discount_amount?: number | null
          min_subtotal?: number | null
          name?: string
          restricted_client_ids?: string[] | null
          restricted_email_domains?: string[] | null
          scope?: string
          stackable?: boolean
          start_at?: string | null
          status?: string
          updated_at?: string
          usage_limit_per_client?: number | null
          usage_limit_total?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          action_type: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          action_type?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      replacement_internal_orders: {
        Row: {
          account_id: string | null
          created_at: string | null
          created_by_id: string | null
          created_by_name: string | null
          created_by_role: string | null
          delivery_fee: number | null
          delivery_method: string | null
          fulfillment_type: string | null
          id: string
          installation_fee: number | null
          installation_selected: boolean | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          is_quote: boolean | null
          items_subtotal: number | null
          notes_internal: string | null
          order_number: string | null
          payment_confirmed: boolean | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_reference: string | null
          quote_approved_at: string | null
          quote_approved_by: string | null
          return_deadline: string | null
          return_fee: number | null
          return_received: boolean | null
          return_required: boolean | null
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          service_province: string | null
          status: string | null
          subtotal: number | null
          technician_required: boolean | null
          ticket_id: string
          total_amount: number | null
          tps_amount: number | null
          tvq_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          delivery_fee?: number | null
          delivery_method?: string | null
          fulfillment_type?: string | null
          id?: string
          installation_fee?: number | null
          installation_selected?: boolean | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          is_quote?: boolean | null
          items_subtotal?: number | null
          notes_internal?: string | null
          order_number?: string | null
          payment_confirmed?: boolean | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference?: string | null
          quote_approved_at?: string | null
          quote_approved_by?: string | null
          return_deadline?: string | null
          return_fee?: number | null
          return_received?: boolean | null
          return_required?: boolean | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          status?: string | null
          subtotal?: number | null
          technician_required?: boolean | null
          ticket_id: string
          total_amount?: number | null
          tps_amount?: number | null
          tvq_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          delivery_fee?: number | null
          delivery_method?: string | null
          fulfillment_type?: string | null
          id?: string
          installation_fee?: number | null
          installation_selected?: boolean | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          is_quote?: boolean | null
          items_subtotal?: number | null
          notes_internal?: string | null
          order_number?: string | null
          payment_confirmed?: boolean | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference?: string | null
          quote_approved_at?: string | null
          quote_approved_by?: string | null
          return_deadline?: string | null
          return_fee?: number | null
          return_received?: boolean | null
          return_required?: boolean | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          status?: string | null
          subtotal?: number | null
          technician_required?: boolean | null
          ticket_id?: string
          total_amount?: number | null
          tps_amount?: number | null
          tvq_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_internal_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_request_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_order_items: {
        Row: {
          backorder_eta: string | null
          created_at: string | null
          id: string
          in_stock: boolean | null
          item_name: string
          item_type: string
          line_total: number | null
          order_id: string
          quantity: number | null
          sku: string | null
          taxable: boolean | null
          unit_price: number | null
        }
        Insert: {
          backorder_eta?: string | null
          created_at?: string | null
          id?: string
          in_stock?: boolean | null
          item_name: string
          item_type: string
          line_total?: number | null
          order_id: string
          quantity?: number | null
          sku?: string | null
          taxable?: boolean | null
          unit_price?: number | null
        }
        Update: {
          backorder_eta?: string | null
          created_at?: string | null
          id?: string
          in_stock?: boolean | null
          item_name?: string
          item_type?: string
          line_total?: number | null
          order_id?: string
          quantity?: number | null
          sku?: string | null
          taxable?: boolean | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "replacement_internal_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_orders: {
        Row: {
          admin_fee: number | null
          approved_at: string | null
          approved_by: string | null
          client_email: string | null
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          delivery_fee: number | null
          equipment_items: Json | null
          equipment_total: number | null
          id: string
          internal_notes: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["replacement_order_type"]
          original_order_id: string | null
          original_order_number: string | null
          payment_confirmed: boolean | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_reference: string | null
          replacement_ticket_id: string | null
          return_deadline: string | null
          return_required: boolean | null
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_method: string | null
          shipping_postal_code: string | null
          status: Database["public"]["Enums"]["replacement_order_status"] | null
          subtotal: number | null
          total_amount: number | null
          tps_amount: number | null
          tracking_number: string | null
          tracking_url: string | null
          tvq_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_fee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_email?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          equipment_items?: Json | null
          equipment_total?: number | null
          id?: string
          internal_notes?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["replacement_order_type"]
          original_order_id?: string | null
          original_order_number?: string | null
          payment_confirmed?: boolean | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference?: string | null
          replacement_ticket_id?: string | null
          return_deadline?: string | null
          return_required?: boolean | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          status?:
            | Database["public"]["Enums"]["replacement_order_status"]
            | null
          subtotal?: number | null
          total_amount?: number | null
          tps_amount?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          tvq_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_fee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_email?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          equipment_items?: Json | null
          equipment_total?: number | null
          id?: string
          internal_notes?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["replacement_order_type"]
          original_order_id?: string | null
          original_order_number?: string | null
          payment_confirmed?: boolean | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference?: string | null
          replacement_ticket_id?: string | null
          return_deadline?: string | null
          return_required?: boolean | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          status?:
            | Database["public"]["Enums"]["replacement_order_status"]
            | null
          subtotal?: number | null
          total_amount?: number | null
          tps_amount?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          tvq_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_orders_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_orders_replacement_ticket_id_fkey"
            columns: ["replacement_ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_request_tickets: {
        Row: {
          account_id: string | null
          assigned_to_id: string | null
          assigned_to_name: string | null
          attachment_urls: Json | null
          billable_acknowledged: boolean | null
          category: string
          client_email: string | null
          client_message: string | null
          client_name: string | null
          created_at: string | null
          id: string
          internal_notes: string | null
          preferred_fulfillment: string | null
          priority: string | null
          reason: string
          reason_details: string | null
          service_location_id: string | null
          status: string
          ticket_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          attachment_urls?: Json | null
          billable_acknowledged?: boolean | null
          category?: string
          client_email?: string | null
          client_message?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          internal_notes?: string | null
          preferred_fulfillment?: string | null
          priority?: string | null
          reason?: string
          reason_details?: string | null
          service_location_id?: string | null
          status?: string
          ticket_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          attachment_urls?: Json | null
          billable_acknowledged?: boolean | null
          category?: string
          client_email?: string | null
          client_message?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          internal_notes?: string | null
          preferred_fulfillment?: string | null
          priority?: string | null
          reason?: string
          reason_details?: string | null
          service_location_id?: string | null
          status?: string
          ticket_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_request_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_tickets_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "account_service_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_shipments: {
        Row: {
          carrier: string | null
          created_at: string | null
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          order_id: string
          shipped_at: string | null
          shipped_by_id: string | null
          shipped_by_name: string | null
          status: string | null
          ticket_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          shipped_by_id?: string | null
          shipped_by_name?: string | null
          status?: string | null
          ticket_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          shipped_by_id?: string | null
          shipped_by_name?: string | null
          status?: string | null
          ticket_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "replacement_internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shipments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_request_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_tickets: {
        Row: {
          billable_acknowledged: boolean | null
          client_email: string | null
          created_at: string | null
          equipment_id: string | null
          equipment_name: string | null
          equipment_serial: string | null
          id: string
          internal_notes: string | null
          linked_order_id: string | null
          linked_order_number: string | null
          photo_urls: Json | null
          preferred_address: string | null
          preferred_city: string | null
          preferred_postal_code: string | null
          reason: Database["public"]["Enums"]["replacement_reason"]
          reason_details: string | null
          reason_text: string | null
          status: string | null
          ticket_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billable_acknowledged?: boolean | null
          client_email?: string | null
          created_at?: string | null
          equipment_id?: string | null
          equipment_name?: string | null
          equipment_serial?: string | null
          id?: string
          internal_notes?: string | null
          linked_order_id?: string | null
          linked_order_number?: string | null
          photo_urls?: Json | null
          preferred_address?: string | null
          preferred_city?: string | null
          preferred_postal_code?: string | null
          reason?: Database["public"]["Enums"]["replacement_reason"]
          reason_details?: string | null
          reason_text?: string | null
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billable_acknowledged?: boolean | null
          client_email?: string | null
          created_at?: string | null
          equipment_id?: string | null
          equipment_name?: string | null
          equipment_serial?: string | null
          id?: string
          internal_notes?: string | null
          linked_order_id?: string | null
          linked_order_number?: string | null
          photo_urls?: Json | null
          preferred_address?: string | null
          preferred_city?: string | null
          preferred_postal_code?: string | null
          reason?: Database["public"]["Enums"]["replacement_reason"]
          reason_details?: string | null
          reason_text?: string | null
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_tickets_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_timeline: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string | null
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          order_id: string | null
          ticket_id: string | null
          visible_to_client: boolean | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          order_id?: string | null
          ticket_id?: string | null
          visible_to_client?: boolean | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          order_id?: string | null
          ticket_id?: string | null
          visible_to_client?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "replacement_internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_timeline_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_request_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      security_action_logs: {
        Row: {
          action: string
          action_by_id: string | null
          action_by_name: string | null
          action_by_role: string | null
          client_email: string | null
          client_id: string
          created_at: string
          details: Json | null
          id: string
          order_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          action_by_id?: string | null
          action_by_name?: string | null
          action_by_role?: string | null
          client_email?: string | null
          client_id: string
          created_at?: string
          details?: Json | null
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          action_by_id?: string | null
          action_by_name?: string | null
          action_by_role?: string | null
          client_email?: string | null
          client_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      service_status: {
        Row: {
          description: string | null
          display_name: string
          id: string
          last_incident_at: string | null
          response_time_ms: number | null
          service_name: string
          status: string
          status_message: string | null
          updated_at: string
          updated_by: string | null
          uptime_percent: number | null
        }
        Insert: {
          description?: string | null
          display_name: string
          id?: string
          last_incident_at?: string | null
          response_time_ms?: number | null
          service_name: string
          status?: string
          status_message?: string | null
          updated_at?: string
          updated_by?: string | null
          uptime_percent?: number | null
        }
        Update: {
          description?: string | null
          display_name?: string
          id?: string
          last_incident_at?: string | null
          response_time_ms?: number | null
          service_name?: string
          status?: string
          status_message?: string | null
          updated_at?: string
          updated_by?: string | null
          uptime_percent?: number | null
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
      streaming_catalog: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          logo_url: string | null
          name: string
          price_monthly: number
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          name: string
          price_monthly: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          name?: string
          price_monthly?: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_catalog_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          catalog_item_id: string | null
          changed_fields: string[] | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          catalog_item_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          catalog_item_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "streaming_catalog_audit_logs_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "streaming_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      streaming_services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          monthly_price: number
          name: string
          private_notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_price?: number
          name: string
          private_notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_price?: number
          name?: string
          private_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activation_date: string | null
          amount: number
          bill_cycle_day: number | null
          billing_cycle: string
          created_at: string
          id: string
          last_invoiced_through: string | null
          next_billing_date: string | null
          next_invoice_date: string | null
          plan_name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_date?: string | null
          amount: number
          bill_cycle_day?: number | null
          billing_cycle?: string
          created_at?: string
          id?: string
          last_invoiced_through?: string | null
          next_billing_date?: string | null
          next_invoice_date?: string | null
          plan_name: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_date?: string | null
          amount?: number
          bill_cycle_day?: number | null
          billing_cycle?: string
          created_at?: string
          id?: string
          last_invoiced_through?: string | null
          next_billing_date?: string | null
          next_invoice_date?: string | null
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
          category: string | null
          client_email: string | null
          created_at: string
          created_by_role: string | null
          created_by_user_id: string | null
          description: string
          id: string
          id_files: Json | null
          id_verification_status: string | null
          internal_notes: string | null
          issue_type: string | null
          point_of_contact_id: string | null
          priority: string
          related_order_id: string | null
          related_order_reference: string | null
          requires_id_upload: boolean | null
          status: string
          subject: string
          ticket_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          client_email?: string | null
          created_at?: string
          created_by_role?: string | null
          created_by_user_id?: string | null
          description: string
          id?: string
          id_files?: Json | null
          id_verification_status?: string | null
          internal_notes?: string | null
          issue_type?: string | null
          point_of_contact_id?: string | null
          priority?: string
          related_order_id?: string | null
          related_order_reference?: string | null
          requires_id_upload?: boolean | null
          status?: string
          subject: string
          ticket_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          client_email?: string | null
          created_at?: string
          created_by_role?: string | null
          created_by_user_id?: string | null
          description?: string
          id?: string
          id_files?: Json | null
          id_verification_status?: string | null
          internal_notes?: string | null
          issue_type?: string | null
          point_of_contact_id?: string | null
          priority?: string
          related_order_id?: string | null
          related_order_reference?: string | null
          requires_id_upload?: boolean | null
          status?: string
          subject?: string
          ticket_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_point_of_contact_id_fkey"
            columns: ["point_of_contact_id"]
            isOneToOne: false
            referencedRelation: "authorized_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      system_status: {
        Row: {
          affected_services: Json | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          internal_notes: string | null
          is_active: boolean | null
          is_banner: boolean | null
          message: string
          severity: string
          show_to_clients: boolean | null
          show_to_employees: boolean | null
          show_to_technicians: boolean | null
          starts_at: string | null
          status_type: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_services?: Json | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          is_banner?: boolean | null
          message: string
          severity?: string
          show_to_clients?: boolean | null
          show_to_employees?: boolean | null
          show_to_technicians?: boolean | null
          starts_at?: string | null
          status_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_services?: Json | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          is_banner?: boolean | null
          message?: string
          severity?: string
          show_to_clients?: boolean | null
          show_to_employees?: boolean | null
          show_to_technicians?: boolean | null
          starts_at?: string | null
          status_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          access_code: string | null
          created_at: string
          email: string
          failed_login_attempts: number | null
          full_name: string
          id: string
          lockout_until: string | null
          notes: string | null
          phone: string | null
          specializations: string[] | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          email: string
          failed_login_attempts?: number | null
          full_name: string
          id?: string
          lockout_until?: string | null
          notes?: string | null
          phone?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          email?: string
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          lockout_until?: string | null
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
          base_pack: string | null
          category: string
          created_at: string
          description: string | null
          display_label: string | null
          group_key: string | null
          id: string
          incident_at: string | null
          incident_reason: string | null
          incident_type: string | null
          is_4k: boolean | null
          is_active: boolean | null
          is_hd: boolean | null
          name: string
          price: number | null
          replacement_channel_id: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_pack?: string | null
          category: string
          created_at?: string
          description?: string | null
          display_label?: string | null
          group_key?: string | null
          id?: string
          incident_at?: string | null
          incident_reason?: string | null
          incident_type?: string | null
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name: string
          price?: number | null
          replacement_channel_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_pack?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_label?: string | null
          group_key?: string | null
          id?: string
          incident_at?: string | null
          incident_reason?: string | null
          incident_type?: string | null
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name?: string
          price?: number | null
          replacement_channel_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_channels_replacement_channel_id_fkey"
            columns: ["replacement_channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_channels_replacement_channel_id_fkey"
            columns: ["replacement_channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
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
      work_order_files: {
        Row: {
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by_technician_id: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by_technician_id?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by_technician_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_files_uploaded_by_technician_id_fkey"
            columns: ["uploaded_by_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_files_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_updates: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string
          id: string
          new_status: string | null
          note: string | null
          old_status: string | null
          work_order_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          work_order_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_updates_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_technician_id: string | null
          checklist: Json | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          equipment_details: Json | null
          id: string
          internal_notes: string | null
          linked_appointment_id: string | null
          linked_order_id: string | null
          notes: string | null
          priority: string | null
          replacement_order_id: string | null
          replacement_ticket_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          service_province: string | null
          service_type: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_technician_id?: string | null
          checklist?: Json | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          equipment_details?: Json | null
          id?: string
          internal_notes?: string | null
          linked_appointment_id?: string | null
          linked_order_id?: string | null
          notes?: string | null
          priority?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          type?: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_technician_id?: string | null
          checklist?: Json | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          equipment_details?: Json | null
          id?: string
          internal_notes?: string | null
          linked_appointment_id?: string | null
          linked_order_id?: string | null
          notes?: string | null
          priority?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          service_province?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          type?: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_linked_appointment_id_fkey"
            columns: ["linked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "replacement_internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_replacement_ticket_id_fkey"
            columns: ["replacement_ticket_id"]
            isOneToOne: false
            referencedRelation: "replacement_request_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_unpaid_invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          client_id: string | null
          description: string | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          issue_date: string | null
          period_end: string | null
          period_start: string | null
          source_table: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      tv_channels_public: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          incident_at: string | null
          incident_reason: string | null
          incident_type: string | null
          is_4k: boolean | null
          is_active: boolean | null
          is_hd: boolean | null
          name: string | null
          replacement_channel_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          incident_at?: string | null
          incident_reason?: string | null
          incident_type?: string | null
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name?: string | null
          replacement_channel_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          incident_at?: string | null
          incident_reason?: string | null
          incident_type?: string | null
          is_4k?: boolean | null
          is_active?: boolean | null
          is_hd?: boolean | null
          name?: string | null
          replacement_channel_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_channels_replacement_channel_id_fkey"
            columns: ["replacement_channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_channels_replacement_channel_id_fkey"
            columns: ["replacement_channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_link_id?: string
          p_link_target?: string
          p_message?: string
          p_title: string
          p_type: string
          p_user_id: string
          p_user_role: string
        }
        Returns: string
      }
      flag_client_for_risk: {
        Args: {
          p_alert_level?: string
          p_client_id: string
          p_order_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      generate_account_number: { Args: never; Returns: string }
      generate_appointment_number: { Args: never; Returns: string }
      generate_client_number: { Args: never; Returns: string }
      generate_confirmation_number: { Args: never; Returns: string }
      generate_contract_number: { Args: never; Returns: string }
      generate_internal_ticket_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_monthly_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_payment_number: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      generate_replacement_internal_order_number: {
        Args: never
        Returns: string
      }
      generate_replacement_order_number: { Args: never; Returns: string }
      generate_replacement_request_ticket_number: {
        Args: never
        Returns: string
      }
      generate_replacement_ticket_number: { Args: never; Returns: string }
      generate_request_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      generate_work_order_number: { Args: never; Returns: string }
      get_client_balance: { Args: { p_client_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_pin: { Args: { pin: string }; Returns: string }
      is_assigned_technician: {
        Args: { _work_order_id: string }
        Returns: boolean
      }
      lift_client_suspension: {
        Args: { p_client_id: string; p_require_pin_reset?: boolean }
        Returns: undefined
      }
      queue_email: {
        Args: {
          p_event_key: string
          p_template_key: string
          p_template_vars?: Json
          p_to_email: string
        }
        Returns: string
      }
      verify_pin: {
        Args: { pin_input: string; user_id_input: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "technician" | "employee"
      fulfillment_type: "ship" | "technician" | "pickup"
      internal_order_status:
        | "draft"
        | "quoted"
        | "invoiced"
        | "awaiting_payment"
        | "ready_to_fulfill"
        | "shipped"
        | "tech_dispatched"
        | "completed"
        | "cancelled"
      replacement_order_status:
        | "open"
        | "awaiting_decision"
        | "awaiting_payment"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "closed"
      replacement_order_type: "warranty_replacement" | "paid_replacement"
      replacement_reason:
        | "defective"
        | "damaged"
        | "lost"
        | "theft"
        | "malfunction"
        | "upgrade"
        | "other"
      replacement_ticket_category:
        | "replacement"
        | "sim"
        | "accessory"
        | "phone"
        | "equipment"
        | "other"
      replacement_ticket_reason:
        | "lost"
        | "stolen"
        | "broken"
        | "defective"
        | "upgrade"
        | "other"
      replacement_ticket_status:
        | "open"
        | "needs_quote"
        | "quote_sent"
        | "quote_approved"
        | "invoiced"
        | "awaiting_payment"
        | "paid"
        | "fulfillment_in_progress"
        | "completed"
        | "cancelled"
      work_order_status:
        | "assigned"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      work_order_type:
        | "installation"
        | "service_call"
        | "replacement"
        | "maintenance"
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
      fulfillment_type: ["ship", "technician", "pickup"],
      internal_order_status: [
        "draft",
        "quoted",
        "invoiced",
        "awaiting_payment",
        "ready_to_fulfill",
        "shipped",
        "tech_dispatched",
        "completed",
        "cancelled",
      ],
      replacement_order_status: [
        "open",
        "awaiting_decision",
        "awaiting_payment",
        "ready_to_ship",
        "shipped",
        "delivered",
        "cancelled",
        "closed",
      ],
      replacement_order_type: ["warranty_replacement", "paid_replacement"],
      replacement_reason: [
        "defective",
        "damaged",
        "lost",
        "theft",
        "malfunction",
        "upgrade",
        "other",
      ],
      replacement_ticket_category: [
        "replacement",
        "sim",
        "accessory",
        "phone",
        "equipment",
        "other",
      ],
      replacement_ticket_reason: [
        "lost",
        "stolen",
        "broken",
        "defective",
        "upgrade",
        "other",
      ],
      replacement_ticket_status: [
        "open",
        "needs_quote",
        "quote_sent",
        "quote_approved",
        "invoiced",
        "awaiting_payment",
        "paid",
        "fulfillment_in_progress",
        "completed",
        "cancelled",
      ],
      work_order_status: [
        "assigned",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      work_order_type: [
        "installation",
        "service_call",
        "replacement",
        "maintenance",
      ],
    },
  },
} as const
