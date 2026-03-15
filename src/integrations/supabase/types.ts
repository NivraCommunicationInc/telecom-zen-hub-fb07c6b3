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
      account_access_logs: {
        Row: {
          access_granted: boolean
          client_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          method: string
          portal: string | null
          reason: string
          staff_user_id: string
          user_agent: string | null
          verified_fields: Json | null
        }
        Insert: {
          access_granted?: boolean
          client_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          method: string
          portal?: string | null
          reason: string
          staff_user_id: string
          user_agent?: string | null
          verified_fields?: Json | null
        }
        Update: {
          access_granted?: boolean
          client_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          portal?: string | null
          reason?: string
          staff_user_id?: string
          user_agent?: string | null
          verified_fields?: Json | null
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          client_id: string
          created_at: string
          data_export_completed: boolean | null
          final_deletion_date: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          processed_by_role: string | null
          reason: string | null
          request_type: string
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          client_id: string
          created_at?: string
          data_export_completed?: boolean | null
          final_deletion_date?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          processed_by_role?: string | null
          reason?: string | null
          request_type: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          client_id?: string
          created_at?: string
          data_export_completed?: boolean | null
          final_deletion_date?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          processed_by_role?: string | null
          reason?: string | null
          request_type?: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          billing_anchor_date: string | null
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
          next_invoice_date: string | null
          number_lost_at: string | null
          number_lost_by: string | null
          number_lost_reason: string | null
          primary_service_address: string | null
          primary_service_city: string | null
          primary_service_postal_code: string | null
          primary_service_province: string | null
          recouvrement_reminder_sent_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          billing_address?: string | null
          billing_anchor_date?: string | null
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
          next_invoice_date?: string | null
          number_lost_at?: string | null
          number_lost_by?: string | null
          number_lost_reason?: string | null
          primary_service_address?: string | null
          primary_service_city?: string | null
          primary_service_postal_code?: string | null
          primary_service_province?: string | null
          recouvrement_reminder_sent_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          billing_address?: string | null
          billing_anchor_date?: string | null
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
          next_invoice_date?: string | null
          number_lost_at?: string | null
          number_lost_by?: string | null
          number_lost_reason?: string | null
          primary_service_address?: string | null
          primary_service_city?: string | null
          primary_service_postal_code?: string | null
          primary_service_province?: string | null
          recouvrement_reminder_sent_at?: string | null
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
      admin_access_limits: {
        Row: {
          created_at: string | null
          id: string
          max_admins: number
          max_staff: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_admins?: number
          max_staff?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_admins?: number
          max_staff?: number
          updated_at?: string | null
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
      admin_audit_sessions: {
        Row: {
          admin_email: string | null
          admin_user_id: string
          consumed_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          issued_at: string
          magic_link_hash: string | null
          reason: string
          redirect_to: string | null
          revoked_at: string | null
          session_token: string | null
          target_email: string
          target_user_id: string
        }
        Insert: {
          admin_email?: string | null
          admin_user_id: string
          consumed_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          issued_at?: string
          magic_link_hash?: string | null
          reason: string
          redirect_to?: string | null
          revoked_at?: string | null
          session_token?: string | null
          target_email: string
          target_user_id: string
        }
        Update: {
          admin_email?: string | null
          admin_user_id?: string
          consumed_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          issued_at?: string
          magic_link_hash?: string | null
          reason?: string
          redirect_to?: string | null
          revoked_at?: string | null
          session_token?: string | null
          target_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      admin_auth_audit_log: {
        Row: {
          admin_user_id: string
          created_at: string
          email: string
          event: string
          id: string
          meta: Json | null
          request_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          email: string
          event: string
          id?: string
          meta?: Json | null
          request_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          email?: string
          event?: string
          id?: string
          meta?: Json | null
          request_id?: string
        }
        Relationships: []
      }
      admin_notification_logs: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          email_id: string | null
          event_id: string | null
          event_number: string | null
          event_type: string
          id: string
          priority: string | null
          sent_to: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          email_id?: string | null
          event_id?: string | null
          event_number?: string | null
          event_type: string
          id?: string
          priority?: string | null
          sent_to?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          email_id?: string | null
          event_id?: string | null
          event_number?: string | null
          event_type?: string
          id?: string
          priority?: string | null
          sent_to?: string | null
        }
        Relationships: []
      }
      admin_notification_settings: {
        Row: {
          category: string
          created_at: string | null
          digest_interval_minutes: number | null
          email_recipients: string[] | null
          id: string
          is_enabled: boolean | null
          rate_limit_per_hour: number | null
          setting_key: string
          setting_label: string
          updated_at: string | null
          use_digest: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          digest_interval_minutes?: number | null
          email_recipients?: string[] | null
          id?: string
          is_enabled?: boolean | null
          rate_limit_per_hour?: number | null
          setting_key: string
          setting_label: string
          updated_at?: string | null
          use_digest?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          digest_interval_minutes?: number | null
          email_recipients?: string[] | null
          id?: string
          is_enabled?: boolean | null
          rate_limit_per_hour?: number | null
          setting_key?: string
          setting_label?: string
          updated_at?: string | null
          use_digest?: boolean | null
        }
        Relationships: []
      }
      admin_otp_codes: {
        Row: {
          admin_user_id: string
          attempts: number
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          ip: string | null
          locked_at: string | null
          max_attempts: number
          otp_hash: string
          request_id: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          ip?: string | null
          locked_at?: string | null
          max_attempts?: number
          otp_hash: string
          request_id: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip?: string | null
          locked_at?: string | null
          max_attempts?: number
          otp_hash?: string
          request_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_otp_sessions: {
        Row: {
          admin_user_id: string
          expires_at: string
          id: string
          request_id: string
          revoked_at: string | null
          session_token_hash: string
          verified_at: string
        }
        Insert: {
          admin_user_id: string
          expires_at?: string
          id?: string
          request_id: string
          revoked_at?: string | null
          session_token_hash: string
          verified_at?: string
        }
        Update: {
          admin_user_id?: string
          expires_at?: string
          id?: string
          request_id?: string
          revoked_at?: string | null
          session_token_hash?: string
          verified_at?: string
        }
        Relationships: []
      }
      admin_secret_attempts: {
        Row: {
          admin_user_id: string
          attempts: number
          created_at: string
          id: string
          locked_until: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          attempts?: number
          created_at?: string
          id?: string
          locked_until?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          attempts?: number
          created_at?: string
          id?: string
          locked_until?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_secret_audit_log: {
        Row: {
          admin_user_id: string
          created_at: string
          event: string
          id: string
          ip_address: string | null
          meta: Json | null
          request_id: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          event: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          request_id: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          event?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          request_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_security_audit: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_security_codes: {
        Row: {
          admin_user_id: string
          code_hash: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          code_hash: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          code_hash?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          user_id?: string
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
          environment: string
          equipment_details: Json | null
          hold_expires_at: string | null
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
          environment?: string
          equipment_details?: Json | null
          hold_expires_at?: string | null
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
          environment?: string
          equipment_details?: Json | null
          hold_expires_at?: string | null
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
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
      automatic_email_dispatches: {
        Row: {
          created_at: string
          event_scope: string
          event_type: string
          event_version: string
          first_email_queue_id: string | null
          id: string
          source_event_key: string
          template_key: string
        }
        Insert: {
          created_at?: string
          event_scope: string
          event_type: string
          event_version?: string
          first_email_queue_id?: string | null
          id?: string
          source_event_key: string
          template_key: string
        }
        Update: {
          created_at?: string
          event_scope?: string
          event_type?: string
          event_version?: string
          first_email_queue_id?: string | null
          id?: string
          source_event_key?: string
          template_key?: string
        }
        Relationships: []
      }
      billing: {
        Row: {
          activation_fee: number | null
          amount: number
          amount_paid: number | null
          balance_due: number | null
          captured_at: string | null
          client_email: string | null
          created_at: string
          credits: number | null
          delivery_fee: number | null
          discount_amount: number | null
          due_date: string | null
          environment: string
          equipment_id: string | null
          etransfer_reference: string | null
          etransfer_status: string | null
          fees: number | null
          id: string
          installation_fee: number | null
          invoice_number: string | null
          is_preauthorized: boolean | null
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          ledger_entry_id: string | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method_type: string | null
          payment_reference: string | null
          preauth_discount: number | null
          preauth_discount_applied: boolean | null
          preauthorized_at: string | null
          proof_submitted_at: string | null
          related_order_number: string | null
          replacement_order_id: string | null
          replacement_ticket_id: string | null
          service_activated_at: string | null
          service_status: string | null
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
          balance_due?: number | null
          captured_at?: string | null
          client_email?: string | null
          created_at?: string
          credits?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          due_date?: string | null
          environment?: string
          equipment_id?: string | null
          etransfer_reference?: string | null
          etransfer_status?: string | null
          fees?: number | null
          id?: string
          installation_fee?: number | null
          invoice_number?: string | null
          is_preauthorized?: boolean | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          ledger_entry_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          payment_reference?: string | null
          preauth_discount?: number | null
          preauth_discount_applied?: boolean | null
          preauthorized_at?: string | null
          proof_submitted_at?: string | null
          related_order_number?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
          service_activated_at?: string | null
          service_status?: string | null
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
          balance_due?: number | null
          captured_at?: string | null
          client_email?: string | null
          created_at?: string
          credits?: number | null
          delivery_fee?: number | null
          discount_amount?: number | null
          due_date?: string | null
          environment?: string
          equipment_id?: string | null
          etransfer_reference?: string | null
          etransfer_status?: string | null
          fees?: number | null
          id?: string
          installation_fee?: number | null
          invoice_number?: string | null
          is_preauthorized?: boolean | null
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          ledger_entry_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          payment_reference?: string | null
          preauth_discount?: number | null
          preauth_discount_applied?: boolean | null
          preauthorized_at?: string | null
          proof_submitted_at?: string | null
          related_order_number?: string | null
          replacement_order_id?: string | null
          replacement_ticket_id?: string | null
          service_activated_at?: string | null
          service_status?: string | null
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
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
      billing_automation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          errors_count: number | null
          id: string
          invoices_voided: number | null
          processed_items: Json | null
          reminders_queued: number | null
          renewals_generated: number | null
          run_type: string
          started_at: string
          status: string
          subscriptions_expired: number | null
          summary: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          errors_count?: number | null
          id?: string
          invoices_voided?: number | null
          processed_items?: Json | null
          reminders_queued?: number | null
          renewals_generated?: number | null
          run_type: string
          started_at?: string
          status?: string
          subscriptions_expired?: number | null
          summary?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          errors_count?: number | null
          id?: string
          invoices_voided?: number | null
          processed_items?: Json | null
          reminders_queued?: number | null
          renewals_generated?: number | null
          run_type?: string
          started_at?: string
          status?: string
          subscriptions_expired?: number | null
          summary?: string | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          status: Database["public"]["Enums"]["billing_customer_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone: string
          status?: Database["public"]["Enums"]["billing_customer_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          status?: Database["public"]["Enums"]["billing_customer_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_invoice_lines: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          line_total: number
          line_type: string
          metadata: Json | null
          quantity: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total: number
          line_type?: string
          metadata?: Json | null
          quantity?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          line_type?: string
          metadata?: Json | null
          quantity?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          activation_fee: number | null
          address_snapshot: Json | null
          amount_paid: number | null
          balance_due: number | null
          billing_snapshot_account_number: string | null
          billing_snapshot_client: Json | null
          billing_snapshot_payment: Json | null
          created_at: string | null
          currency: string | null
          customer_id: string
          cycle_end_date: string
          cycle_start_date: string
          due_date: string
          environment: string
          fees: number | null
          id: string
          invoice_number: string
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method:
            | Database["public"]["Enums"]["billing_payment_method"]
            | null
          status: Database["public"]["Enums"]["billing_invoice_status"] | null
          subscription_id: string | null
          subtotal: number
          total: number
          tps_amount: number
          tvq_amount: number
          type: Database["public"]["Enums"]["billing_invoice_type"]
        }
        Insert: {
          activation_fee?: number | null
          address_snapshot?: Json | null
          amount_paid?: number | null
          balance_due?: number | null
          billing_snapshot_account_number?: string | null
          billing_snapshot_client?: Json | null
          billing_snapshot_payment?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          cycle_end_date: string
          cycle_start_date: string
          due_date: string
          environment?: string
          fees?: number | null
          id?: string
          invoice_number: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["billing_payment_method"]
            | null
          status?: Database["public"]["Enums"]["billing_invoice_status"] | null
          subscription_id?: string | null
          subtotal?: number
          total?: number
          tps_amount?: number
          tvq_amount?: number
          type: Database["public"]["Enums"]["billing_invoice_type"]
        }
        Update: {
          activation_fee?: number | null
          address_snapshot?: Json | null
          amount_paid?: number | null
          balance_due?: number | null
          billing_snapshot_account_number?: string | null
          billing_snapshot_client?: Json | null
          billing_snapshot_payment?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          cycle_end_date?: string
          cycle_start_date?: string
          due_date?: string
          environment?: string
          fees?: number | null
          id?: string
          invoice_number?: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["billing_payment_method"]
            | null
          status?: Database["public"]["Enums"]["billing_invoice_status"] | null
          subscription_id?: string | null
          subtotal?: number
          total?: number
          tps_amount?: number
          tvq_amount?: number
          type?: Database["public"]["Enums"]["billing_invoice_type"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["billing_customer_id"]
          },
          {
            foreignKeyName: "billing_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "billing_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          confirmed_by: string | null
          created_at: string | null
          created_by_id: string | null
          created_by_name: string | null
          created_by_role: string | null
          customer_id: string
          environment: string
          id: string
          invoice_id: string
          legacy_note: string | null
          method: Database["public"]["Enums"]["billing_payment_method"]
          payment_number: string
          provider: string | null
          provider_payment_id: string | null
          received_at: string | null
          reference: string | null
          source: string | null
          status: Database["public"]["Enums"]["billing_payment_status"] | null
        }
        Insert: {
          amount: number
          confirmed_by?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          customer_id: string
          environment?: string
          id?: string
          invoice_id: string
          legacy_note?: string | null
          method?: Database["public"]["Enums"]["billing_payment_method"]
          payment_number: string
          provider?: string | null
          provider_payment_id?: string | null
          received_at?: string | null
          reference?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["billing_payment_status"] | null
        }
        Update: {
          amount?: number
          confirmed_by?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          customer_id?: string
          environment?: string
          id?: string
          invoice_id?: string
          legacy_note?: string | null
          method?: Database["public"]["Enums"]["billing_payment_method"]
          payment_number?: string
          provider?: string | null
          provider_payment_id?: string | null
          received_at?: string | null
          reference?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["billing_payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["billing_customer_id"]
          },
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      billing_subscription_services: {
        Row: {
          added_at: string
          created_at: string
          id: string
          is_active: boolean
          quantity: number
          removed_at: string | null
          service_code: string
          service_name: string
          service_type: string
          subscription_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          quantity?: number
          removed_at?: string | null
          service_code: string
          service_name: string
          service_type?: string
          subscription_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          added_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          quantity?: number
          removed_at?: string | null
          service_code?: string
          service_name?: string
          service_type?: string
          subscription_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscription_services_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscription_trace_audit: {
        Row: {
          action: string
          actor_admin_id: string | null
          created_at: string
          customer_id: string
          details: Json
          id: string
          reason: string | null
          source_id: string | null
          source_type: string | null
          subscription_id: string
        }
        Insert: {
          action: string
          actor_admin_id?: string | null
          created_at?: string
          customer_id: string
          details?: Json
          id?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          subscription_id: string
        }
        Update: {
          action?: string
          actor_admin_id?: string | null
          created_at?: string
          customer_id?: string
          details?: Json
          id?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscription_trace_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscription_trace_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["billing_customer_id"]
          },
          {
            foreignKeyName: "billing_subscription_trace_audit_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          address_id: string | null
          auto_billing_enabled: boolean | null
          created_at: string | null
          customer_id: string
          cycle_end_date: string
          cycle_start_date: string
          environment: string
          id: string
          last_invoice_id: string | null
          order_id: string | null
          paypal_plan_id: string | null
          paypal_subscription_id: string | null
          plan_code: string
          plan_name: string
          plan_price: number
          service_category: string | null
          source_id: string | null
          source_type: string | null
          status:
            | Database["public"]["Enums"]["billing_subscription_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          address_id?: string | null
          auto_billing_enabled?: boolean | null
          created_at?: string | null
          customer_id: string
          cycle_end_date: string
          cycle_start_date: string
          environment?: string
          id?: string
          last_invoice_id?: string | null
          order_id?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_code: string
          plan_name: string
          plan_price: number
          service_category?: string | null
          source_id?: string | null
          source_type?: string | null
          status?:
            | Database["public"]["Enums"]["billing_subscription_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          address_id?: string | null
          auto_billing_enabled?: boolean | null
          created_at?: string | null
          customer_id?: string
          cycle_end_date?: string
          cycle_start_date?: string
          environment?: string
          id?: string
          last_invoice_id?: string | null
          order_id?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_code?: string
          plan_name?: string
          plan_price?: number
          service_category?: string | null
          source_id?: string | null
          source_type?: string | null
          status?:
            | Database["public"]["Enums"]["billing_subscription_status"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "service_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "qa_orphaned_payments"
            referencedColumns: ["billing_customer_id"]
          },
          {
            foreignKeyName: "billing_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "billing_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_system_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_reference: string | null
          entity_type: string
          id: string
          is_canonical_exception: boolean | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_reference?: string | null
          entity_type: string
          id?: string
          is_canonical_exception?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_reference?: string | null
          entity_type?: string
          id?: string
          is_canonical_exception?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      cashout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          destination: string
          id: string
          influencer_id: string
          method: string
          request_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["cashout_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          destination: string
          id?: string
          influencer_id: string
          method?: string
          request_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cashout_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          destination?: string
          id?: string
          influencer_id?: string
          method?: string
          request_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cashout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashout_requests_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
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
          order_id: string | null
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
          order_id?: string | null
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
          order_id?: string | null
          related_ticket_id?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_selections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "channel_selections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_selections_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_selections_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_logs: {
        Row: {
          actions_taken: Json | null
          bot_response: string
          created_at: string
          entities_extracted: Json | null
          id: string
          intent_detected: string | null
          is_authenticated: boolean | null
          message_hash: string | null
          message_length: number | null
          response_length: number | null
          session_id: string
          user_id: string | null
          user_message: string
        }
        Insert: {
          actions_taken?: Json | null
          bot_response: string
          created_at?: string
          entities_extracted?: Json | null
          id?: string
          intent_detected?: string | null
          is_authenticated?: boolean | null
          message_hash?: string | null
          message_length?: number | null
          response_length?: number | null
          session_id: string
          user_id?: string | null
          user_message: string
        }
        Update: {
          actions_taken?: Json | null
          bot_response?: string
          created_at?: string
          entities_extracted?: Json | null
          id?: string
          intent_detected?: string | null
          is_authenticated?: boolean | null
          message_hash?: string | null
          message_length?: number | null
          response_length?: number | null
          session_id?: string
          user_id?: string | null
          user_message?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          appointment_id: string | null
          cart_items: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          identity_data: Json | null
          kyc_session_id: string | null
          payment_method: string | null
          pricing_snapshot: Json | null
          promo_code: string | null
          service_address: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          cart_items?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          identity_data?: Json | null
          kyc_session_id?: string | null
          payment_method?: string | null
          pricing_snapshot?: Json | null
          promo_code?: string | null
          service_address?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          cart_items?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          identity_data?: Json | null
          kyc_session_id?: string | null
          payment_method?: string | null
          pricing_snapshot?: Json | null
          promo_code?: string | null
          service_address?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      client_billing_preferences: {
        Row: {
          created_at: string
          preauth_discount_active: boolean
          preauth_discount_amount: number | null
          preauth_opt_in: boolean
          preauth_opt_in_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preauth_discount_active?: boolean
          preauth_discount_amount?: number | null
          preauth_opt_in?: boolean
          preauth_opt_in_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preauth_discount_active?: boolean
          preauth_discount_amount?: number | null
          preauth_opt_in?: boolean
          preauth_opt_in_at?: string | null
          updated_at?: string
          user_id?: string
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
      client_email_preferences: {
        Row: {
          billing_notifications: boolean | null
          client_id: string
          consent_given_at: string | null
          consent_source: string | null
          id: string
          marketing_emails: boolean | null
          newsletter: boolean | null
          preferred_contact_method: string | null
          promotional_emails: boolean | null
          service_updates: boolean | null
          sms_invoices: boolean | null
          sms_reminders: boolean | null
          sms_service_updates: boolean | null
          updated_at: string
        }
        Insert: {
          billing_notifications?: boolean | null
          client_id: string
          consent_given_at?: string | null
          consent_source?: string | null
          id?: string
          marketing_emails?: boolean | null
          newsletter?: boolean | null
          preferred_contact_method?: string | null
          promotional_emails?: boolean | null
          service_updates?: boolean | null
          sms_invoices?: boolean | null
          sms_reminders?: boolean | null
          sms_service_updates?: boolean | null
          updated_at?: string
        }
        Update: {
          billing_notifications?: boolean | null
          client_id?: string
          consent_given_at?: string | null
          consent_source?: string | null
          id?: string
          marketing_emails?: boolean | null
          newsletter?: boolean | null
          preferred_contact_method?: string | null
          promotional_emails?: boolean | null
          service_updates?: boolean | null
          sms_invoices?: boolean | null
          sms_reminders?: boolean | null
          sms_service_updates?: boolean | null
          updated_at?: string
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
      client_login_pins: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          pin_hash: string
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at: string
          id?: string
          pin_hash: string
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          pin_hash?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      client_notification_logs: {
        Row: {
          client_email: string
          client_name: string | null
          created_at: string
          email_id: string | null
          email_sent: boolean | null
          entity_id: string | null
          entity_number: string | null
          entity_type: string | null
          event_key: string
          event_type: string
          id: string
          portal_path: string | null
        }
        Insert: {
          client_email: string
          client_name?: string | null
          created_at?: string
          email_id?: string | null
          email_sent?: boolean | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string | null
          event_key: string
          event_type: string
          id?: string
          portal_path?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string | null
          created_at?: string
          email_id?: string | null
          email_sent?: boolean | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string | null
          event_key?: string
          event_type?: string
          id?: string
          portal_path?: string | null
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
      client_profile_changes: {
        Row: {
          changed_by_id: string
          changed_by_role: string
          client_id: string
          created_at: string
          field_name: string
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_by_id: string
          changed_by_role?: string
          client_id: string
          created_at?: string
          field_name: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_by_id?: string
          changed_by_role?: string
          client_id?: string
          created_at?: string
          field_name?: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      client_streaming_subscriptions: {
        Row: {
          account_id: string | null
          cancel_at_period_end: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_employee_email: string | null
          cancelled_by_employee_id: string | null
          created_at: string
          discount_amount: number | null
          effective_end_date: string | null
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
          cancel_at_period_end?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_employee_email?: string | null
          cancelled_by_employee_id?: string | null
          created_at?: string
          discount_amount?: number | null
          effective_end_date?: string | null
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
          cancel_at_period_end?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_employee_email?: string | null
          cancelled_by_employee_id?: string | null
          created_at?: string
          discount_amount?: number | null
          effective_end_date?: string | null
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
      commission_ledger_entries: {
        Row: {
          amount: number
          approved_at: string | null
          attribution_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          influencer_id: string
          invoice_id: string | null
          notes: string | null
          status: string
          type: Database["public"]["Enums"]["commission_ledger_type"]
        }
        Insert: {
          amount: number
          approved_at?: string | null
          attribution_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          influencer_id: string
          invoice_id?: string | null
          notes?: string | null
          status?: string
          type: Database["public"]["Enums"]["commission_ledger_type"]
        }
        Update: {
          amount?: number
          approved_at?: string | null
          attribution_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          influencer_id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: string
          type?: Database["public"]["Enums"]["commission_ledger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_entries_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "referral_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_entries_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          model: Database["public"]["Enums"]["commission_model_type"]
          name: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          model?: Database["public"]["Enums"]["commission_model_type"]
          name: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          model?: Database["public"]["Enums"]["commission_model_type"]
          name?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
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
          page_url: string | null
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
          page_url?: string | null
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
          page_url?: string | null
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
      contest_entries: {
        Row: {
          contest_slug: string
          created_at: string
          email_snapshot: string
          full_name_snapshot: string | null
          id: string
          order_id: string | null
          phone_snapshot: string | null
          promo_code_snapshot: string | null
          user_id: string
        }
        Insert: {
          contest_slug: string
          created_at?: string
          email_snapshot: string
          full_name_snapshot?: string | null
          id?: string
          order_id?: string | null
          phone_snapshot?: string | null
          promo_code_snapshot?: string | null
          user_id: string
        }
        Update: {
          contest_slug?: string
          created_at?: string
          email_snapshot?: string
          full_name_snapshot?: string | null
          id?: string
          order_id?: string | null
          phone_snapshot?: string | null
          promo_code_snapshot?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "contest_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_winners: {
        Row: {
          contest_slug: string
          created_at: string
          drawn_at: string
          drawn_by_admin_id: string | null
          id: string
          notes: string | null
          winner_email: string | null
          winner_entry_id: string
          winner_name: string | null
          winner_user_id: string
        }
        Insert: {
          contest_slug: string
          created_at?: string
          drawn_at?: string
          drawn_by_admin_id?: string | null
          id?: string
          notes?: string | null
          winner_email?: string | null
          winner_entry_id: string
          winner_name?: string | null
          winner_user_id: string
        }
        Update: {
          contest_slug?: string
          created_at?: string
          drawn_at?: string
          drawn_by_admin_id?: string | null
          id?: string
          notes?: string | null
          winner_email?: string | null
          winner_entry_id?: string
          winner_name?: string | null
          winner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_winners_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "contest_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          admin_signed_at: string | null
          admin_signer_id: string | null
          admin_signer_name: string | null
          client_signature: string | null
          client_signature_type: string | null
          client_signed_at: string | null
          contract_name: string
          contract_number: string | null
          contract_pdf_stored_at: string | null
          contract_pdf_url: string | null
          contract_url: string
          created_at: string
          id: string
          is_signed: boolean | null
          order_id: string | null
          owner_user_id: string
          pdf_generated_at: string | null
          pdf_hash: string | null
          sent_at: string | null
          sent_count: number | null
          signature_token: string | null
          signature_token_expires_at: string | null
          signature_token_hash: string | null
          signature_token_role: string | null
          signature_token_used_at: string | null
          signed_at: string | null
          status: string | null
          template_id: string
          template_version: string
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          admin_signed_at?: string | null
          admin_signer_id?: string | null
          admin_signer_name?: string | null
          client_signature?: string | null
          client_signature_type?: string | null
          client_signed_at?: string | null
          contract_name: string
          contract_number?: string | null
          contract_pdf_stored_at?: string | null
          contract_pdf_url?: string | null
          contract_url: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          order_id?: string | null
          owner_user_id: string
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          sent_at?: string | null
          sent_count?: number | null
          signature_token?: string | null
          signature_token_expires_at?: string | null
          signature_token_hash?: string | null
          signature_token_role?: string | null
          signature_token_used_at?: string | null
          signed_at?: string | null
          status?: string | null
          template_id?: string
          template_version?: string
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          admin_signed_at?: string | null
          admin_signer_id?: string | null
          admin_signer_name?: string | null
          client_signature?: string | null
          client_signature_type?: string | null
          client_signed_at?: string | null
          contract_name?: string
          contract_number?: string | null
          contract_pdf_stored_at?: string | null
          contract_pdf_url?: string | null
          contract_url?: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          order_id?: string | null
          owner_user_id?: string
          pdf_generated_at?: string | null
          pdf_hash?: string | null
          sent_at?: string | null
          sent_count?: number | null
          signature_token?: string | null
          signature_token_expires_at?: string | null
          signature_token_hash?: string | null
          signature_token_role?: string | null
          signature_token_used_at?: string | null
          signed_at?: string | null
          status?: string | null
          template_id?: string
          template_version?: string
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_ipn_logs: {
        Row: {
          created_at: string
          crypto_payment_id: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payment_id: string | null
          processed: boolean
          raw_payload: Json
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          crypto_payment_id?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payment_id?: string | null
          processed?: boolean
          raw_payload: Json
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          crypto_payment_id?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payment_id?: string | null
          processed?: boolean
          raw_payload?: Json
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crypto_ipn_logs_crypto_payment_id_fkey"
            columns: ["crypto_payment_id"]
            isOneToOne: false
            referencedRelation: "crypto_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_payments: {
        Row: {
          actually_paid: number | null
          billing_id: string | null
          client_id: string
          created_at: string
          id: string
          invoice_url: string | null
          notes: string | null
          order_id: string | null
          outcome_amount: number | null
          outcome_currency: string | null
          pay_address: string | null
          pay_amount: number | null
          pay_currency: string
          payment_id: string | null
          payment_status: string
          price_amount: number
          price_currency: string
          provider: string
          raw_ipn: Json | null
          reconciled_at: string | null
          reconciled_by: string | null
          txid: string | null
          updated_at: string
        }
        Insert: {
          actually_paid?: number | null
          billing_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          invoice_url?: string | null
          notes?: string | null
          order_id?: string | null
          outcome_amount?: number | null
          outcome_currency?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency: string
          payment_id?: string | null
          payment_status?: string
          price_amount: number
          price_currency?: string
          provider?: string
          raw_ipn?: Json | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          txid?: string | null
          updated_at?: string
        }
        Update: {
          actually_paid?: number | null
          billing_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          invoice_url?: string | null
          notes?: string | null
          order_id?: string | null
          outcome_amount?: number | null
          outcome_currency?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string
          payment_id?: string | null
          payment_status?: string
          price_amount?: number
          price_currency?: string
          provider?: string
          raw_ipn?: Json | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          txid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "crypto_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referral_usage: {
        Row: {
          attribution_id: string
          customer_email: string
          customer_id: string
          id: string
          used_at: string
        }
        Insert: {
          attribution_id: string
          customer_email: string
          customer_id: string
          id?: string
          used_at?: string
        }
        Update: {
          attribution_id?: string
          customer_email?: string
          customer_id?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_referral_usage_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "referral_attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_email_recipients: {
        Row: {
          client_id: string | null
          created_at: string
          direct_email_id: string
          email: string
          error_message: string | null
          id: string
          name: string | null
          resend_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          direct_email_id: string
          email: string
          error_message?: string | null
          id?: string
          name?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          direct_email_id?: string
          email?: string
          error_message?: string | null
          id?: string
          name?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_email_recipients_direct_email_id_fkey"
            columns: ["direct_email_id"]
            isOneToOne: false
            referencedRelation: "direct_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_emails: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          message: string
          recipients_count: number
          sent_at: string | null
          sent_by_email: string | null
          sent_count: number
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          message: string
          recipients_count?: number
          sent_at?: string | null
          sent_by_email?: string | null
          sent_count?: number
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          message?: string
          recipients_count?: number
          sent_at?: string | null
          sent_by_email?: string | null
          sent_count?: number
          status?: string
          subject?: string
        }
        Relationships: []
      }
      dob_validation_debug: {
        Row: {
          calculated_age: number | null
          column_name: string
          created_at: string
          id: string
          raw_value: string | null
          result: string | null
          table_name: string
        }
        Insert: {
          calculated_age?: number | null
          column_name: string
          created_at?: string
          id?: string
          raw_value?: string | null
          result?: string | null
          table_name: string
        }
        Update: {
          calculated_age?: number | null
          column_name?: string
          created_at?: string
          id?: string
          raw_value?: string | null
          result?: string | null
          table_name?: string
        }
        Relationships: []
      }
      document_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          request_reason: string | null
          request_token: string
          required_documents: Json
          status: string
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          request_reason?: string | null
          request_token: string
          required_documents?: Json
          status?: string
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          request_reason?: string | null
          request_token?: string
          required_documents?: Json
          status?: string
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          delay_minutes: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          segment_filters: Json | null
          subject_override: string | null
          template_id: string | null
          total_sent: number | null
          total_triggered: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          segment_filters?: Json | null
          subject_override?: string | null
          template_id?: string | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          segment_filters?: Json | null
          subject_override?: string | null
          template_id?: string | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          campaign_number: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          segment_filters: Json | null
          started_at: string | null
          status: string
          subject_override: string | null
          template_id: string | null
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          type: string
          updated_at: string
        }
        Insert: {
          campaign_number?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          segment_filters?: Json | null
          started_at?: string | null
          status?: string
          subject_override?: string | null
          template_id?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          campaign_number?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          segment_filters?: Json | null
          started_at?: string | null
          status?: string
          subject_override?: string | null
          template_id?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_change_requests: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          current_email: string
          expires_at: string
          id: string
          new_email: string
          new_email_verified: boolean | null
          old_email_verified: boolean | null
          status: string
          verification_token: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          current_email: string
          expires_at?: string
          id?: string
          new_email: string
          new_email_verified?: boolean | null
          old_email_verified?: boolean | null
          status?: string
          verification_token: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          current_email?: string
          expires_at?: string
          id?: string
          new_email?: string
          new_email_verified?: boolean | null
          old_email_verified?: boolean | null
          status?: string
          verification_token?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message_id: string
          raw: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message_id: string
          raw?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message_id?: string
          raw?: Json | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          bounced_at: string | null
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_key: string
          from_email: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          max_attempts: number
          max_retries: number | null
          message_type: string | null
          next_retry_at: string | null
          opened_at: string | null
          preview_text: string | null
          provider_message_id: string | null
          provider_response: Json | null
          provider_status: string | null
          resend_response: Json | null
          retry_count: number | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string | null
          template_key: string
          template_vars: Json | null
          to_email: string
        }
        Insert: {
          attempts?: number
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_key: string
          from_email?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          max_retries?: number | null
          message_type?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          preview_text?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          resend_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          template_key: string
          template_vars?: Json | null
          to_email: string
        }
        Update: {
          attempts?: number
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_key?: string
          from_email?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          max_retries?: number | null
          message_type?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          preview_text?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          resend_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          template_key?: string
          template_vars?: Json | null
          to_email?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          automation_rule_id: string | null
          bounced_at: string | null
          campaign_id: string | null
          click_count: number | null
          click_urls: Json | null
          clicked_at: string | null
          client_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          open_count: number | null
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          automation_rule_id?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          click_urls?: Json | null
          clicked_at?: string | null
          client_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          automation_rule_id?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          click_urls?: Json | null
          clicked_at?: string | null
          client_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          preview_text: string | null
          slug: string
          subject: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          name: string
          preview_text?: string | null
          slug: string
          subject: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          preview_text?: string | null
          slug?: string
          subject?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      email_trigger_queue: {
        Row: {
          client_email: string
          client_id: string
          client_name: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          processed_at: string | null
          status: string | null
          trigger_type: string
        }
        Insert: {
          client_email: string
          client_id: string
          client_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string | null
          trigger_type: string
        }
        Update: {
          client_email?: string
          client_id?: string
          client_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string | null
          trigger_type?: string
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          client_id: string
          email: string
          id: string
          is_active: boolean | null
          reason: string | null
          resubscribed_at: string | null
          source: string | null
          unsubscribed_at: string
        }
        Insert: {
          client_id: string
          email: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          resubscribed_at?: string | null
          source?: string | null
          unsubscribed_at?: string
        }
        Update: {
          client_id?: string
          email?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          resubscribed_at?: string | null
          source?: string | null
          unsubscribed_at?: string
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
      employee_operations_audit: {
        Row: {
          account_id: string | null
          action: string
          client_id: string | null
          created_at: string | null
          details: Json | null
          employee_email: string | null
          employee_id: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          reason: string | null
          result: string
          user_agent: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          client_id?: string | null
          created_at?: string | null
          details?: Json | null
          employee_email?: string | null
          employee_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          result: string
          user_agent?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          client_id?: string | null
          created_at?: string | null
          details?: Json | null
          employee_email?: string | null
          employee_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          result?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      employee_pin_attempts: {
        Row: {
          account_id: string
          attempt_result: string
          attempted_at: string
          client_id: string
          client_name: string | null
          employee_email: string | null
          employee_id: string
          failed_count_at_attempt: number | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          account_id: string
          attempt_result: string
          attempted_at?: string
          client_id: string
          client_name?: string | null
          employee_email?: string | null
          employee_id: string
          failed_count_at_attempt?: number | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          attempt_result?: string
          attempted_at?: string
          client_id?: string
          client_name?: string | null
          employee_email?: string | null
          employee_id?: string
          failed_count_at_attempt?: number | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      employee_pin_lockouts: {
        Row: {
          account_id: string
          created_at: string
          employee_id: string
          failed_attempts: number
          id: string
          last_attempt_at: string | null
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          employee_id: string
          failed_attempts?: number
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          employee_id?: string
          failed_attempts?: number
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pin_lockouts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pin_unlocks: {
        Row: {
          account_id: string
          client_id: string
          client_name: string | null
          created_by_server: boolean | null
          employee_email: string | null
          employee_id: string
          expires_at: string
          id: string
          is_active: boolean | null
          unlock_reason: string
          unlocked_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          client_name?: string | null
          created_by_server?: boolean | null
          employee_email?: string | null
          employee_id: string
          expires_at: string
          id?: string
          is_active?: boolean | null
          unlock_reason: string
          unlocked_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          client_name?: string | null
          created_by_server?: boolean | null
          employee_email?: string | null
          employee_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean | null
          unlock_reason?: string
          unlocked_at?: string
        }
        Relationships: []
      }
      employee_recorded_payments: {
        Row: {
          account_id: string | null
          amount: number
          billing_id: string
          client_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_method: string
          payment_reference: string | null
          recorded_by_employee_email: string | null
          recorded_by_employee_id: string
          status: string
          verified_at: string | null
          verified_by_admin_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          billing_id: string
          client_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method: string
          payment_reference?: string | null
          recorded_by_employee_email?: string | null
          recorded_by_employee_id: string
          status?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          billing_id?: string
          client_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          recorded_by_employee_email?: string | null
          recorded_by_employee_id?: string
          status?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_recorded_payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_recorded_payments_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_search_rate_limits: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          search_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          search_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          search_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_search_rate_limits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          badge_number: string | null
          created_at: string
          created_by_admin_id: string | null
          email: string
          failed_login_attempts: number | null
          full_name: string
          id: string
          internal_note: string | null
          is_active: boolean
          job_title: string | null
          lockout_until: string | null
          password_hash: string | null
          permissions_json: Json
          phone: string | null
          pin_hash: string
          pin_salt: string | null
          pin_set_at: string | null
          require_password_change: boolean | null
          require_pin_change: boolean | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          badge_number?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          email: string
          failed_login_attempts?: number | null
          full_name: string
          id?: string
          internal_note?: string | null
          is_active?: boolean
          job_title?: string | null
          lockout_until?: string | null
          password_hash?: string | null
          permissions_json?: Json
          phone?: string | null
          pin_hash: string
          pin_salt?: string | null
          pin_set_at?: string | null
          require_password_change?: boolean | null
          require_pin_change?: boolean | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          badge_number?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          email?: string
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          internal_note?: string | null
          is_active?: boolean
          job_title?: string | null
          lockout_until?: string | null
          password_hash?: string | null
          permissions_json?: Json
          phone?: string | null
          pin_hash?: string
          pin_salt?: string | null
          pin_set_at?: string | null
          require_password_change?: boolean | null
          require_pin_change?: boolean | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      equipment_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          equipment_id: string
          id: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          equipment_id: string
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          equipment_id?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_audit_log_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_inventory: {
        Row: {
          account_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          catalog_item_id: string | null
          catalog_name: string
          category: string
          condition: string | null
          cost_internal: number | null
          created_at: string
          id: string
          imei: string | null
          mac_address: string | null
          notes: string | null
          order_id: string | null
          price_client: number | null
          serial_number: string | null
          sku: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          catalog_item_id?: string | null
          catalog_name: string
          category?: string
          condition?: string | null
          cost_internal?: number | null
          created_at?: string
          id?: string
          imei?: string | null
          mac_address?: string | null
          notes?: string | null
          order_id?: string | null
          price_client?: number | null
          serial_number?: string | null
          sku?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          catalog_item_id?: string | null
          catalog_name?: string
          category?: string
          condition?: string | null
          cost_internal?: number | null
          created_at?: string
          id?: string
          imei?: string | null
          mac_address?: string | null
          notes?: string | null
          order_id?: string | null
          price_client?: number | null
          serial_number?: string | null
          sku?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_inventory_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_inventory_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_inventory_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "services_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_inventory_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "equipment_inventory_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      field_sales_cashout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string | null
          destination: string
          id: string
          method: string
          paid_at: string | null
          request_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salesperson_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string | null
          destination: string
          id?: string
          method: string
          paid_at?: string | null
          request_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salesperson_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string | null
          destination?: string
          id?: string
          method?: string
          paid_at?: string | null
          request_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salesperson_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      field_sales_commission_rules: {
        Row: {
          bonus_amount: number | null
          bonus_percentage: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_sales: number | null
          min_sales: number | null
          rule_name: string
          rule_type: string
          service_type: string | null
          updated_at: string | null
        }
        Insert: {
          bonus_amount?: number | null
          bonus_percentage?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_sales?: number | null
          min_sales?: number | null
          rule_name: string
          rule_type: string
          service_type?: string | null
          updated_at?: string | null
        }
        Update: {
          bonus_amount?: number | null
          bonus_percentage?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_sales?: number | null
          min_sales?: number | null
          rule_name?: string
          rule_type?: string
          service_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      field_sales_orders: {
        Row: {
          additional_photos: Json | null
          appointment_date: string | null
          appointment_notes: string | null
          converted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_address: string
          customer_city: string | null
          customer_date_of_birth: string | null
          customer_email: string | null
          customer_id_photo_url: string | null
          customer_name: string
          customer_phone: string
          customer_postal_code: string | null
          gps_accuracy: number | null
          gps_captured_at: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          internal_notes: string | null
          local_id: string | null
          location_photo_url: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          sale_latitude: number | null
          sale_longitude: number | null
          salesperson_id: string
          selected_channels: Json | null
          services: Json
          signature_captured_at: string | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          additional_photos?: Json | null
          appointment_date?: string | null
          appointment_notes?: string | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_address: string
          customer_city?: string | null
          customer_date_of_birth?: string | null
          customer_email?: string | null
          customer_id_photo_url?: string | null
          customer_name: string
          customer_phone: string
          customer_postal_code?: string | null
          gps_accuracy?: number | null
          gps_captured_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          internal_notes?: string | null
          local_id?: string | null
          location_photo_url?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          sale_latitude?: number | null
          sale_longitude?: number | null
          salesperson_id: string
          selected_channels?: Json | null
          services?: Json
          signature_captured_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          additional_photos?: Json | null
          appointment_date?: string | null
          appointment_notes?: string | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_address?: string
          customer_city?: string | null
          customer_date_of_birth?: string | null
          customer_email?: string | null
          customer_id_photo_url?: string | null
          customer_name?: string
          customer_phone?: string
          customer_postal_code?: string | null
          gps_accuracy?: number | null
          gps_captured_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          internal_notes?: string | null
          local_id?: string | null
          location_photo_url?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          sale_latitude?: number | null
          sale_longitude?: number | null
          salesperson_id?: string
          selected_channels?: Json | null
          services?: Json
          signature_captured_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_sales_orders_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "field_sales_orders_converted_order_id_fkey"
            columns: ["converted_order_id"]
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      identity_documents: {
        Row: {
          checksum: string | null
          created_at: string
          doc_type: string
          file_size_bytes: number | null
          id: string
          kyc_session_id: string
          mime_type: string | null
          object_path: string
          storage_bucket: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          doc_type: string
          file_size_bytes?: number | null
          id?: string
          kyc_session_id: string
          mime_type?: string | null
          object_path: string
          storage_bucket?: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          doc_type?: string
          file_size_bytes?: number | null
          id?: string
          kyc_session_id?: string
          mime_type?: string | null
          object_path?: string
          storage_bucket?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_documents_kyc_session_id_fkey"
            columns: ["kyc_session_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          idempotency_key: string | null
          ip_address: string | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_sessions: {
        Row: {
          additional_docs: Json | null
          case_number: string | null
          checkout_fields: Json | null
          checkout_type: string | null
          client_ip: string | null
          client_user_agent: string | null
          created_at: string
          document_back_path: string | null
          document_front_path: string | null
          document_type: Database["public"]["Enums"]["id_document_type"] | null
          documents_deleted_at: string | null
          documents_deleted_by: string | null
          expires_at: string
          extracted_fields: Json | null
          id: string
          id_province: string | null
          id_type: string | null
          idempotency_key: string | null
          match_result: Json | null
          max_attempts: number
          order_context: Json | null
          order_id: string | null
          order_number: string | null
          public_token: string | null
          public_token_hash: string | null
          qr_regeneration_count: number
          reference_code: string | null
          required_docs: Json | null
          result_payload: Json | null
          retention_delete_after: string | null
          retention_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: string
          submission_attempts: number
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_docs?: Json | null
          case_number?: string | null
          checkout_fields?: Json | null
          checkout_type?: string | null
          client_ip?: string | null
          client_user_agent?: string | null
          created_at?: string
          document_back_path?: string | null
          document_front_path?: string | null
          document_type?: Database["public"]["Enums"]["id_document_type"] | null
          documents_deleted_at?: string | null
          documents_deleted_by?: string | null
          expires_at: string
          extracted_fields?: Json | null
          id?: string
          id_province?: string | null
          id_type?: string | null
          idempotency_key?: string | null
          match_result?: Json | null
          max_attempts?: number
          order_context?: Json | null
          order_id?: string | null
          order_number?: string | null
          public_token?: string | null
          public_token_hash?: string | null
          qr_regeneration_count?: number
          reference_code?: string | null
          required_docs?: Json | null
          result_payload?: Json | null
          retention_delete_after?: string | null
          retention_status?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: string
          submission_attempts?: number
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_docs?: Json | null
          case_number?: string | null
          checkout_fields?: Json | null
          checkout_type?: string | null
          client_ip?: string | null
          client_user_agent?: string | null
          created_at?: string
          document_back_path?: string | null
          document_front_path?: string | null
          document_type?: Database["public"]["Enums"]["id_document_type"] | null
          documents_deleted_at?: string | null
          documents_deleted_by?: string | null
          expires_at?: string
          extracted_fields?: Json | null
          id?: string
          id_province?: string | null
          id_type?: string | null
          idempotency_key?: string | null
          match_result?: Json | null
          max_attempts?: number
          order_context?: Json | null
          order_id?: string | null
          order_number?: string | null
          public_token?: string | null
          public_token_hash?: string | null
          qr_regeneration_count?: number
          reference_code?: string | null
          required_docs?: Json | null
          result_payload?: Json | null
          retention_delete_after?: string | null
          retention_status?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: string
          submission_attempts?: number
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "identity_verification_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          influencer_id: string | null
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          influencer_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          influencer_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_audit_log_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          influencer_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          influencer_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          influencer_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_invites_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_payouts: {
        Row: {
          amount: number
          cashout_request_id: string | null
          created_at: string
          id: string
          influencer_id: string
          method: string
          notes: string | null
          paid_at: string
          paid_by: string | null
          reference_id: string | null
        }
        Insert: {
          amount: number
          cashout_request_id?: string | null
          created_at?: string
          id?: string
          influencer_id: string
          method: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          reference_id?: string | null
        }
        Update: {
          amount?: number
          cashout_request_id?: string | null
          created_at?: string
          id?: string
          influencer_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_payouts_cashout_request_id_fkey"
            columns: ["cashout_request_id"]
            isOneToOne: false
            referencedRelation: "cashout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_payouts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          accepted_partner_terms_at: string | null
          commission_plan_id: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          notes: string | null
          partner_terms_version: string | null
          payout_email: string | null
          payout_method: string | null
          phone: string | null
          status: Database["public"]["Enums"]["influencer_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_partner_terms_at?: string | null
          commission_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          partner_terms_version?: string | null
          payout_email?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["influencer_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_partner_terms_at?: string | null
          commission_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          partner_terms_version?: string | null
          payout_email?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["influencer_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencers_commission_plan_id_fkey"
            columns: ["commission_plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          appointment_date: string | null
          cable_status: string | null
          client_id: string
          created_at: string
          distance_km: number | null
          fallback_ticket_id: string | null
          has_coaxial: string | null
          id: string
          installation_type: string
          needs_fallback_ticket: boolean | null
          notes: string | null
          order_id: string | null
          previous_service: string | null
          readiness_score: number | null
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          status: Database["public"]["Enums"]["installation_status"] | null
          technician_level:
            | Database["public"]["Enums"]["technician_level"]
            | null
          time_slot: string | null
          updated_at: string
          zone: Database["public"]["Enums"]["installation_zone"] | null
        }
        Insert: {
          appointment_date?: string | null
          cable_status?: string | null
          client_id: string
          created_at?: string
          distance_km?: number | null
          fallback_ticket_id?: string | null
          has_coaxial?: string | null
          id?: string
          installation_type?: string
          needs_fallback_ticket?: boolean | null
          notes?: string | null
          order_id?: string | null
          previous_service?: string | null
          readiness_score?: number | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          status?: Database["public"]["Enums"]["installation_status"] | null
          technician_level?:
            | Database["public"]["Enums"]["technician_level"]
            | null
          time_slot?: string | null
          updated_at?: string
          zone?: Database["public"]["Enums"]["installation_zone"] | null
        }
        Update: {
          appointment_date?: string | null
          cable_status?: string | null
          client_id?: string
          created_at?: string
          distance_km?: number | null
          fallback_ticket_id?: string | null
          has_coaxial?: string | null
          id?: string
          installation_type?: string
          needs_fallback_ticket?: boolean | null
          notes?: string | null
          order_id?: string | null
          previous_service?: string | null
          readiness_score?: number | null
          service_address?: string | null
          service_city?: string | null
          service_postal_code?: string | null
          status?: Database["public"]["Enums"]["installation_status"] | null
          technician_level?:
            | Database["public"]["Enums"]["technician_level"]
            | null
          time_slot?: string | null
          updated_at?: string
          zone?: Database["public"]["Enums"]["installation_zone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      inventory_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string
          customer_id: string | null
          id: string
          installed_at: string | null
          notes: string | null
          order_id: string
          order_item_id: string | null
          returned_at: string | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["inventory_assignment_status"]
          stock_item_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          installed_at?: string | null
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          returned_at?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["inventory_assignment_status"]
          stock_item_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          installed_at?: string | null
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          returned_at?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["inventory_assignment_status"]
          stock_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inventory_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignments_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_stock: {
        Row: {
          brand: string | null
          catalog_item_id: string | null
          created_at: string
          iccid: string | null
          id: string
          imei: string | null
          item_type: Database["public"]["Enums"]["inventory_stock_type"]
          mac_address: string | null
          metadata: Json | null
          model: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          sku: string | null
          status: string
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          brand?: string | null
          catalog_item_id?: string | null
          created_at?: string
          iccid?: string | null
          id?: string
          imei?: string | null
          item_type: Database["public"]["Enums"]["inventory_stock_type"]
          mac_address?: string | null
          metadata?: Json | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          brand?: string | null
          catalog_item_id?: string | null
          created_at?: string
          iccid?: string | null
          id?: string
          imei?: string | null
          item_type?: Database["public"]["Enums"]["inventory_stock_type"]
          mac_address?: string | null
          metadata?: Json | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
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
      kyc_requested_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          instructions: string | null
          kyc_session_id: string
          requested_at: string
          requested_by_admin_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          status: string
          updated_at: string
          uploaded_at: string | null
          uploaded_file_url: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          id?: string
          instructions?: string | null
          kyc_session_id: string
          requested_at?: string
          requested_by_admin_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_file_url?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          instructions?: string | null
          kyc_session_id?: string
          requested_at?: string
          requested_by_admin_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_requested_documents_kyc_session_id_fkey"
            columns: ["kyc_session_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string | null
          amount: number
          amount_allocated: number | null
          captured_at: string | null
          client_id: string
          created_at: string
          created_by_id: string | null
          created_by_name: string | null
          created_by_role: string | null
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          metadata: Json | null
          payment_method: string | null
          payment_status: string | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_allocated?: number | null
          captured_at?: string | null
          client_id: string
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          payment_status?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_allocated?: number | null
          captured_at?: string | null
          client_id?: string
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          payment_status?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_invoice_allocations: {
        Row: {
          allocated_at: string
          amount_allocated: number
          created_by_id: string | null
          created_by_name: string | null
          created_by_role: string | null
          id: string
          invoice_entry_id: string
          notes: string | null
          payment_entry_id: string
        }
        Insert: {
          allocated_at?: string
          amount_allocated: number
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          invoice_entry_id: string
          notes?: string | null
          payment_entry_id: string
        }
        Update: {
          allocated_at?: string
          amount_allocated?: number
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          invoice_entry_id?: string
          notes?: string | null
          payment_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_invoice_allocations_invoice_entry_id_fkey"
            columns: ["invoice_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_invoice_allocations_payment_entry_id_fkey"
            columns: ["payment_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      live_activity_logs: {
        Row: {
          activity_label: string | null
          activity_type: string
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          postal_code: string | null
          province: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_label?: string | null
          activity_type: string
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          postal_code?: string | null
          province?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_label?: string | null
          activity_type?: string
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          postal_code?: string | null
          province?: string | null
          session_id?: string | null
          user_id?: string | null
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
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
      mobile_fulfillment: {
        Row: {
          activated_at: string | null
          activation_status: string | null
          assigned_number: string | null
          created_at: string
          id: string
          number_assigned_at: string | null
          number_assigned_by: string | null
          order_id: string
          port_in_account_number: string | null
          port_in_carrier: string | null
          port_in_completed_at: string | null
          port_in_number: string | null
          port_in_requested: boolean | null
          port_in_status: string | null
          port_in_submitted_at: string | null
          sim_carrier: string | null
          sim_iccid: string | null
          sim_shipped_at: string | null
          sim_tracking_number: string | null
          sim_tracking_url: string | null
          sim_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activation_status?: string | null
          assigned_number?: string | null
          created_at?: string
          id?: string
          number_assigned_at?: string | null
          number_assigned_by?: string | null
          order_id: string
          port_in_account_number?: string | null
          port_in_carrier?: string | null
          port_in_completed_at?: string | null
          port_in_number?: string | null
          port_in_requested?: boolean | null
          port_in_status?: string | null
          port_in_submitted_at?: string | null
          sim_carrier?: string | null
          sim_iccid?: string | null
          sim_shipped_at?: string | null
          sim_tracking_number?: string | null
          sim_tracking_url?: string | null
          sim_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activation_status?: string | null
          assigned_number?: string | null
          created_at?: string
          id?: string
          number_assigned_at?: string | null
          number_assigned_by?: string | null
          order_id?: string
          port_in_account_number?: string | null
          port_in_carrier?: string | null
          port_in_completed_at?: string | null
          port_in_number?: string | null
          port_in_requested?: boolean | null
          port_in_status?: string | null
          port_in_submitted_at?: string | null
          sim_carrier?: string | null
          sim_iccid?: string | null
          sim_shipped_at?: string | null
          sim_tracking_number?: string | null
          sim_tracking_url?: string | null
          sim_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_fulfillment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "mobile_fulfillment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      notification_outbox: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string
          id: string
          payload_json: Json
          recipient: string
          retry_count: number
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          to_name: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload_json?: Json
          recipient?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload_json?: Json
          recipient?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
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
      operational_fees: {
        Row: {
          amount: number
          applies_when: Json | null
          category: string
          created_at: string | null
          display_order: number | null
          fee_key: string
          fee_type: string
          id: string
          is_active: boolean
          label_en: string | null
          label_fr: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          applies_when?: Json | null
          category?: string
          created_at?: string | null
          display_order?: number | null
          fee_key: string
          fee_type?: string
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_fr: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          applies_when?: Json | null
          category?: string
          created_at?: string | null
          display_order?: number | null
          fee_key?: string
          fee_type?: string
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_fr?: string
          notes?: string | null
          updated_at?: string | null
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      order_identity_data: {
        Row: {
          created_at: string
          id: string
          id_expiry: string | null
          id_number_encrypted: string | null
          id_type: string | null
          order_id: string
          updated_at: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          id_expiry?: string | null
          id_number_encrypted?: string | null
          id_type?: string | null
          order_id: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          id_expiry?: string | null
          id_number_encrypted?: string | null
          id_type?: string | null
          order_id?: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_identity_data_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_identity_data_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_internal_notes: {
        Row: {
          body: string
          created_at: string
          created_by_name: string | null
          created_by_role: string
          created_by_user_id: string
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string
          created_by_user_id: string
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string
          created_by_user_id?: string
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_internal_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_internal_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          appointment_id: string | null
          created_at: string
          depends_on_item_id: string | null
          description: string | null
          fulfillment_type:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id: string
          is_recurring: boolean
          item_number: number
          line_total: number
          metadata: Json | null
          order_id: string
          plan_code: string | null
          plan_name: string
          provisioning_job_id: string | null
          quantity: number
          service_instance_id: string | null
          service_type: Database["public"]["Enums"]["order_item_service_type"]
          shipment_id: string | null
          status: Database["public"]["Enums"]["order_item_status"]
          status_reason: string | null
          status_updated_at: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          depends_on_item_id?: string | null
          description?: string | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id?: string
          is_recurring?: boolean
          item_number?: number
          line_total?: number
          metadata?: Json | null
          order_id: string
          plan_code?: string | null
          plan_name: string
          provisioning_job_id?: string | null
          quantity?: number
          service_instance_id?: string | null
          service_type: Database["public"]["Enums"]["order_item_service_type"]
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          status_reason?: string | null
          status_updated_at?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          depends_on_item_id?: string | null
          description?: string | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id?: string
          is_recurring?: boolean
          item_number?: number
          line_total?: number
          metadata?: Json | null
          order_id?: string
          plan_code?: string | null
          plan_name?: string
          provisioning_job_id?: string | null
          quantity?: number
          service_instance_id?: string | null
          service_type?: Database["public"]["Enums"]["order_item_service_type"]
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          status_reason?: string | null
          status_updated_at?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_depends_on_item_id_fkey"
            columns: ["depends_on_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_provisioning_job_id_fkey"
            columns: ["provisioning_job_id"]
            isOneToOne: false
            referencedRelation: "provisioning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_snapshots: {
        Row: {
          accepted_at: string
          accepted_ip: string | null
          accepted_method: string | null
          account_id: string | null
          activation_date: string | null
          bill_cycle_day: number | null
          billing_snapshot: Json
          client_snapshot: Json
          contract_summary_snapshot: Json | null
          created_at: string
          equipment_snapshot: Json
          fees_snapshot: Json
          id: string
          order_id: string
          payment_method_snapshot: Json | null
          selected_channels_snapshot: Json | null
          services_snapshot: Json
          version: number
        }
        Insert: {
          accepted_at?: string
          accepted_ip?: string | null
          accepted_method?: string | null
          account_id?: string | null
          activation_date?: string | null
          bill_cycle_day?: number | null
          billing_snapshot?: Json
          client_snapshot?: Json
          contract_summary_snapshot?: Json | null
          created_at?: string
          equipment_snapshot?: Json
          fees_snapshot?: Json
          id?: string
          order_id: string
          payment_method_snapshot?: Json | null
          selected_channels_snapshot?: Json | null
          services_snapshot?: Json
          version?: number
        }
        Update: {
          accepted_at?: string
          accepted_ip?: string | null
          accepted_method?: string | null
          account_id?: string | null
          activation_date?: string | null
          bill_cycle_day?: number | null
          billing_snapshot?: Json
          client_snapshot?: Json
          contract_summary_snapshot?: Json | null
          created_at?: string
          equipment_snapshot?: Json
          fees_snapshot?: Json
          id?: string
          order_id?: string
          payment_method_snapshot?: Json | null
          selected_channels_snapshot?: Json | null
          services_snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
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
          account_id: string
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
          client_dob: string | null
          client_email: string | null
          client_first_name: string | null
          client_full_address: string | null
          client_last_name: string | null
          client_phone: string | null
          client_request_id: string
          confirmation_email_sent_at: string | null
          confirmation_number: string | null
          created_at: string
          created_by: string | null
          credits_applied: number | null
          delivery_fee: number | null
          delivery_method: string | null
          discount_amount: number | null
          discount_code: string | null
          environment: string
          equipment_details: Json | null
          equipment_id: string | null
          equipment_line_details: Json | null
          etransfer_status: string | null
          failure_reason: string | null
          fulfillment_assigned_at: string | null
          fulfillment_notes: string | null
          fulfillment_type: string | null
          id: string
          id_verification_notes: string | null
          id_verification_status: string | null
          id_verified_at: string | null
          id_verified_by: string | null
          identity_snapshot: Json | null
          identity_verification_session_id: string | null
          imei_number: string | null
          installation_credit: number | null
          installation_fee: number | null
          installation_type: string | null
          internal_notes: string | null
          kyc_policy: string
          late_fee_amount: number | null
          late_fee_applied: boolean | null
          notes: string | null
          order_number: string | null
          order_type: string | null
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          port_request: Json | null
          preauth_card_id: string | null
          preauth_discount: number | null
          pricing_snapshot: Json | null
          processed_at: string | null
          processed_by: string | null
          promo_code: string | null
          promo_details: Json | null
          promo_discount_amount: number | null
          provider_payment_id: string | null
          related_contract_id: string | null
          related_ticket_id: string | null
          require_fresh_kyc: boolean
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
          sim_type: string | null
          snapshot_total: number | null
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
          account_id: string
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
          client_dob?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_full_address?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_request_id?: string
          confirmation_email_sent_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          delivery_method?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          environment?: string
          equipment_details?: Json | null
          equipment_id?: string | null
          equipment_line_details?: Json | null
          etransfer_status?: string | null
          failure_reason?: string | null
          fulfillment_assigned_at?: string | null
          fulfillment_notes?: string | null
          fulfillment_type?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          identity_snapshot?: Json | null
          identity_verification_session_id?: string | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          kyc_policy?: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          order_type?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          port_request?: Json | null
          preauth_card_id?: string | null
          preauth_discount?: number | null
          pricing_snapshot?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          promo_code?: string | null
          promo_details?: Json | null
          promo_discount_amount?: number | null
          provider_payment_id?: string | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          require_fresh_kyc?: boolean
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
          sim_type?: string | null
          snapshot_total?: number | null
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
          account_id?: string
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
          client_dob?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_full_address?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_request_id?: string
          confirmation_email_sent_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          credits_applied?: number | null
          delivery_fee?: number | null
          delivery_method?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          environment?: string
          equipment_details?: Json | null
          equipment_id?: string | null
          equipment_line_details?: Json | null
          etransfer_status?: string | null
          failure_reason?: string | null
          fulfillment_assigned_at?: string | null
          fulfillment_notes?: string | null
          fulfillment_type?: string | null
          id?: string
          id_verification_notes?: string | null
          id_verification_status?: string | null
          id_verified_at?: string | null
          id_verified_by?: string | null
          identity_snapshot?: Json | null
          identity_verification_session_id?: string | null
          imei_number?: string | null
          installation_credit?: number | null
          installation_fee?: number | null
          installation_type?: string | null
          internal_notes?: string | null
          kyc_policy?: string
          late_fee_amount?: number | null
          late_fee_applied?: boolean | null
          notes?: string | null
          order_number?: string | null
          order_type?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          port_request?: Json | null
          preauth_card_id?: string | null
          preauth_discount?: number | null
          pricing_snapshot?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          promo_code?: string | null
          promo_details?: Json | null
          promo_discount_amount?: number | null
          provider_payment_id?: string | null
          related_contract_id?: string | null
          related_ticket_id?: string | null
          require_fresh_kyc?: boolean
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
          sim_type?: string | null
          snapshot_total?: number | null
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
            foreignKeyName: "orders_identity_verification_session_id_fkey"
            columns: ["identity_verification_session_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_sessions"
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
      partner_program_terms: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      payment_disputes: {
        Row: {
          client_message: string | null
          created_at: string
          dispute_number: string | null
          id: string
          payment_id: string
          processed_at: string | null
          processed_by_id: string | null
          processed_by_name: string | null
          public_message: string | null
          reason_code: Database["public"]["Enums"]["dispute_reason_code"]
          rejection_reason: string | null
          resolution_notes: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_message?: string | null
          created_at?: string
          dispute_number?: string | null
          id?: string
          payment_id: string
          processed_at?: string | null
          processed_by_id?: string | null
          processed_by_name?: string | null
          public_message?: string | null
          reason_code: Database["public"]["Enums"]["dispute_reason_code"]
          rejection_reason?: string | null
          resolution_notes?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_message?: string | null
          created_at?: string
          dispute_number?: string | null
          id?: string
          payment_id?: string
          processed_at?: string | null
          processed_by_id?: string | null
          processed_by_name?: string | null
          public_message?: string | null
          reason_code?: Database["public"]["Enums"]["dispute_reason_code"]
          rejection_reason?: string | null
          resolution_notes?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_settings: {
        Row: {
          created_at: string
          enabled_currencies: Json
          id: string
          is_enabled: boolean
          min_confirmations: number
          mode: string
          payout_wallet_btc: string | null
          payout_wallet_eth: string | null
          payout_wallet_sol: string | null
          payout_wallet_xrp: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_currencies?: Json
          id?: string
          is_enabled?: boolean
          min_confirmations?: number
          mode?: string
          payout_wallet_btc?: string | null
          payout_wallet_eth?: string | null
          payout_wallet_sol?: string | null
          payout_wallet_xrp?: string | null
          provider?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_currencies?: Json
          id?: string
          is_enabled?: boolean
          min_confirmations?: number
          mode?: string
          payout_wallet_btc?: string | null
          payout_wallet_eth?: string | null
          payout_wallet_sol?: string | null
          payout_wallet_xrp?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          card_type: string
          cardholder_name: string | null
          created_at: string
          deleted_at: string | null
          encrypted_card_number: string | null
          expiry_month: number
          expiry_year: number
          id: string
          is_default: boolean
          is_preauthorized: boolean | null
          last_four: string
          payment_fingerprint: string | null
          preauthorized_at: string | null
          user_id: string
        }
        Insert: {
          card_type: string
          cardholder_name?: string | null
          created_at?: string
          deleted_at?: string | null
          encrypted_card_number?: string | null
          expiry_month: number
          expiry_year: number
          id?: string
          is_default?: boolean
          is_preauthorized?: boolean | null
          last_four: string
          payment_fingerprint?: string | null
          preauthorized_at?: string | null
          user_id: string
        }
        Update: {
          card_type?: string
          cardholder_name?: string | null
          created_at?: string
          deleted_at?: string | null
          encrypted_card_number?: string | null
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_default?: boolean
          is_preauthorized?: boolean | null
          last_four?: string
          payment_fingerprint?: string | null
          preauthorized_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          auto_matched: boolean | null
          client_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          match_confidence: number | null
          notes: string | null
          payment_id: string
          proof_type: string
          sender_bank: string | null
          sender_name: string | null
          transfer_amount: number | null
          transfer_date: string | null
          transfer_reference: string | null
          updated_at: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by_id: string | null
          verified_by_name: string | null
        }
        Insert: {
          auto_matched?: boolean | null
          client_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          match_confidence?: number | null
          notes?: string | null
          payment_id: string
          proof_type?: string
          sender_bank?: string | null
          sender_name?: string | null
          transfer_amount?: number | null
          transfer_date?: string | null
          transfer_reference?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by_id?: string | null
          verified_by_name?: string | null
        }
        Update: {
          auto_matched?: boolean | null
          client_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          match_confidence?: number | null
          notes?: string | null
          payment_id?: string
          proof_type?: string
          sender_bank?: string | null
          sender_name?: string | null
          transfer_amount?: number | null
          transfer_date?: string | null
          transfer_reference?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by_id?: string | null
          verified_by_name?: string | null
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          account_id: string | null
          amount: number
          client_reference: string | null
          created_at: string
          crypto_currency: string | null
          crypto_txid: string | null
          crypto_wallet_address: string | null
          currency: string
          id: string
          invoice_id: string | null
          method: string
          payment_instructions: string | null
          reference_code: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          client_reference?: string | null
          created_at?: string
          crypto_currency?: string | null
          crypto_txid?: string | null
          crypto_wallet_address?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          method: string
          payment_instructions?: string | null
          reference_code: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          client_reference?: string | null
          created_at?: string
          crypto_currency?: string | null
          crypto_txid?: string | null
          crypto_wallet_address?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          method?: string
          payment_instructions?: string | null
          reference_code?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          billing_id: string | null
          captured_at: string | null
          card_last_four: string | null
          card_type: string | null
          client_id: string | null
          created_at: string
          created_by_id: string | null
          created_by_name: string | null
          created_by_role: string | null
          error_reason: string | null
          etransfer_amount: number | null
          etransfer_sender_name: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          payment_method: string
          payment_reference: string | null
          provider_payment_id: string | null
          received_by: string | null
          reference_number: string
          source: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          billing_id?: string | null
          captured_at?: string | null
          card_last_four?: string | null
          card_type?: string | null
          client_id?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          error_reason?: string | null
          etransfer_amount?: number | null
          etransfer_sender_name?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method: string
          payment_reference?: string | null
          provider_payment_id?: string | null
          received_by?: string | null
          reference_number: string
          source?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          billing_id?: string | null
          captured_at?: string | null
          card_last_four?: string | null
          card_type?: string | null
          client_id?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          error_reason?: string | null
          etransfer_amount?: number | null
          etransfer_sender_name?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          payment_reference?: string | null
          provider_payment_id?: string | null
          received_by?: string | null
          reference_number?: string
          source?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_generation_logs: {
        Row: {
          customer_email: string | null
          doc_type: string
          engine_version: string
          entity_id: string | null
          error_message: string | null
          generated_at: string
          generated_by: string | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          order_id: string | null
          order_number: string | null
          payment_provider: string | null
          provider_payment_id: string | null
          success: boolean
          template_path: string
          template_version: string
          user_id: string | null
        }
        Insert: {
          customer_email?: string | null
          doc_type: string
          engine_version?: string
          entity_id?: string | null
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          success?: boolean
          template_path: string
          template_version: string
          user_id?: string | null
        }
        Update: {
          customer_email?: string | null
          doc_type?: string
          engine_version?: string
          entity_id?: string | null
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          success?: boolean
          template_path?: string
          template_version?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pdf_template_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          template_key: string
          template_path: string
          template_type: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          template_key: string
          template_path: string
          template_type: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          template_key?: string
          template_path?: string
          template_type?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      pin_invite_tokens: {
        Row: {
          created_at: string
          created_by_admin_id: string
          email: string
          expires_at: string
          id: string
          role: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_admin_id: string
          email: string
          expires_at?: string
          id?: string
          role: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_change_requests: {
        Row: {
          admin_notes: string | null
          applied_at: string | null
          created_at: string
          id: string
          reason: string | null
          requested_changes: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supporting_document_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          applied_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requested_changes: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_document_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          applied_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requested_changes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_document_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_number: string | null
          account_status: string | null
          avatar_url: string | null
          balance: number | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_by_role: string | null
          blocked_reason: string | null
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
          identity_verified: boolean
          identity_verified_at: string | null
          internal_notes: string | null
          last_auth_check_at: string | null
          last_login_at: string | null
          last_name: string | null
          mfa_enabled: boolean | null
          mfa_secret: string | null
          mfa_verified_at: string | null
          notification_channel: string | null
          online_access_status: string | null
          pending_email: string | null
          pending_email_expires_at: string | null
          pending_email_token: string | null
          phone: string | null
          pin_failed_attempts: number | null
          pin_is_default: boolean | null
          pin_lockout_until: string | null
          preferred_language: string | null
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
          account_number?: string | null
          account_status?: string | null
          avatar_url?: string | null
          balance?: number | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_by_role?: string | null
          blocked_reason?: string | null
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
          identity_verified?: boolean
          identity_verified_at?: string | null
          internal_notes?: string | null
          last_auth_check_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          mfa_enabled?: boolean | null
          mfa_secret?: string | null
          mfa_verified_at?: string | null
          notification_channel?: string | null
          online_access_status?: string | null
          pending_email?: string | null
          pending_email_expires_at?: string | null
          pending_email_token?: string | null
          phone?: string | null
          pin_failed_attempts?: number | null
          pin_is_default?: boolean | null
          pin_lockout_until?: string | null
          preferred_language?: string | null
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
          account_number?: string | null
          account_status?: string | null
          avatar_url?: string | null
          balance?: number | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_by_role?: string | null
          blocked_reason?: string | null
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
          identity_verified?: boolean
          identity_verified_at?: string | null
          internal_notes?: string | null
          last_auth_check_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          mfa_enabled?: boolean | null
          mfa_secret?: string | null
          mfa_verified_at?: string | null
          notification_channel?: string | null
          online_access_status?: string | null
          pending_email?: string | null
          pending_email_expires_at?: string | null
          pending_email_token?: string | null
          phone?: string | null
          pin_failed_attempts?: number | null
          pin_is_default?: boolean | null
          pin_lockout_until?: string | null
          preferred_language?: string | null
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
          duration: string
          end_at: string | null
          id: string
          max_discount_amount: number | null
          min_payable_cents: number | null
          min_subtotal: number | null
          name: string
          new_customers_only: boolean
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
          duration?: string
          end_at?: string | null
          id?: string
          max_discount_amount?: number | null
          min_payable_cents?: number | null
          min_subtotal?: number | null
          name: string
          new_customers_only?: boolean
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
          duration?: string
          end_at?: string | null
          id?: string
          max_discount_amount?: number | null
          min_payable_cents?: number | null
          min_subtotal?: number | null
          name?: string
          new_customers_only?: boolean
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
      provisioning_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          depends_on_job_id: string | null
          error_code: string | null
          error_message: string | null
          execution_log: Json | null
          failed_at: string | null
          id: string
          job_label: string
          job_type: Database["public"]["Enums"]["provisioning_job_type"]
          manual_override_at: string | null
          manual_override_by: string | null
          manual_override_reason: string | null
          max_attempts: number
          next_retry_at: string | null
          order_id: string
          order_item_id: string | null
          priority: number
          result_data: Json | null
          service_instance_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["provisioning_job_status"]
          status_reason: string | null
          triggered_by: string | null
          triggered_by_role: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          depends_on_job_id?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_log?: Json | null
          failed_at?: string | null
          id?: string
          job_label: string
          job_type: Database["public"]["Enums"]["provisioning_job_type"]
          manual_override_at?: string | null
          manual_override_by?: string | null
          manual_override_reason?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id: string
          order_item_id?: string | null
          priority?: number
          result_data?: Json | null
          service_instance_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["provisioning_job_status"]
          status_reason?: string | null
          triggered_by?: string | null
          triggered_by_role?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          depends_on_job_id?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_log?: Json | null
          failed_at?: string | null
          id?: string
          job_label?: string
          job_type?: Database["public"]["Enums"]["provisioning_job_type"]
          manual_override_at?: string | null
          manual_override_by?: string | null
          manual_override_reason?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string
          order_item_id?: string | null
          priority?: number
          result_data?: Json | null
          service_instance_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["provisioning_job_status"]
          status_reason?: string | null
          triggered_by?: string | null
          triggered_by_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_jobs_depends_on_job_id_fkey"
            columns: ["depends_on_job_id"]
            isOneToOne: false
            referencedRelation: "provisioning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "provisioning_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_jobs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_jobs_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          created_at: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      rate_limit_lockouts: {
        Row: {
          created_at: string
          key: string
          locked_until: string
        }
        Insert: {
          created_at?: string
          key: string
          locked_until: string
        }
        Update: {
          created_at?: string
          key?: string
          locked_until?: string
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
      referral_attributions: {
        Row: {
          applied_at: string
          created_at: string
          customer_discount_amount: number
          customer_email: string | null
          customer_id: string
          discount_type: string
          fraud_flag_level: Database["public"]["Enums"]["fraud_flag_level"]
          fraud_notes: string | null
          id: string
          influencer_id: string
          invoice_id: string | null
          order_id: string | null
          referral_code_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          created_at?: string
          customer_discount_amount?: number
          customer_email?: string | null
          customer_id: string
          discount_type?: string
          fraud_flag_level?: Database["public"]["Enums"]["fraud_flag_level"]
          fraud_notes?: string | null
          id?: string
          influencer_id: string
          invoice_id?: string | null
          order_id?: string | null
          referral_code_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          created_at?: string
          customer_discount_amount?: number
          customer_email?: string | null
          customer_id?: string
          discount_type?: string
          fraud_flag_level?: Database["public"]["Enums"]["fraud_flag_level"]
          fraud_notes?: string | null
          id?: string
          influencer_id?: string
          invoice_id?: string | null
          order_id?: string | null
          referral_code_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_attributions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          influencer_id: string
          status: string
          updated_at: string
          usage_count: number
          usage_limit_monthly: number | null
          usage_limit_total: number | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          influencer_id: string
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit_monthly?: number | null
          usage_limit_total?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          influencer_id?: string
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit_monthly?: number | null
          usage_limit_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_program_settings: {
        Row: {
          allow_self_referrals: boolean
          commission_model_default: Database["public"]["Enums"]["commission_model_type"]
          commission_value_default: number
          cooldown_days: number
          created_at: string
          discount_percent_first_invoice_monthly: number
          discount_stacks: boolean
          id: string
          min_cashout_amount: number
          updated_at: string
        }
        Insert: {
          allow_self_referrals?: boolean
          commission_model_default?: Database["public"]["Enums"]["commission_model_type"]
          commission_value_default?: number
          cooldown_days?: number
          created_at?: string
          discount_percent_first_invoice_monthly?: number
          discount_stacks?: boolean
          id?: string
          min_cashout_amount?: number
          updated_at?: string
        }
        Update: {
          allow_self_referrals?: boolean
          commission_model_default?: Database["public"]["Enums"]["commission_model_type"]
          commission_value_default?: number
          cooldown_days?: number
          created_at?: string
          discount_percent_first_invoice_monthly?: number
          discount_stacks?: boolean
          id?: string
          min_cashout_amount?: number
          updated_at?: string
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
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
      sales_commissions: {
        Row: {
          bonus_amount: number | null
          bonus_type: string | null
          commission_amount: number
          commission_rate: number
          converted_order_id: string | null
          created_at: string
          field_order_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          rejection_reason: string | null
          sale_amount: number
          salesperson_id: string
          status: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          bonus_amount?: number | null
          bonus_type?: string | null
          commission_amount: number
          commission_rate?: number
          converted_order_id?: string | null
          created_at?: string
          field_order_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          rejection_reason?: string | null
          sale_amount: number
          salesperson_id: string
          status?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          bonus_amount?: number | null
          bonus_type?: string | null
          commission_amount?: number
          commission_rate?: number
          converted_order_id?: string | null
          created_at?: string
          field_order_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          rejection_reason?: string | null
          sale_amount?: number
          salesperson_id?: string
          status?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "sales_commissions_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_field_order_id_fkey"
            columns: ["field_order_id"]
            isOneToOne: false
            referencedRelation: "field_sales_orders"
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
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          severity: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          severity?: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          severity?: string
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          affected_entity_id: string | null
          affected_entity_type: string | null
          auto_mitigated: boolean | null
          created_at: string
          description: string | null
          detection_method: string | null
          id: string
          incident_type: string
          metadata: Json | null
          mitigation_action: string | null
          mitigation_details: Json | null
          resolved_at: string | null
          resolved_by_id: string | null
          resolved_by_name: string | null
          severity: string
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_entity_id?: string | null
          affected_entity_type?: string | null
          auto_mitigated?: boolean | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          id?: string
          incident_type: string
          metadata?: Json | null
          mitigation_action?: string | null
          mitigation_details?: Json | null
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          severity: string
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_entity_id?: string | null
          affected_entity_type?: string | null
          auto_mitigated?: boolean | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          id?: string
          incident_type?: string
          metadata?: Json | null
          mitigation_action?: string | null
          mitigation_details?: Json | null
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          severity?: string
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_addresses: {
        Row: {
          account_id: string
          address_hash: string | null
          address_line: string
          address_normalized: string | null
          city: string | null
          coax_readiness_score: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean
          is_primary: boolean | null
          label: string
          last_install_at: string | null
          last_install_level: string | null
          last_install_outcome: string | null
          last_install_outcome_at: string | null
          postal_code: string | null
          province: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          address_hash?: string | null
          address_line: string
          address_normalized?: string | null
          city?: string | null
          coax_readiness_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean
          is_primary?: boolean | null
          label?: string
          last_install_at?: string | null
          last_install_level?: string | null
          last_install_outcome?: string | null
          last_install_outcome_at?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          address_hash?: string | null
          address_line?: string
          address_normalized?: string | null
          city?: string | null
          coax_readiness_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean
          is_primary?: boolean | null
          label?: string
          last_install_at?: string | null
          last_install_level?: string | null
          last_install_outcome?: string | null
          last_install_outcome_at?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_addresses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_cancellation_requests: {
        Row: {
          account_id: string | null
          created_at: string
          created_by_role: string
          decline_reason: string | null
          effective_date: string | null
          id: string
          processed_at: string | null
          processed_by_id: string | null
          processed_by_name: string | null
          public_message: string | null
          reason_code: Database["public"]["Enums"]["cancellation_reason_code"]
          reason_details: string | null
          request_number: string | null
          requested_effective_date: string | null
          service_identifier: string | null
          service_type: Database["public"]["Enums"]["cancellation_service_type"]
          staff_notes: string | null
          status: Database["public"]["Enums"]["cancellation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by_role?: string
          decline_reason?: string | null
          effective_date?: string | null
          id?: string
          processed_at?: string | null
          processed_by_id?: string | null
          processed_by_name?: string | null
          public_message?: string | null
          reason_code: Database["public"]["Enums"]["cancellation_reason_code"]
          reason_details?: string | null
          request_number?: string | null
          requested_effective_date?: string | null
          service_identifier?: string | null
          service_type: Database["public"]["Enums"]["cancellation_service_type"]
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by_role?: string
          decline_reason?: string | null
          effective_date?: string | null
          id?: string
          processed_at?: string | null
          processed_by_id?: string | null
          processed_by_name?: string | null
          public_message?: string | null
          reason_code?: Database["public"]["Enums"]["cancellation_reason_code"]
          reason_details?: string | null
          request_number?: string | null
          requested_effective_date?: string | null
          service_identifier?: string | null
          service_type?: Database["public"]["Enums"]["cancellation_service_type"]
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_cancellation_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_instances: {
        Row: {
          account_id: string | null
          created_at: string
          end_date: string | null
          equipment_details: Json | null
          id: string
          metadata: Json | null
          monthly_price: number | null
          order_id: string | null
          plan_name: string | null
          service_type: string
          start_date: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          end_date?: string | null
          equipment_details?: Json | null
          id?: string
          metadata?: Json | null
          monthly_price?: number | null
          order_id?: string | null
          plan_name?: string | null
          service_type: string
          start_date?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          end_date?: string | null
          equipment_details?: Json | null
          id?: string
          metadata?: Json | null
          monthly_price?: number | null
          order_id?: string | null
          plan_name?: string | null
          service_type?: string
          start_date?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_instances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "service_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          activation_fee_rule: string | null
          badges: Json | null
          billing_type: string | null
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          equipment_rules: Json | null
          features_json: Json | null
          id: string
          installation_fee_rule: string | null
          is_active: boolean | null
          is_featured: boolean | null
          is_recommended: boolean | null
          name: string
          price: number | null
          promo_eligible: boolean | null
          shipping_fee_rule: string | null
          short_description: string | null
          status: string | null
          tags: Json | null
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
          visible_checkout: boolean | null
          visible_portal: boolean | null
          visible_simulator: boolean | null
          visible_website: boolean | null
        }
        Insert: {
          activation_fee_rule?: string | null
          badges?: Json | null
          billing_type?: string | null
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          equipment_rules?: Json | null
          features_json?: Json | null
          id?: string
          installation_fee_rule?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_recommended?: boolean | null
          name: string
          price?: number | null
          promo_eligible?: boolean | null
          shipping_fee_rule?: string | null
          short_description?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
          visible_checkout?: boolean | null
          visible_portal?: boolean | null
          visible_simulator?: boolean | null
          visible_website?: boolean | null
        }
        Update: {
          activation_fee_rule?: string | null
          badges?: Json | null
          billing_type?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          equipment_rules?: Json | null
          features_json?: Json | null
          id?: string
          installation_fee_rule?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_recommended?: boolean | null
          name?: string
          price?: number | null
          promo_eligible?: boolean | null
          shipping_fee_rule?: string | null
          short_description?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
          visible_checkout?: boolean | null
          visible_portal?: boolean | null
          visible_simulator?: boolean | null
          visible_website?: boolean | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          actual_delivery_date: string | null
          actual_ship_date: string | null
          carrier: string | null
          created_at: string
          customer_id: string | null
          estimated_delivery_date: string | null
          estimated_ship_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string
          order_item_id: string | null
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_name: string | null
          ship_to_phone: string | null
          ship_to_postal_code: string | null
          ship_to_province: string | null
          shipment_number: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          actual_ship_date?: string | null
          carrier?: string | null
          created_at?: string
          customer_id?: string | null
          estimated_delivery_date?: string | null
          estimated_ship_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_province?: string | null
          shipment_number?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          actual_ship_date?: string | null
          carrier?: string | null
          created_at?: string
          customer_id?: string | null
          estimated_delivery_date?: string | null
          estimated_ship_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_province?: string | null
          shipment_number?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      site_offers: {
        Row: {
          category: string
          created_at: string | null
          created_by_id: string | null
          created_by_name: string | null
          description_en: string | null
          description_fr: string | null
          discount_amount: number | null
          discount_percent: number | null
          features_json: Json | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name_en: string | null
          name_fr: string
          offer_type: string
          price_monthly: number | null
          price_setup: number | null
          promo_code: string | null
          sort_order: number | null
          updated_at: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          updated_by_role: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          description_en?: string | null
          description_fr?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          features_json?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name_en?: string | null
          name_fr: string
          offer_type: string
          price_monthly?: number | null
          price_setup?: number | null
          promo_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          description_en?: string | null
          description_fr?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          features_json?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name_en?: string | null
          name_fr?: string
          offer_type?: string
          price_monthly?: number | null
          price_setup?: number | null
          promo_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          body_en: string | null
          body_fr: string | null
          created_at: string | null
          created_by_id: string | null
          created_by_name: string | null
          id: string
          is_published: boolean | null
          meta_description_en: string | null
          meta_description_fr: string | null
          publish_at: string | null
          slug: string
          title_en: string | null
          title_fr: string
          updated_at: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          updated_by_role: string | null
        }
        Insert: {
          body_en?: string | null
          body_fr?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          id?: string
          is_published?: boolean | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          publish_at?: string | null
          slug: string
          title_en?: string | null
          title_fr: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
        }
        Update: {
          body_en?: string | null
          body_fr?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          id?: string
          is_published?: boolean | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          publish_at?: string | null
          slug?: string
          title_en?: string | null
          title_fr?: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          category: string | null
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          updated_at: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          updated_by_role: string | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_by_role?: string | null
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: []
      }
      sms_campaigns: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          message: string
          recipients_count: number
          sent_by_email: string | null
          sent_count: number
          status: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          message: string
          recipients_count?: number
          sent_by_email?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          message?: string
          recipients_count?: number
          sent_by_email?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      staff_client_access_sessions: {
        Row: {
          client_user_id: string
          created_at: string | null
          expires_at: string
          id: string
          reason: string
          staff_user_id: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          client_user_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          reason: string
          staff_user_id: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          client_user_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          reason?: string
          staff_user_id?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      staff_email_allowlist: {
        Row: {
          allowed_role: string
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          is_bootstrap: boolean | null
        }
        Insert: {
          allowed_role: string
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          is_bootstrap?: boolean | null
        }
        Update: {
          allowed_role?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          is_bootstrap?: boolean | null
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          amount: number | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          entity_id: string | null
          entity_number: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: Database["public"]["Enums"]["staff_notification_type"]
          read_at: string | null
          read_by: string | null
          title: string
        }
        Insert: {
          amount?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: Database["public"]["Enums"]["staff_notification_type"]
          read_at?: string | null
          read_by?: string | null
          title: string
        }
        Update: {
          amount?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: Database["public"]["Enums"]["staff_notification_type"]
          read_at?: string | null
          read_by?: string | null
          title?: string
        }
        Relationships: []
      }
      staff_onboarding_tokens: {
        Row: {
          created_at: string | null
          created_by_admin_id: string | null
          email: string
          expires_at: string
          id: string
          role: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_admin_id?: string | null
          email: string
          expires_at: string
          id?: string
          role: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by_admin_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staff_otp_codes: {
        Row: {
          attempts: number | null
          code_hash: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          max_attempts: number | null
          used: boolean | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          code_hash: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          max_attempts?: number | null
          used?: boolean | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          code_hash?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      streaming_activation_tokens: {
        Row: {
          activated_at: string | null
          activation_token: string
          activation_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          promo_code: string | null
          reissued_count: number | null
          sent_at: string | null
          sent_by: string | null
          service_name: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activation_token?: string
          activation_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          promo_code?: string | null
          reissued_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          service_name: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activation_token?: string
          activation_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          promo_code?: string | null
          reissued_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          service_name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaming_activation_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "streaming_activation_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "streaming_catalog_audit_logs_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "streaming_catalog_public"
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
      support_ticket_id_status_debug: {
        Row: {
          created_at: string
          id: string
          normalized_value: string | null
          raw_value: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_value?: string | null
          raw_value?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          normalized_value?: string | null
          raw_value?: string | null
          source?: string | null
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
          owner_user_id: string
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
          owner_user_id: string
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
          owner_user_id?: string
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      technician_slot_bookings: {
        Row: {
          client_id: string
          created_at: string
          id: string
          installation_id: string
          order_id: string | null
          slot_date: string
          slot_id: string
          status: string
          technician_level: string
          time_slot: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          installation_id: string
          order_id?: string | null
          slot_date: string
          slot_id: string
          status?: string
          technician_level: string
          time_slot: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          installation_id?: string
          order_id?: string | null
          slot_date?: string
          slot_id?: string
          status?: string
          technician_level?: string
          time_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_slot_bookings_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: true
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_slot_bookings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "technician_slot_bookings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_slot_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "technician_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_slots: {
        Row: {
          booked: number
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          region: string
          slot_date: string
          technician_level: Database["public"]["Enums"]["technician_level"]
          time_slot: string
        }
        Insert: {
          booked?: number
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          region?: string
          slot_date: string
          technician_level?: Database["public"]["Enums"]["technician_level"]
          time_slot: string
        }
        Update: {
          booked?: number
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          region?: string
          slot_date?: string
          technician_level?: Database["public"]["Enums"]["technician_level"]
          time_slot?: string
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
          password_hash: string | null
          phone: string | null
          require_password_change: boolean | null
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
          password_hash?: string | null
          phone?: string | null
          require_password_change?: boolean | null
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
          password_hash?: string | null
          phone?: string | null
          require_password_change?: boolean | null
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
      telephony_logs: {
        Row: {
          action: string
          agent_email: string | null
          agent_name: string | null
          agent_user_id: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          id: string
          message_preview: string | null
          notes: string | null
          openphone_call_id: string | null
          openphone_message_id: string | null
          phone_number: string | null
          raw_payload: Json | null
          status: string | null
        }
        Insert: {
          action: string
          agent_email?: string | null
          agent_name?: string | null
          agent_user_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          openphone_call_id?: string | null
          openphone_message_id?: string | null
          phone_number?: string | null
          raw_payload?: Json | null
          status?: string | null
        }
        Update: {
          action?: string
          agent_email?: string | null
          agent_name?: string | null
          agent_user_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          openphone_call_id?: string | null
          openphone_message_id?: string | null
          phone_number?: string | null
          raw_payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          reply_id: string | null
          storage_bucket: string | null
          ticket_id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          reply_id?: string | null
          storage_bucket?: string | null
          ticket_id: string
          uploader_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          reply_id?: string | null
          storage_bucket?: string | null
          ticket_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "ticket_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_participants: {
        Row: {
          added_at: string | null
          added_by: string | null
          can_reassign: boolean | null
          can_reply: boolean | null
          id: string
          role: string
          ticket_id: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          can_reassign?: boolean | null
          can_reply?: boolean | null
          id?: string
          role?: string
          ticket_id: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          can_reassign?: boolean | null
          can_reply?: boolean | null
          id?: string
          role?: string
          ticket_id?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_participants_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_participants_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_admin: boolean
          is_internal_note: boolean | null
          sender_name: string | null
          sender_role: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          is_admin?: boolean
          is_internal_note?: boolean | null
          sender_name?: string | null
          sender_role?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          is_internal_note?: boolean | null
          sender_name?: string | null
          sender_role?: string
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
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          error_code: string | null
          error_message: string | null
          event_category: string
          event_type: string
          id: string
          invoice_number: string | null
          ip_address: string | null
          metadata: Json | null
          order_id: string | null
          order_number: string | null
          payment_number: string | null
          payment_reference: string | null
          paypal_capture_id: string | null
          paypal_order_id: string | null
          session_id: string | null
          source: string
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          event_category?: string
          event_type: string
          id?: string
          invoice_number?: string | null
          ip_address?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_number?: string | null
          payment_number?: string | null
          payment_reference?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          session_id?: string | null
          source?: string
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          event_category?: string
          event_type?: string
          id?: string
          invoice_number?: string | null
          ip_address?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_number?: string | null
          payment_number?: string | null
          payment_reference?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          session_id?: string | null
          source?: string
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          admin_pin_hash: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_auth_check_at: string | null
          last_login_at: string | null
          onboarding_completed_at: string | null
          otp_required: boolean | null
          otp_verified_at: string | null
          permissions: Json | null
          require_onboarding: boolean | null
          require_password_change: boolean | null
          require_pin_change: boolean | null
          require_terms_acceptance: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          staff_pin_failed_attempts: number | null
          staff_pin_hash: string | null
          staff_pin_lockout_until: string | null
          staff_pin_salt: string | null
          staff_pin_set_at: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          user_id: string
        }
        Insert: {
          admin_pin_hash?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_auth_check_at?: string | null
          last_login_at?: string | null
          onboarding_completed_at?: string | null
          otp_required?: boolean | null
          otp_verified_at?: string | null
          permissions?: Json | null
          require_onboarding?: boolean | null
          require_password_change?: boolean | null
          require_pin_change?: boolean | null
          require_terms_acceptance?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          staff_pin_failed_attempts?: number | null
          staff_pin_hash?: string | null
          staff_pin_lockout_until?: string | null
          staff_pin_salt?: string | null
          staff_pin_set_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id: string
        }
        Update: {
          admin_pin_hash?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_auth_check_at?: string | null
          last_login_at?: string | null
          onboarding_completed_at?: string | null
          otp_required?: boolean | null
          otp_verified_at?: string | null
          permissions?: Json | null
          require_onboarding?: boolean | null
          require_password_change?: boolean | null
          require_pin_change?: boolean | null
          require_terms_acceptance?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          staff_pin_failed_attempts?: number | null
          staff_pin_hash?: string | null
          staff_pin_lockout_until?: string | null
          staff_pin_salt?: string | null
          staff_pin_set_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id?: string
        }
        Relationships: []
      }
      web_form_email_map: {
        Row: {
          created_at: string
          id: string
          reply_token: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_token: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_token?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_form_email_map_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "web_form_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      web_form_messages: {
        Row: {
          body_html: string | null
          body_text: string
          created_at: string
          direction: string
          email_in_reply_to: string | null
          email_message_id: string | null
          id: string
          is_internal_note: boolean
          raw_email_payload: Json | null
          sender_email: string | null
          sender_name: string | null
          sender_type: string
          thread_id: string
        }
        Insert: {
          body_html?: string | null
          body_text: string
          created_at?: string
          direction: string
          email_in_reply_to?: string | null
          email_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          raw_email_payload?: Json | null
          sender_email?: string | null
          sender_name?: string | null
          sender_type: string
          thread_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          created_at?: string
          direction?: string
          email_in_reply_to?: string | null
          email_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          raw_email_payload?: Json | null
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_form_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "web_form_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      web_form_threads: {
        Row: {
          admin_assignee_user_id: string | null
          admin_tags: string[] | null
          contact_email: string
          contact_full_name: string
          contact_phone: string | null
          created_at: string
          id: string
          is_linked_client: boolean
          last_message_at: string
          last_sender_type: string | null
          linked_user_id: string | null
          page_url: string | null
          status: string
          subject: string
          thread_number: string | null
          updated_at: string
        }
        Insert: {
          admin_assignee_user_id?: string | null
          admin_tags?: string[] | null
          contact_email: string
          contact_full_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_linked_client?: boolean
          last_message_at?: string
          last_sender_type?: string | null
          linked_user_id?: string | null
          page_url?: string | null
          status?: string
          subject?: string
          thread_number?: string | null
          updated_at?: string
        }
        Update: {
          admin_assignee_user_id?: string | null
          admin_tags?: string[] | null
          contact_email?: string
          contact_full_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_linked_client?: boolean
          last_message_at?: string
          last_sender_type?: string | null
          linked_user_id?: string | null
          page_url?: string | null
          status?: string
          subject?: string
          thread_number?: string | null
          updated_at?: string
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      client_payment_history: {
        Row: {
          amount: number | null
          billing_id: string | null
          captured_at: string | null
          client_id: string | null
          created_at: string | null
          created_by_name: string | null
          created_by_role: string | null
          id: string | null
          invoice_balance_due: number | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          order_id: string | null
          payment_method: string | null
          reference_number: string | null
          source: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
      field_sales_leaderboard: {
        Row: {
          email: string | null
          full_name: string | null
          sales_this_month: number | null
          sales_this_week: number | null
          sales_today: number | null
          total_bonuses: number | null
          total_commissions: number | null
          total_revenue: number | null
          total_sales: number | null
          user_id: string | null
        }
        Relationships: []
      }
      influencer_invites_public: {
        Row: {
          expires_at: string | null
          id: string | null
          is_used: boolean | null
          is_valid: boolean | null
        }
        Insert: {
          expires_at?: string | null
          id?: string | null
          is_used?: never
          is_valid?: never
        }
        Update: {
          expires_at?: string | null
          id?: string | null
          is_used?: never
          is_valid?: never
        }
        Relationships: []
      }
      order_next_actions: {
        Row: {
          active_items: number | null
          failed_jobs: number | null
          id_verification_status: string | null
          next_action: string | null
          next_action_label: string | null
          order_id: string | null
          order_number: string | null
          payment_status: string | null
          status: string | null
          total_items: number | null
        }
        Insert: {
          active_items?: never
          failed_jobs?: never
          id_verification_status?: string | null
          next_action?: never
          next_action_label?: never
          order_id?: string | null
          order_number?: string | null
          payment_status?: string | null
          status?: string | null
          total_items?: never
        }
        Update: {
          active_items?: never
          failed_jobs?: never
          id_verification_status?: string | null
          next_action?: never
          next_action_label?: never
          order_id?: string | null
          order_number?: string | null
          payment_status?: string | null
          status?: string | null
          total_items?: never
        }
        Relationships: []
      }
      payment_requests_admin_view: {
        Row: {
          account_id: string | null
          account_number: string | null
          account_status: string | null
          amount: number | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_reference: string | null
          created_at: string | null
          crypto_currency: string | null
          crypto_txid: string | null
          crypto_wallet_address: string | null
          currency: string | null
          id: string | null
          invoice_id: string | null
          method: string | null
          payment_instructions: string | null
          reference_code: string | null
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_cron_jobs: {
        Row: {
          description: string | null
          job_name: string | null
          last_run_approx: string | null
          schedule: string | null
        }
        Relationships: []
      }
      qa_document_sources: {
        Row: {
          document_type: string | null
          filter_condition: string | null
          source_table: string | null
          template_path: string | null
        }
        Relationships: []
      }
      qa_orphaned_payments: {
        Row: {
          bc_email: string | null
          billing_customer_id: string | null
          customer_email: string | null
          customer_name: string | null
          invoice_created_at: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status:
            | Database["public"]["Enums"]["billing_invoice_status"]
            | null
          invoice_total: number | null
          link_status: string | null
          profile_email: string | null
          profile_user_id: string | null
        }
        Relationships: []
      }
      qa_payments_without_client: {
        Row: {
          email: string | null
          full_name: string | null
          invoice_count: number | null
          last_invoice_at: string | null
          total_invoiced: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      qa_pdf_generation_logs: {
        Row: {
          customer_email: string | null
          doc_type: string | null
          engine_version: string | null
          error_message: string | null
          generated_at: string | null
          id: string | null
          invoice_number: string | null
          order_number: string | null
          payment_provider: string | null
          success: boolean | null
          template_path: string | null
          template_version: string | null
        }
        Relationships: []
      }
      qa_pdf_templates_runtime: {
        Row: {
          created_at: string | null
          generation_count: number | null
          is_active: boolean | null
          last_used_at: string | null
          template_key: string | null
          template_path: string | null
          template_type: string | null
          updated_at: string | null
          version: string | null
        }
        Relationships: []
      }
      services_public: {
        Row: {
          activation_fee_rule: string | null
          badges: Json | null
          billing_type: string | null
          category: string | null
          description: string | null
          display_order: number | null
          equipment_rules: Json | null
          features_json: Json | null
          id: string | null
          installation_fee_rule: string | null
          is_featured: boolean | null
          is_recommended: boolean | null
          name: string | null
          price: number | null
          promo_eligible: boolean | null
          shipping_fee_rule: string | null
          short_description: string | null
          status: string | null
          tags: Json | null
          visible_checkout: boolean | null
          visible_portal: boolean | null
          visible_simulator: boolean | null
          visible_website: boolean | null
        }
        Insert: {
          activation_fee_rule?: string | null
          badges?: Json | null
          billing_type?: string | null
          category?: string | null
          description?: string | null
          display_order?: number | null
          equipment_rules?: Json | null
          features_json?: Json | null
          id?: string | null
          installation_fee_rule?: string | null
          is_featured?: boolean | null
          is_recommended?: boolean | null
          name?: string | null
          price?: number | null
          promo_eligible?: boolean | null
          shipping_fee_rule?: string | null
          short_description?: string | null
          status?: string | null
          tags?: Json | null
          visible_checkout?: boolean | null
          visible_portal?: boolean | null
          visible_simulator?: boolean | null
          visible_website?: boolean | null
        }
        Update: {
          activation_fee_rule?: string | null
          badges?: Json | null
          billing_type?: string | null
          category?: string | null
          description?: string | null
          display_order?: number | null
          equipment_rules?: Json | null
          features_json?: Json | null
          id?: string | null
          installation_fee_rule?: string | null
          is_featured?: boolean | null
          is_recommended?: boolean | null
          name?: string | null
          price?: number | null
          promo_eligible?: boolean | null
          shipping_fee_rule?: string | null
          short_description?: string | null
          status?: string | null
          tags?: Json | null
          visible_checkout?: boolean | null
          visible_portal?: boolean | null
          visible_simulator?: boolean | null
          visible_website?: boolean | null
        }
        Relationships: []
      }
      site_offers_public: {
        Row: {
          category: string | null
          description_en: string | null
          description_fr: string | null
          discount_amount: number | null
          discount_percent: number | null
          features_json: Json | null
          id: string | null
          is_featured: boolean | null
          name_en: string | null
          name_fr: string | null
          offer_type: string | null
          price_monthly: number | null
          price_setup: number | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          description_en?: string | null
          description_fr?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          features_json?: Json | null
          id?: string | null
          is_featured?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          offer_type?: string | null
          price_monthly?: number | null
          price_setup?: number | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          description_en?: string | null
          description_fr?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          features_json?: Json | null
          id?: string | null
          is_featured?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          offer_type?: string | null
          price_monthly?: number | null
          price_setup?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      site_settings_public: {
        Row: {
          category: string | null
          description: string | null
          id: string | null
          key: string | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string | null
          key?: string | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string | null
          key?: string | null
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: []
      }
      streaming_catalog_public: {
        Row: {
          category: string | null
          currency: string | null
          description: string | null
          features: Json | null
          id: string | null
          logo_url: string | null
          name: string | null
          price_monthly: number | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          price_monthly?: number | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          price_monthly?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          category: string | null
          client_email: string | null
          created_at: string | null
          created_by_role: string | null
          created_by_user_id: string | null
          description: string | null
          id: string | null
          id_files: Json | null
          id_verification_status: string | null
          internal_notes: string | null
          issue_type: string | null
          owner_user_id: string | null
          point_of_contact_id: string | null
          priority: string | null
          related_order_id: string | null
          related_order_reference: string | null
          requires_id_upload: boolean | null
          status: string | null
          subject: string | null
          ticket_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          client_email?: string | null
          created_at?: string | null
          created_by_role?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string | null
          id_files?: Json | null
          id_verification_status?: string | null
          internal_notes?: string | null
          issue_type?: string | null
          owner_user_id?: string | null
          point_of_contact_id?: string | null
          priority?: string | null
          related_order_id?: string | null
          related_order_reference?: string | null
          requires_id_upload?: boolean | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          client_email?: string | null
          created_at?: string | null
          created_by_role?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string | null
          id_files?: Json | null
          id_verification_status?: string | null
          internal_notes?: string | null
          issue_type?: string | null
          owner_user_id?: string | null
          point_of_contact_id?: string | null
          priority?: string | null
          related_order_id?: string | null
          related_order_reference?: string | null
          requires_id_upload?: boolean | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_id?: string | null
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
            referencedRelation: "order_next_actions"
            referencedColumns: ["order_id"]
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
      unified_clients: {
        Row: {
          account_number: string | null
          account_status: string | null
          client_number: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          has_billing_customer: boolean | null
          has_profile: boolean | null
          id: string | null
          last_name: string | null
          phone: string | null
          sector_tags: string[] | null
          service_address: string | null
          service_city: string | null
          service_postal_code: string | null
          service_province: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_sign_contract: {
        Args: {
          p_admin_name: string
          p_admin_user_id: string
          p_contract_id: string
        }
        Returns: Json
      }
      allocate_payment_to_invoice: {
        Args: {
          p_actor_id?: string
          p_actor_name?: string
          p_actor_role?: string
          p_amount: number
          p_invoice_entry_id: string
          p_notes?: string
          p_payment_entry_id: string
        }
        Returns: Json
      }
      allocate_payment_to_invoices: {
        Args: {
          p_actor_id?: string
          p_actor_name?: string
          p_actor_role?: string
          p_payment_entry_id: string
        }
        Returns: Json
      }
      apply_payment_to_invoice: {
        Args: {
          p_amount: number
          p_created_by_name?: string
          p_created_by_role?: string
          p_customer_id?: string
          p_invoice_id: string
          p_method?: string
          p_provider?: string
          p_provider_order_id?: string
          p_provider_payment_id?: string
          p_source?: string
        }
        Returns: Json
      }
      approve_kyc_session: {
        Args: { p_decision: string; p_note?: string; p_session_id: string }
        Returns: Json
      }
      book_slot: {
        Args: {
          p_installation_id: string
          p_order_id?: string
          p_slot_id: string
        }
        Returns: Json
      }
      calculate_activation_fee: {
        Args: { service_count: number }
        Returns: number
      }
      calculate_billing_proration: {
        Args: { p_new_price: number; p_subscription_id: string }
        Returns: number
      }
      calculate_next_invoice_date: {
        Args: { p_billing_day: number; p_from_date?: string }
        Returns: string
      }
      check_admin_otp_session: {
        Args: { p_admin_user_id: string; p_session_token_hash: string }
        Returns: boolean
      }
      check_and_queue_payment_reminders: { Args: never; Returns: undefined }
      check_lockdown_status: { Args: never; Returns: Json }
      check_overdue_invoices: { Args: never; Returns: undefined }
      cleanup_expired_admin_otp: { Args: never; Returns: undefined }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      client_sign_contract: {
        Args: {
          p_contract_id: string
          p_signature_text: string
          p_signature_type?: string
        }
        Returns: Json
      }
      client_sign_contract_with_token: {
        Args: {
          p_signature_text: string
          p_signature_type?: string
          p_token: string
        }
        Returns: Json
      }
      commit_order_atomic: { Args: { p_payload: Json }; Returns: Json }
      compute_address_hash: {
        Args: {
          p_address_line: string
          p_city: string
          p_postal_code: string
          p_province: string
        }
        Returns: string
      }
      compute_channels_total: { Args: { _channels: Json }; Returns: number }
      compute_checkout_pricing: {
        Args: {
          p_cart_items: Json
          p_client_email?: string
          p_client_id?: string
          p_preauth_discount?: number
          p_promo_code?: string
        }
        Returns: Json
      }
      compute_invoice_breakdown: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      confirm_appointment_hold: {
        Args: {
          p_appointment_id: string
          p_client_id: string
          p_order_id: string
        }
        Returns: Json
      }
      create_activity_log: {
        Args: {
          p_action: string
          p_after_data?: Json
          p_before_data?: Json
          p_entity_id: string
          p_entity_type: string
          p_summary?: string
        }
        Returns: string
      }
      create_appointment_hold: {
        Args: {
          p_client_id: string
          p_hold_minutes?: number
          p_installation_id?: string
          p_installation_method?: string
          p_scheduled_at: string
          p_service_address?: string
          p_service_city?: string
          p_service_postal_code?: string
          p_service_type?: string
          p_slot_id?: string
          p_time_slot: string
        }
        Returns: Json
      }
      create_invoice_with_lines: {
        Args: {
          p_customer_id: string
          p_cycle_end?: string
          p_cycle_start?: string
          p_due_date?: string
          p_invoice_number: string
          p_lines?: Json
          p_order_id?: string
          p_payment_method?: string
          p_subscription_id: string
          p_subtotal: number
          p_total: number
          p_tps_amount: number
          p_tvq_amount: number
          p_type: string
        }
        Returns: string
      }
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
      create_order_snapshot: {
        Args: {
          p_billing_snapshot?: Json
          p_client_snapshot: Json
          p_equipment_snapshot?: Json
          p_fees_snapshot?: Json
          p_order_id: string
          p_payment_method_snapshot?: Json
          p_selected_channels_snapshot?: Json
          p_services_snapshot?: Json
        }
        Returns: string
      }
      expire_stale_holds: { Args: never; Returns: number }
      extract_uuid_from_text: { Args: { p_text: string }; Returns: string }
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
      generate_account_renewal_invoice: {
        Args: { p_account_id: string }
        Returns: Json
      }
      generate_appointment_number: { Args: never; Returns: string }
      generate_billing_invoice_number: { Args: never; Returns: string }
      generate_billing_renewals: { Args: never; Returns: undefined }
      generate_client_number: { Args: never; Returns: string }
      generate_confirmation_number: { Args: never; Returns: string }
      generate_contract_number: { Args: never; Returns: string }
      generate_contract_signature_token:
        | { Args: { p_contract_id: string }; Returns: string }
        | { Args: { p_contract_id: string; p_role?: string }; Returns: string }
      generate_dispute_number: { Args: never; Returns: string }
      generate_etransfer_reference: { Args: never; Returns: string }
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
      generate_secure_account_number: { Args: never; Returns: string }
      generate_secure_numeric_id: {
        Args: { p_length: number }
        Returns: string
      }
      generate_technician_slots: {
        Args: { days_ahead?: number }
        Returns: undefined
      }
      generate_ticket_number: { Args: never; Returns: string }
      generate_work_order_number: { Args: never; Returns: string }
      get_automatic_email_identity: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_key: string
          p_template_key: string
          p_template_vars: Json
        }
        Returns: {
          event_scope: string
          event_type: string
          event_version: string
          is_manual: boolean
          is_target: boolean
        }[]
      }
      get_client_balance: { Args: { p_client_id: string }; Returns: number }
      get_client_ledger_balance: {
        Args: { p_client_id: string }
        Returns: {
          amount_due: number
          available_credit: number
          balance: number
          credit_blocked: boolean
          oldest_unpaid_date: string
          outstanding_invoices: number
          total_credits: number
          total_debits: number
        }[]
      }
      get_entries_allocation_counts: {
        Args: { p_entry_ids: string[] }
        Returns: {
          allocation_count: number
          entry_id: string
        }[]
      }
      get_entry_allocation_count: {
        Args: { p_entry_id: string }
        Returns: number
      }
      get_influencer_id: { Args: { _user_id: string }; Returns: string }
      get_invoice_payment_history: {
        Args: { p_invoice_entry_id: string }
        Returns: {
          allocated_at: string
          allocated_by_name: string
          allocation_id: string
          amount_allocated: number
          payment_entry_id: string
          payment_method: string
          payment_reference: string
        }[]
      }
      get_kyc_document_urls: { Args: { p_session_id: string }; Returns: Json }
      get_ledger_allocations: {
        Args: { p_entry_id: string }
        Returns: {
          allocated_at: string
          allocation_id: string
          amount_allocated: number
          is_payment: boolean
          other_description: string
          other_entry_id: string
          other_entry_type: string
          other_reference_number: string
        }[]
      }
      get_user_staff_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_staff_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_pin: { Args: { pin: string }; Returns: string }
      increment_automation_stats: {
        Args: { rule_id: string; sent_count?: number; triggered_count?: number }
        Returns: undefined
      }
      increment_campaign_stat: {
        Args: { p_campaign_id: string; p_field: string; p_increment?: number }
        Returns: undefined
      }
      increment_referral_usage: {
        Args: { code_id: string }
        Returns: undefined
      }
      is_assigned_technician: {
        Args: { _work_order_id: string }
        Returns: boolean
      }
      is_audit_session_active: { Args: { _user_id: string }; Returns: boolean }
      is_field_sales: { Args: { _user_id?: string }; Returns: boolean }
      is_first_client_order: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      is_influencer: { Args: { _user_id: string }; Returns: boolean }
      is_new_customer: {
        Args: { p_current_order_id: string; p_user_id: string }
        Returns: boolean
      }
      is_payment_captured: {
        Args: { p_captured_at?: string; p_paid_at?: string; p_status: string }
        Returns: boolean
      }
      is_staff_member: { Args: { _user_id: string }; Returns: boolean }
      is_staff_user: { Args: { _user_id: string }; Returns: boolean }
      lift_client_suspension: {
        Args: { p_client_id: string; p_require_pin_reset?: boolean }
        Returns: undefined
      }
      log_pdf_generation: {
        Args: {
          p_customer_email?: string
          p_doc_type: string
          p_engine_version?: string
          p_entity_id?: string
          p_error_message?: string
          p_invoice_id?: string
          p_invoice_number?: string
          p_order_id?: string
          p_order_number?: string
          p_payment_provider?: string
          p_provider_payment_id?: string
          p_success?: boolean
          p_template_path?: string
          p_template_version?: string
          p_user_id?: string
        }
        Returns: string
      }
      mark_billing_as_paid: {
        Args: {
          p_admin_note?: string
          p_billing_id: string
          p_payment_method?: string
          p_payment_reference?: string
        }
        Returns: boolean
      }
      mark_payment_error_captured: {
        Args: {
          p_admin_user_id?: string
          p_error_reason: string
          p_payment_id: string
        }
        Returns: undefined
      }
      normalize_address: {
        Args: {
          p_address_line: string
          p_city: string
          p_postal_code: string
          p_province: string
        }
        Returns: string
      }
      normalize_text: { Args: { val: string }; Returns: string }
      orchestrate_order: { Args: { p_order_id: string }; Returns: Json }
      provision_services_for_order: {
        Args: { p_order_id: string }
        Returns: Json
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
      recalculate_client_balance: {
        Args: { p_user_id: string }
        Returns: number
      }
      recompute_invoice_balance: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      reconcile_all_invoices: { Args: never; Returns: Json }
      reconcile_invoice_from_payments: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      reconcile_orphan_paid_orders: {
        Args: { p_dry_run?: boolean }
        Returns: Json
      }
      record_payment_error_captured: {
        Args: {
          p_error_reason: string
          p_order_id: string
          p_payment_id: string
        }
        Returns: undefined
      }
      recover_error_captured_payment: {
        Args: {
          p_action: string
          p_admin_id: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: Json
      }
      regenerate_contract_pdf: {
        Args: { p_contract_id: string; p_create_new_version?: boolean }
        Returns: Json
      }
      resolve_or_create_service_address: {
        Args: { p_customer_id: string; p_order_id?: string }
        Returns: string
      }
      search_clients_unified: {
        Args: {
          search_email?: string
          search_name?: string
          search_phone?: string
        }
        Returns: {
          created_at: string
          email: string
          full_name: string
          has_account: boolean
          has_billing_customer: boolean
          has_invoices: boolean
          has_orders: boolean
          has_profile: boolean
          phone: string
          source: string
          source_id: string
        }[]
      }
      split_full_name: {
        Args: { full_name_val: string }
        Returns: {
          first_name: string
          last_name: string
        }[]
      }
      supersede_contract_version: {
        Args: { p_order_id: string }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_template_last_used_at: {
        Args: { p_template_key: string }
        Returns: undefined
      }
      validate_contract_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      validate_referral_code: {
        Args: { p_code: string }
        Returns: {
          code_id: string
          discount_percent: number
          is_valid: boolean
        }[]
      }
      validate_signature_token: {
        Args: { p_token: string }
        Returns: {
          contract_id: string
          error_message: string
          is_valid: boolean
          role: string
        }[]
      }
      verify_pin: {
        Args: { pin_input: string; user_id_input: string }
        Returns: boolean
      }
      verify_staff_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "client"
        | "technician"
        | "employee"
        | "influencer"
        | "field_sales"
        | "sales"
        | "kyc_agent"
        | "billing_admin"
        | "techops"
        | "support"
        | "supervisor"
      billing_customer_status: "active" | "suspended" | "closed"
      billing_invoice_status:
        | "draft"
        | "pending"
        | "partially_paid"
        | "paid"
        | "paid_by_promo"
        | "failed"
        | "cancelled"
        | "refunded"
        | "overdue"
        | "void"
        | "not_renewed"
      billing_invoice_type: "initial" | "renewal" | "adjustment" | "credit"
      billing_payment_method: "interac" | "manual" | "paypal"
      billing_payment_status: "pending" | "confirmed" | "failed"
      billing_subscription_status:
        | "active"
        | "pending"
        | "suspended"
        | "cancelled"
        | "expired"
        | "not_renewed"
      cancellation_reason_code:
        | "price"
        | "moving"
        | "not_needed"
        | "service_issue"
        | "billing_issue"
        | "other"
      cancellation_service_type:
        | "mobile"
        | "internet"
        | "tv"
        | "security"
        | "streaming"
        | "bundle"
      cancellation_status:
        | "requested"
        | "under_review"
        | "awaiting_client"
        | "approved"
        | "scheduled"
        | "completed"
        | "declined"
      cashout_status:
        | "requested"
        | "under_review"
        | "approved"
        | "rejected"
        | "paid"
      commission_ledger_type:
        | "pending_credit"
        | "approved_credit"
        | "reversal"
        | "payout_debit"
        | "manual_adjustment"
      commission_model_type:
        | "activation_fee"
        | "fixed_bounty"
        | "percent_first_invoice"
      dispute_reason_code:
        | "duplicate_charge"
        | "incorrect_amount"
        | "service_not_received"
        | "unauthorized"
        | "fraud"
        | "other"
      dispute_status:
        | "submitted"
        | "under_review"
        | "awaiting_client"
        | "resolved_approved"
        | "resolved_rejected"
      fraud_flag_level: "none" | "low" | "medium" | "high"
      fulfillment_type: "ship" | "technician" | "pickup"
      id_document_type:
        | "drivers_license"
        | "health_card"
        | "pr_card"
        | "passport_ca"
        | "passport_intl"
      influencer_status: "invited" | "active" | "suspended" | "pending"
      installation_status:
        | "pending"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      installation_zone: "zone_a" | "zone_b" | "zone_c"
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
      inventory_assignment_status:
        | "reserved"
        | "assigned"
        | "shipped"
        | "installed"
        | "returned"
        | "lost"
        | "defective"
      inventory_stock_type:
        | "modem"
        | "router"
        | "sim_card"
        | "esim"
        | "tv_box"
        | "remote"
        | "cable"
        | "security_hub"
        | "camera"
        | "other"
      ledger_entry_type:
        | "invoice"
        | "payment"
        | "credit"
        | "adjustment"
        | "refund"
        | "late_fee"
        | "promo_credit"
      order_item_service_type:
        | "internet"
        | "tv"
        | "mobile"
        | "streaming"
        | "security"
        | "addon"
        | "equipment"
        | "fee"
      order_item_status:
        | "pending"
        | "kyc_blocked"
        | "payment_blocked"
        | "fulfillment_pending"
        | "shipped"
        | "delivered"
        | "install_scheduled"
        | "install_complete"
        | "provisioning_pending"
        | "provisioning_in_progress"
        | "active"
        | "on_hold"
        | "cancelled"
        | "failed"
      order_lifecycle_status:
        | "draft"
        | "submitted"
        | "kyc_required"
        | "kyc_in_review"
        | "kyc_approved"
        | "kyc_rejected"
        | "payment_pending"
        | "paid"
        | "payment_failed"
        | "fulfillment_pending"
        | "provisioning_pending"
        | "provisioning_in_progress"
        | "active"
        | "partial_active"
        | "on_hold"
        | "completed"
        | "cancelled"
        | "failed"
        | "provisioning_failed"
      payment_status:
        | "pending"
        | "authorized"
        | "preauthorized"
        | "in_verification"
        | "captured"
        | "complete"
        | "paid"
        | "declined"
        | "failed"
        | "refunded"
        | "fraud"
        | "cancelled"
      provisioning_job_status:
        | "queued"
        | "waiting_dependency"
        | "in_progress"
        | "completed"
        | "failed"
        | "cancelled"
        | "manual_override"
      provisioning_job_type:
        | "INTERNET_ACTIVATE"
        | "TV_ACTIVATE"
        | "MOBILE_ACTIVATE"
        | "STREAMING_ACTIVATE"
        | "SECURITY_ACTIVATE"
        | "PORT_IN"
        | "ESIM_PROVISION"
        | "CHANNEL_PUSH"
        | "EQUIPMENT_ASSIGN"
        | "CUSTOM"
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
      shipment_status:
        | "pending"
        | "preparing"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "returned"
        | "lost"
        | "cancelled"
      staff_notification_type:
        | "new_order"
        | "invoice_created"
        | "payment_received"
        | "service_suspended"
        | "service_cancelled"
      staff_role: "admin" | "employee" | "technician"
      technician_level: "level_1" | "level_2"
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
      app_role: [
        "admin",
        "client",
        "technician",
        "employee",
        "influencer",
        "field_sales",
        "sales",
        "kyc_agent",
        "billing_admin",
        "techops",
        "support",
        "supervisor",
      ],
      billing_customer_status: ["active", "suspended", "closed"],
      billing_invoice_status: [
        "draft",
        "pending",
        "partially_paid",
        "paid",
        "paid_by_promo",
        "failed",
        "cancelled",
        "refunded",
        "overdue",
        "void",
        "not_renewed",
      ],
      billing_invoice_type: ["initial", "renewal", "adjustment", "credit"],
      billing_payment_method: ["interac", "manual", "paypal"],
      billing_payment_status: ["pending", "confirmed", "failed"],
      billing_subscription_status: [
        "active",
        "pending",
        "suspended",
        "cancelled",
        "expired",
        "not_renewed",
      ],
      cancellation_reason_code: [
        "price",
        "moving",
        "not_needed",
        "service_issue",
        "billing_issue",
        "other",
      ],
      cancellation_service_type: [
        "mobile",
        "internet",
        "tv",
        "security",
        "streaming",
        "bundle",
      ],
      cancellation_status: [
        "requested",
        "under_review",
        "awaiting_client",
        "approved",
        "scheduled",
        "completed",
        "declined",
      ],
      cashout_status: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "paid",
      ],
      commission_ledger_type: [
        "pending_credit",
        "approved_credit",
        "reversal",
        "payout_debit",
        "manual_adjustment",
      ],
      commission_model_type: [
        "activation_fee",
        "fixed_bounty",
        "percent_first_invoice",
      ],
      dispute_reason_code: [
        "duplicate_charge",
        "incorrect_amount",
        "service_not_received",
        "unauthorized",
        "fraud",
        "other",
      ],
      dispute_status: [
        "submitted",
        "under_review",
        "awaiting_client",
        "resolved_approved",
        "resolved_rejected",
      ],
      fraud_flag_level: ["none", "low", "medium", "high"],
      fulfillment_type: ["ship", "technician", "pickup"],
      id_document_type: [
        "drivers_license",
        "health_card",
        "pr_card",
        "passport_ca",
        "passport_intl",
      ],
      influencer_status: ["invited", "active", "suspended", "pending"],
      installation_status: [
        "pending",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      installation_zone: ["zone_a", "zone_b", "zone_c"],
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
      inventory_assignment_status: [
        "reserved",
        "assigned",
        "shipped",
        "installed",
        "returned",
        "lost",
        "defective",
      ],
      inventory_stock_type: [
        "modem",
        "router",
        "sim_card",
        "esim",
        "tv_box",
        "remote",
        "cable",
        "security_hub",
        "camera",
        "other",
      ],
      ledger_entry_type: [
        "invoice",
        "payment",
        "credit",
        "adjustment",
        "refund",
        "late_fee",
        "promo_credit",
      ],
      order_item_service_type: [
        "internet",
        "tv",
        "mobile",
        "streaming",
        "security",
        "addon",
        "equipment",
        "fee",
      ],
      order_item_status: [
        "pending",
        "kyc_blocked",
        "payment_blocked",
        "fulfillment_pending",
        "shipped",
        "delivered",
        "install_scheduled",
        "install_complete",
        "provisioning_pending",
        "provisioning_in_progress",
        "active",
        "on_hold",
        "cancelled",
        "failed",
      ],
      order_lifecycle_status: [
        "draft",
        "submitted",
        "kyc_required",
        "kyc_in_review",
        "kyc_approved",
        "kyc_rejected",
        "payment_pending",
        "paid",
        "payment_failed",
        "fulfillment_pending",
        "provisioning_pending",
        "provisioning_in_progress",
        "active",
        "partial_active",
        "on_hold",
        "completed",
        "cancelled",
        "failed",
        "provisioning_failed",
      ],
      payment_status: [
        "pending",
        "authorized",
        "preauthorized",
        "in_verification",
        "captured",
        "complete",
        "paid",
        "declined",
        "failed",
        "refunded",
        "fraud",
        "cancelled",
      ],
      provisioning_job_status: [
        "queued",
        "waiting_dependency",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
        "manual_override",
      ],
      provisioning_job_type: [
        "INTERNET_ACTIVATE",
        "TV_ACTIVATE",
        "MOBILE_ACTIVATE",
        "STREAMING_ACTIVATE",
        "SECURITY_ACTIVATE",
        "PORT_IN",
        "ESIM_PROVISION",
        "CHANNEL_PUSH",
        "EQUIPMENT_ASSIGN",
        "CUSTOM",
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
      shipment_status: [
        "pending",
        "preparing",
        "shipped",
        "in_transit",
        "delivered",
        "returned",
        "lost",
        "cancelled",
      ],
      staff_notification_type: [
        "new_order",
        "invoice_created",
        "payment_received",
        "service_suspended",
        "service_cancelled",
      ],
      staff_role: ["admin", "employee", "technician"],
      technician_level: ["level_1", "level_2"],
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
