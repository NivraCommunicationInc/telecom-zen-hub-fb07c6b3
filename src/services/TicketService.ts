/**
 * TicketService - Centralized ticket operations
 * Single source of truth for all ticket CRUD operations
 * Uses support_tickets table (not legacy "tickets")
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SupportTicket = Database["public"]["Tables"]["support_tickets"]["Row"];
type TicketReply = Database["public"]["Tables"]["ticket_replies"]["Row"];
type SenderRole = "client" | "admin" | "employee" | "technician";

export interface CreateTicketParams {
  user_id: string;
  owner_user_id: string;
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
  category?: string;
  issue_type?: string;
  related_order_id?: string;
  related_order_reference?: string;
  client_email?: string;
  client_name?: string;
  created_by_user_id?: string;
  created_by_role?: string;
  requires_id_upload?: boolean;
}

export interface CreateReplyParams {
  ticket_id: string;
  user_id: string;
  content: string;
  sender_role: SenderRole;
  is_admin?: boolean;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  user_id?: string;
  limit?: number;
}

/**
 * Fetch tickets with optional filters
 * Always uses support_tickets table
 */
export async function getTickets(
  client: typeof supabase,
  filters: TicketFilters = {}
): Promise<{ data: SupportTicket[] | null; error: Error | null }> {
  try {
    let query = client
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.priority) {
      query = query.eq("priority", filters.priority);
    }
    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.user_id) {
      query = query.eq("user_id", filters.user_id);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("[TicketService] getTickets error:", error);
      return { data: null, error: new Error(formatSupabaseError(error)) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("[TicketService] getTickets exception:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch a single ticket by ID
 */
export async function getTicketById(
  client: typeof supabase,
  ticketId: string
): Promise<{ data: SupportTicket | null; error: Error | null }> {
  try {
    const { data, error } = await client
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (error) {
      console.error("[TicketService] getTicketById error:", error);
      return { data: null, error: new Error(formatSupabaseError(error)) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("[TicketService] getTicketById exception:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Create a new support ticket
 */
export async function createTicket(
  client: typeof supabase,
  params: CreateTicketParams
): Promise<{ data: SupportTicket | null; error: Error | null }> {
  try {
    const { data, error } = await client
      .from("support_tickets")
      .insert({
        user_id: params.user_id,
        owner_user_id: params.owner_user_id,
        subject: params.subject,
        description: params.description,
        priority: params.priority || "normal",
        category: params.category || "general",
        issue_type: params.issue_type || null,
        related_order_id: params.related_order_id || null,
        related_order_reference: params.related_order_reference || null,
        client_email: params.client_email || null,
        client_name: params.client_name || null,
        created_by_user_id: params.created_by_user_id || null,
        created_by_role: params.created_by_role || null,
        requires_id_upload: params.requires_id_upload || false,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("[TicketService] createTicket error:", error);
      return { data: null, error: new Error(formatSupabaseError(error)) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("[TicketService] createTicket exception:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get replies for a ticket
 */
export async function getTicketReplies(
  client: typeof supabase,
  ticketId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await client
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[TicketService] getTicketReplies error:", error);
      return { data: null, error: new Error(formatSupabaseError(error)) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("[TicketService] getTicketReplies exception:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Create a reply to a ticket
 * IMPORTANT: Always specify sender_role correctly
 */
export async function createReply(
  client: typeof supabase,
  params: CreateReplyParams
): Promise<{ data: any | null; error: Error | null }> {
  try {
    if (!params.content.trim()) {
      return { data: null, error: new Error("Le message ne peut pas être vide") };
    }

    const { data, error } = await client
      .from("ticket_replies")
      .insert({
        ticket_id: params.ticket_id,
        user_id: params.user_id,
        content: params.content.trim(),
        sender_role: params.sender_role,
        is_admin: params.is_admin ?? params.sender_role !== "client",
      })
      .select()
      .single();

    if (error) {
      console.error("[TicketService] createReply error:", error);
      return { data: null, error: new Error(formatSupabaseError(error)) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("[TicketService] createReply exception:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  client: typeof supabase,
  ticketId: string,
  status: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await client
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) {
      console.error("[TicketService] updateTicketStatus error:", error);
      return { success: false, error: new Error(formatSupabaseError(error)) };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[TicketService] updateTicketStatus exception:", err);
    return { success: false, error: err as Error };
  }
}

/**
 * Format Supabase error for user display
 * Shows code, message, hint, and details
 */
function formatSupabaseError(error: any): string {
  const parts: string[] = [];
  
  if (error.code) {
    parts.push(`[${error.code}]`);
  }
  
  if (error.message) {
    parts.push(error.message);
  }
  
  if (error.hint) {
    parts.push(`Hint: ${error.hint}`);
  }
  
  if (error.details) {
    parts.push(`Details: ${error.details}`);
  }

  return parts.join(" - ") || "Une erreur inattendue s'est produite";
}

export { formatSupabaseError };
