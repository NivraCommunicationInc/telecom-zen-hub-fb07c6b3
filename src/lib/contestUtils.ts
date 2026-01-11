/**
 * Contest Entry Utilities
 * 
 * IMPORTANT: Contest entry is now handled SERVER-SIDE via database trigger.
 * The trigger `trigger_order_contest_entry` fires on order status change to
 * 'completed' or 'installation_completed' and creates the entry automatically.
 * 
 * This client-side utility is kept as a FALLBACK only, for manual intervention
 * or edge cases where the trigger might not fire.
 */

import { adminClient } from "@/integrations/backend/adminClient";

const CURRENT_CONTEST_SLUG = "welcome-500-2026";

// Final statuses that qualify for contest entry
// NARROWED: Only truly final statuses (payment confirmed, service activated)
const COMPLETION_STATUSES = ["completed", "installation_completed"] as const;

interface ContestEntryResult {
  success: boolean;
  message: string;
  entryId?: string;
}

/**
 * Check if a user is a new customer (no prior completed orders)
 * Uses narrowed status list: only 'completed' and 'installation_completed'
 */
export async function isNewCustomer(userId: string, currentOrderId?: string): Promise<boolean> {
  // Check for any prior completed orders (truly final statuses only)
  const { data: priorOrders, error } = await adminClient
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .in("status", COMPLETION_STATUSES)
    .neq("id", currentOrderId || "00000000-0000-0000-0000-000000000000")
    .limit(1);
    
  if (error) {
    console.error("Error checking prior orders:", error);
    return false;
  }
  
  return !priorOrders || priorOrders.length === 0;
}

/**
 * Create a contest entry for a user if eligible
 * - Must be a new customer
 * - Must not already have an entry for this contest
 */
export async function createContestEntry(
  userId: string,
  orderId: string,
  orderNumber: string
): Promise<ContestEntryResult> {
  try {
    // First, check if entry already exists (idempotent)
    const { data: existingEntry } = await adminClient
      .from("contest_entries")
      .select("id")
      .eq("contest_slug", CURRENT_CONTEST_SLUG)
      .eq("user_id", userId)
      .maybeSingle();
      
    if (existingEntry) {
      return { 
        success: true, 
        message: "Entrée au concours déjà existante",
        entryId: existingEntry.id 
      };
    }
    
    // Check if this is a new customer
    const isNew = await isNewCustomer(userId, orderId);
    if (!isNew) {
      return { 
        success: false, 
        message: "Client existant - non éligible au concours nouveaux clients" 
      };
    }
    
    // Get profile info for snapshots
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, full_name, phone")
      .eq("user_id", userId)
      .maybeSingle();
      
    if (!profile?.email) {
      return { 
        success: false, 
        message: "Profil client introuvable" 
      };
    }
    
    // Create the entry
    const { data: entry, error } = await adminClient
      .from("contest_entries")
      .insert({
        contest_slug: CURRENT_CONTEST_SLUG,
        user_id: userId,
        order_id: orderId,
        email_snapshot: profile.email,
        full_name_snapshot: profile.full_name || null,
        phone_snapshot: profile.phone || null,
      })
      .select("id")
      .single();
      
    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === "23505") {
        return { 
          success: true, 
          message: "Entrée au concours déjà existante" 
        };
      }
      throw error;
    }
    
    console.log(`Contest entry created for order ${orderNumber}: ${entry.id}`);
    
    return { 
      success: true, 
      message: "Inscription au tirage 500$ confirmée!",
      entryId: entry.id 
    };
    
  } catch (err) {
    console.error("Error creating contest entry:", err);
    return { 
      success: false, 
      message: "Erreur lors de l'inscription au concours" 
    };
  }
}

/**
 * Process contest entry when order is completed (FALLBACK)
 * 
 * NOTE: This is now handled automatically by database trigger
 * `trigger_order_contest_entry`. This function is kept as a fallback
 * for manual admin intervention if needed.
 * 
 * Final statuses for contest entry:
 * - 'completed': Order fully processed and paid
 * - 'installation_completed': Installation finished for tech-install orders
 */
export async function processOrderCompletionContest(
  order: {
    id: string;
    user_id: string;
    order_number: string;
  }
): Promise<ContestEntryResult> {
  if (!order.user_id) {
    return { success: false, message: "Aucun user_id sur la commande" };
  }
  
  return createContestEntry(order.user_id, order.id, order.order_number);
}
