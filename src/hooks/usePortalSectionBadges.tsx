/**
 * usePortalSectionBadges — État unifié des points rouges du portail Client.
 *
 * Combine deux sources :
 * 1) Notifications non-lues (table `notifications`) groupées par section cible
 * 2) État métier réel (factures impayées, KYC requis, contrats à signer,
 *    commandes en cours, tickets ouverts)
 *
 * Règle d'effacement (mixte) :
 * - Notifications non-lues  → effacées quand le client visite la section
 *   (géré ailleurs via markAsRead lors de la navigation, hors scope ici).
 * - États métier critiques  → restent jusqu'à résolution réelle.
 *
 * Le hook expose un objet `badges` indexé par clé de section. Pour chaque
 * section : { show: boolean, urgent: boolean }.
 *  - `show`   : afficher un point rouge
 *  - `urgent` : utiliser la variante "pulse"
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

export type PortalSectionKey =
  | "billing"      // Facturation et paiement (factures impayées)
  | "services"     // Utilisation et services (commande en cours, activation)
  | "identity"     // Vérification d'identité (KYC manquant)
  | "contracts"    // Contrats à signer
  | "support"      // Tickets / Documents en attente
  | "orders";      // Commandes en cours

export interface PortalSectionBadge {
  show: boolean;
  urgent: boolean;
}

export type PortalSectionBadges = Record<PortalSectionKey, PortalSectionBadge>;

const EMPTY: PortalSectionBadges = {
  billing: { show: false, urgent: false },
  services: { show: false, urgent: false },
  identity: { show: false, urgent: false },
  contracts: { show: false, urgent: false },
  support: { show: false, urgent: false },
  orders: { show: false, urgent: false },
};

export function usePortalSectionBadges(): {
  badges: PortalSectionBadges;
  isLoading: boolean;
} {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const { data: canonicalData, isLoading } = useCanonicalClientData(userId);

  const data: PortalSectionBadges = (() => {
      if (!userId || !canonicalData) return EMPTY;
      const unpaidCount = (canonicalData.invoices || []).filter((invoice: any) =>
        !["paid", "paid_by_promo", "cancelled", "refunded", "void"].includes(String(invoice.status || "").toLowerCase()) &&
        Number(invoice.balance_due || 0) > 0
      ).length;
      const openOrdersCount = (canonicalData.orders || []).filter((order: any) =>
        ["confirmed", "processing", "shipped", "out_for_delivery"].includes(String(order.status || "").toLowerCase())
      ).length;
      const notifs = (canonicalData.notifications || []).filter((notification: any) => !notification.is_read).slice(0, 200);
      const unreadByTarget = new Map<string, number>();
      (notifs ?? []).forEach((n: { link_target: string | null }) => {
        const t = (n.link_target ?? "").toLowerCase();
        if (!t) return;
        unreadByTarget.set(t, (unreadByTarget.get(t) ?? 0) + 1);
      });

      const hasUnread = (...targets: string[]) =>
        targets.some((t) => (unreadByTarget.get(t) ?? 0) > 0);

      // 5) Construction de l'état final
      const billingUnread = hasUnread("billing", "invoice", "invoices", "payment", "payments");
      const ordersUnread = hasUnread("order", "orders");
      const supportUnread = hasUnread("ticket", "tickets", "support", "document", "documents");
      const contractsUnread = hasUnread("contract", "contracts");
      const identityUnread = hasUnread("identity", "kyc", "identity_verification");
      const servicesUnread = hasUnread("service", "services", "activation", "equipment");

      return {
        billing: {
          show: unpaidCount > 0 || billingUnread,
          urgent: unpaidCount > 0, // facture impayée = urgent (pulse)
        },
        services: {
          show: openOrdersCount > 0 || servicesUnread,
          urgent: false,
        },
        orders: {
          show: openOrdersCount > 0 || ordersUnread,
          urgent: false,
        },
        identity: {
          show: identityUnread,
          urgent: identityUnread, // KYC manquant = urgent
        },
        contracts: {
          show: contractsUnread,
          urgent: contractsUnread, // signature requise = urgent
        },
        support: {
          show: supportUnread,
          urgent: false,
        },
      };
  })();

  // Realtime: invalider quand quelque chose change
  useEffect(() => {
    if (!userId) return;
    const channel = portalSupabase
      .channel(`portal-section-badges-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_portal_snapshots", filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-client-data", userId] });
      })
      .subscribe();
    return () => {
      portalSupabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { badges: data, isLoading };
}

export default usePortalSectionBadges;
