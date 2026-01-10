/**
 * Centralized Client Audit Notes System
 * Creates automatic notes for all key actions on client accounts
 */

import { adminClient as supabase } from "@/integrations/backend/adminClient";

// Event types for audit trail
export type AuditEventType = 
  | 'equipment_assigned'
  | 'technician_assigned'
  | 'status_changed'
  | 'installation_scheduled'
  | 'payment_recorded'
  | 'payment_confirmed'
  | 'payment_refunded'
  | 'payment_disputed'
  | 'profile_updated'
  | 'service_modified'
  | 'order_created'
  | 'order_completed'
  | 'promo_applied';

interface CreateAuditNoteParams {
  clientId: string;
  eventType: AuditEventType;
  message: string;
  metadata?: Record<string, any>;
  actorId?: string;
  actorRole?: 'admin' | 'employee' | 'system';
  actorName?: string;
}

// Anti-duplication: track recent notes to avoid duplicates
const recentNotes = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

/**
 * Create an automatic audit note for a client action
 * Includes anti-duplication logic
 */
export async function createAuditNote({
  clientId,
  eventType,
  message,
  metadata = {},
  actorId,
  actorRole = 'system',
  actorName
}: CreateAuditNoteParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Create dedup key
    const dedupKey = `${clientId}:${eventType}:${JSON.stringify(metadata)}`;
    const now = Date.now();
    const lastCreated = recentNotes.get(dedupKey);
    
    // Check for duplicate within window
    if (lastCreated && (now - lastCreated) < DEDUP_WINDOW_MS) {
      console.log('[AuditNote] Skipping duplicate note:', dedupKey);
      return { success: true }; // Silently skip
    }
    
    // Mark as created
    recentNotes.set(dedupKey, now);
    
    // Clean old entries
    for (const [key, timestamp] of recentNotes) {
      if (now - timestamp > DEDUP_WINDOW_MS * 2) {
        recentNotes.delete(key);
      }
    }
    
    // Get actor info if not provided
    let resolvedActorName = actorName;
    if (!resolvedActorName && actorId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", actorId)
        .maybeSingle();
      resolvedActorName = profile?.full_name || profile?.email || 'Inconnu';
    }
    
    // Create the internal note
    const { error } = await supabase
      .from("client_internal_notes")
      .insert({
        client_id: clientId,
        note_type: actorRole === 'admin' ? 'admin' : 'employee',
        body: `[${eventType.toUpperCase()}] ${message}`,
        created_by_user_id: actorId || '00000000-0000-0000-0000-000000000000',
        created_by_role: actorRole,
        created_by_name: resolvedActorName || 'Système',
      });
    
    if (error) throw error;
    
    // Also log to activity_logs for comprehensive tracking
    await supabase.from("activity_logs").insert({
      user_id: actorId || '00000000-0000-0000-0000-000000000000',
      action: eventType,
      entity_type: 'client',
      entity_id: clientId,
      details: { message, ...metadata },
      actor_role: actorRole,
      actor_name: resolvedActorName || 'Système',
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[AuditNote] Error creating audit note:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Pre-built note creators for common actions
 */
export const AuditNotes = {
  equipmentAssigned: (clientId: string, orderId: string, equipment: { terminalSerial?: string; routerSerial?: string }, actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    const parts = [];
    if (equipment.terminalSerial) parts.push(`Terminal: ${equipment.terminalSerial}`);
    if (equipment.routerSerial) parts.push(`Borne WiFi: ${equipment.routerSerial}`);
    
    return createAuditNote({
      clientId,
      eventType: 'equipment_assigned',
      message: `Équipement attribué - ${parts.join(', ')}`,
      metadata: { order_id: orderId, ...equipment },
      actorId,
      actorRole,
    });
  },
  
  technicianAssigned: (clientId: string, orderId: string, technicianName: string, actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    return createAuditNote({
      clientId,
      eventType: 'technician_assigned',
      message: `Technicien assigné: ${technicianName}`,
      metadata: { order_id: orderId, technician_name: technicianName },
      actorId,
      actorRole,
    });
  },
  
  statusChanged: (clientId: string, orderId: string, oldStatus: string, newStatus: string, actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    return createAuditNote({
      clientId,
      eventType: 'status_changed',
      message: `Statut commande modifié: ${oldStatus} → ${newStatus}`,
      metadata: { order_id: orderId, old_status: oldStatus, new_status: newStatus },
      actorId,
      actorRole,
    });
  },
  
  installationScheduled: (clientId: string, orderId: string, scheduledDate: string, actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    return createAuditNote({
      clientId,
      eventType: 'installation_scheduled',
      message: `Installation planifiée: ${scheduledDate}`,
      metadata: { order_id: orderId, scheduled_date: scheduledDate },
      actorId,
      actorRole,
    });
  },
  
  paymentRecorded: (clientId: string, amount: number, method: string, reference: string, actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    return createAuditNote({
      clientId,
      eventType: 'payment_recorded',
      message: `Paiement enregistré: ${amount.toFixed(2)} $ (${method}) - Réf: ${reference}`,
      metadata: { amount, method, reference },
      actorId,
      actorRole,
    });
  },
  
  profileUpdated: (clientId: string, changedFields: string[], actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    return createAuditNote({
      clientId,
      eventType: 'profile_updated',
      message: `Profil modifié: ${changedFields.join(', ')}`,
      metadata: { changed_fields: changedFields },
      actorId,
      actorRole,
    });
  },
  
  serviceModified: (clientId: string, serviceName: string, action: 'added' | 'removed' | 'modified', actorId: string, actorRole: 'admin' | 'employee' = 'admin') => {
    const actionLabels = { added: 'ajouté', removed: 'retiré', modified: 'modifié' };
    return createAuditNote({
      clientId,
      eventType: 'service_modified',
      message: `Service ${actionLabels[action]}: ${serviceName}`,
      metadata: { service_name: serviceName, action },
      actorId,
      actorRole,
    });
  },
  
  promoApplied: (clientId: string, orderId: string, promoCode: string, discountAmount: number, actorId?: string) => {
    return createAuditNote({
      clientId,
      eventType: 'promo_applied',
      message: `Code promo appliqué: ${promoCode} (-${discountAmount.toFixed(2)} $)`,
      metadata: { order_id: orderId, promo_code: promoCode, discount_amount: discountAmount },
      actorId,
      actorRole: 'system',
    });
  },
};

export default AuditNotes;
