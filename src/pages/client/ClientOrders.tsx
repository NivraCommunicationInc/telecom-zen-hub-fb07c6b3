import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { Package, Eye, Truck, Clock, CheckCircle, XCircle, AlertCircle, Copy, Phone, Shield, CreditCard, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ClientEquipmentOrderDetails from "@/components/client/ClientEquipmentOrderDetails";
import OrderStatusTimeline from "@/components/client/OrderStatusTimeline";
import { ContractSummaryDialog } from "@/components/contract/ContractSummaryDialog";
import { OrderShippingActivationPanel } from "@/components/orders/OrderShippingActivationPanel";
import { OrderLifecycleTimeline } from "@/components/orders/OrderLifecycleTimeline";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

/* ─── Dark tokens ───────────────────────────────────────────── */
const D = {
  bg:        "#0A0A0F",
  card:      "#111122",
  border:    "rgba(124,58,237,0.2)",
  borderLt:  "rgba(124,58,237,0.1)",
  text:      "#FFFFFF",
  textSec:   "#A0A0B8",
  textMuted: "#6B6B85",
  accent:    "#7C3AED",
  accentLt:  "#a78bfa",
};

// Phase 3 — règle: pro = jamais de bloc livraison côté client
const isProInstall = (order: any) => order?.installation_type === "technician";

/* ─── Dark status badge ─────────────────────────────────────── */
const statusStyle: Record<string, { bg: string; color: string }> = {
  pending:         { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24" },
  payment_pending: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24" },
  verification:    { bg: "rgba(59,130,246,0.12)",   color: "#60a5fa" },
  hold:            { bg: "rgba(124,58,237,0.12)",   color: "#a78bfa" },
  backorder:       { bg: "rgba(249,115,22,0.12)",   color: "#fb923c" },
  cancel:          { bg: "rgba(239,68,68,0.12)",    color: "#f87171" },
  cancelled:       { bg: "rgba(239,68,68,0.12)",    color: "#f87171" },
  shipped:                { bg: "rgba(20,184,166,0.12)",   color: "#2dd4bf" },
  delivered:              { bg: "rgba(20,184,166,0.12)",   color: "#2dd4bf" },
  completed:              { bg: "rgba(16,185,129,0.12)",   color: "#34d399" },
  activated:              { bg: "rgba(16,185,129,0.12)",   color: "#34d399" },
  installation_completed: { bg: "rgba(16,185,129,0.12)",   color: "#34d399" },
  processing:             { bg: "rgba(59,130,246,0.12)",   color: "#60a5fa" },
  paid:                   { bg: "rgba(59,130,246,0.12)",   color: "#60a5fa" },
  ready_to_ship:          { bg: "rgba(20,184,166,0.12)",   color: "#2dd4bf" },
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  payment_pending: "Paiement en attente",
  verification: "Vérification",
  hold: "En attente",
  backorder: "Rupture de stock",
  cancel: "Annulé",
  cancelled: "Annulé",
  shipped: "Expédié",
  delivered: "Livré",
  completed: "Terminé",
  activated: "Activé",
  installation_completed: "Installé",
  processing: "En traitement",
  paid: "Payé",
  ready_to_ship: "Prêt à expédier",
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  payment_pending: CreditCard,
  verification: AlertCircle,
  hold: Clock,
  backorder: AlertCircle,
  cancel: XCircle,
  cancelled: XCircle,
  shipped: Truck,
  delivered: Truck,
  completed: CheckCircle,
  activated: CheckCircle,
  installation_completed: CheckCircle,
  processing: Clock,
  paid: CheckCircle,
  ready_to_ship: Package,
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyle[status] || { bg: "rgba(107,107,133,0.12)", color: "#6B6B85" };
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
      {statusLabels[status] || status}
    </span>
  );
};

/* ─── Left accent color per order ──────────────────────────── */
const leftAccent = (order: any, needsPay: boolean) =>
  needsPay ? "#fbbf24" : ["completed","activated","installation_completed"].includes(order.status) ? "#34d399" : "#7C3AED";

const ClientOrders = () => {
  const { user } = useClientAuth();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);
  const orders = canonicalData?.orders || [];
  const lifecycleByOrderId = canonicalData?.orderLifecycle || {};

  // Realtime: refresh when an order updates
  usePortalRealtime(["orders"], [["canonical-client-data", user?.id]]);

  // Check if order is equipment type
  const isEquipmentOrder = (order: any) => {
    return order.order_type === "equipment" || order.order_type === "equipment_accessories";
  };

  // Check if equipment order needs payment
  const needsPayment = (order: any) => {
    if (!isEquipmentOrder(order)) return false;
    const canonicalTotal = Number(order.pricing_snapshot?.grand_total ?? order.total_amount) || 0;
    const balanceDue = canonicalTotal - (Number(order.amount_paid) || 0);
    return balanceDue > 0 &&
      (order.status === "payment_pending" || order.status === "pending") &&
      order.payment_status !== "captured" &&
      order.payment_status !== "paid";
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  return (
    <ClientLayout>
      <div className="space-y-6" style={{ color: D.text }}>

        {/* Page header */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0A0A0F 0%,#1A0A2E 60%,#0D0D1F 100%)", border: `1px solid ${D.border}`, padding: "24px 28px" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 300, height: 300, top: -80, right: -60, background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: D.text }}>Mes commandes</h1>
            <p className="mt-1" style={{ color: D.textSec }}>
              Suivez les commandes expédiées à domicile. Le traitement des nouvelles commandes peut prendre quelques jours.
            </p>
          </div>
        </div>

        {/* Order list */}
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#1A1A2E" }} />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <>
              {orders.map((order: any) => {
                const StatusIcon = statusIcons[order.status] || Clock;
                const isEquip = isEquipmentOrder(order);
                const showPaymentBadge = needsPayment(order);
                const accentColor = leftAccent(order, showPaymentBadge);
                return (
                  <div
                    key={order.id}
                    style={{ borderBottom: `1px solid ${D.borderLt}`, borderLeft: `4px solid ${accentColor}` }}
                  >
                    <div className="px-6 py-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-semibold" style={{ color: D.text }}>{order.service_type}</h3>
                            {isEquip && (
                              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(124,58,237,0.12)", color: D.accentLt, border: "1px solid rgba(124,58,237,0.3)" }}>
                                Équipement
                              </span>
                            )}
                            <StatusBadge status={order.status} />
                            {showPaymentBadge && (
                              <span className="text-xs px-2.5 py-1 rounded-full font-bold animate-pulse flex items-center gap-1" style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.4)" }}>
                                <CreditCard className="w-3 h-3" />
                                Paiement requis
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-mono mb-3" style={{ color: D.textMuted }}>
                            {order.order_number || `#${order.id.slice(0, 8)}`}
                          </p>
                          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                            <div>
                              <span style={{ color: D.textMuted }}>Date: </span>
                              <span style={{ color: D.text }}>
                                {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                              </span>
                            </div>
                            {(order.pricing_snapshot?.grand_total || order.total_amount) && (
                              <div>
                                <span style={{ color: D.textMuted }}>Montant: </span>
                                <span className="font-medium" style={{ color: D.text }}>
                                  {Number(order.pricing_snapshot?.grand_total ?? order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </span>
                              </div>
                            )}
                            {/* Phase 3 — tracking number masqué pour installation pro */}
                            {order.tracking_number && !isProInstall(order) && (
                              <div className="flex items-center gap-1">
                                <span style={{ color: D.textMuted }}>Suivi: </span>
                                <span className="font-mono text-sm" style={{ color: "#2dd4bf" }}>
                                  {order.tracking_number}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 ml-1"
                                    onClick={() => copyToClipboard(order.tracking_number, "Numéro de suivi")}
                                    style={{ color: D.textMuted }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Phase 3 — Lifecycle Timeline */}
                          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                            {lifecycleByOrderId[order.id] ? (
                              <OrderLifecycleTimeline
                                data={lifecycleByOrderId[order.id]}
                                variant="client"
                                installationTypeOverride={order.installation_type}
                              />
                            ) : (
                              <OrderStatusTimeline currentStatus={order.status} />
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                          className="shrink-0"
                          style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="px-6 py-8" style={{ borderLeft: "4px solid #7C3AED" }}>
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 mt-0.5" style={{ color: D.accentLt }} />
                <div>
                  <p className="font-semibold" style={{ color: D.text }}>Aucune commande active</p>
                  <p className="text-sm mt-1" style={{ color: D.textSec }}>
                    Suivez les commandes expédiées à domicile. Le traitement des nouvelles commandes peut prendre quelques jours.
                  </p>
                </div>
              </div>
              <Link to="/portal" className="text-sm font-medium inline-flex items-center gap-1 mt-3 ml-8 transition-colors hover:opacity-80" style={{ color: D.accentLt }}>
                Retour à l'aperçu du compte <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent
          className={selectedOrder && isEquipmentOrder(selectedOrder) ? "max-w-2xl" : "max-w-lg"}
          style={{ background: "#111122", border: "1px solid rgba(124,58,237,0.25)", color: "#FFFFFF" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#FFFFFF" }}>
              {selectedOrder && isEquipmentOrder(selectedOrder)
                ? "Commande Équipement"
                : "Détails de la commande"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && isEquipmentOrder(selectedOrder) ? (
            <ClientEquipmentOrderDetails
              order={selectedOrder}
              onClose={() => setDetailsOpen(false)}
            />
          ) : selectedOrder && (
            <div className="space-y-4 mt-4">
              {[
                { label: "Commande", value: selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8)}`, mono: true },
                { label: "Service",  value: selectedOrder.service_type, bold: true },
              ].map(({ label, value, mono, bold }) => (
                <div key={label} className="flex items-center justify-between">
                  <span style={{ color: D.textSec }}>{label}</span>
                  <span className={`${mono ? "font-mono" : ""} ${bold ? "font-medium" : ""}`} style={{ color: D.text }}>{value}</span>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <span style={{ color: D.textSec }}>Statut</span>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: D.textSec }}>Date</span>
                <span style={{ color: D.text }}>
                  {format(new Date(selectedOrder.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              {(selectedOrder.pricing_snapshot?.grand_total || selectedOrder.total_amount) && (
                <div className="flex items-center justify-between">
                  <span style={{ color: D.textSec }}>Montant</span>
                  <span className="font-bold" style={{ color: D.text }}>
                    {Number(selectedOrder.pricing_snapshot?.grand_total ?? selectedOrder.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              )}

              {/* Payment Status */}
              {selectedOrder.payment_status && (
                <div className="flex items-center justify-between">
                  <span style={{ color: D.textSec }}>Paiement</span>
                  <StatusBadge status={
                    (selectedOrder.payment_status === "paid" || selectedOrder.payment_status === "captured") ? "paid"
                    : selectedOrder.payment_status === "pending" ? "pending"
                    : selectedOrder.payment_status
                  } />
                </div>
              )}

              {/* Quick Links */}
              <div className="pt-4 space-y-2" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                <Link to="/portal/invoices" onClick={() => setDetailsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start"
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <FileText className="w-4 h-4 mr-2" style={{ color: "#60a5fa" }} />
                    Voir mes factures
                  </Button>
                </Link>
                <Link to="/portal/contracts" onClick={() => setDetailsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start"
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <Shield className="w-4 h-4 mr-2" style={{ color: D.accentLt }} />
                    Voir mes contrats
                  </Button>
                </Link>
              </div>

              {/* Port-In Info */}
              {selectedOrder.port_request && (selectedOrder.port_request as any)?.port_in && (
                <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                  <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: D.text }}>
                    <Phone className="w-4 h-4" style={{ color: D.accentLt }} />
                    Transfert de numéro
                  </h4>
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: "rgba(124,58,237,0.08)", border: `1px solid ${D.border}` }}>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: D.textSec }}>Numéro à transférer</span>
                      <span className="font-mono" style={{ color: D.text }}>{(selectedOrder.port_request as any)?.phone_number || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: D.textSec }}>Fournisseur actuel</span>
                      <span style={{ color: D.text }}>{(selectedOrder.port_request as any)?.carrier || "Non spécifié"}</span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold inline-block mt-2" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                      En traitement
                    </span>
                  </div>
                </div>
              )}

              {/* Identity Info */}
              {selectedOrder.identity_snapshot && (
                <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                  <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: D.text }}>
                    <Shield className="w-4 h-4" style={{ color: "#60a5fa" }} />
                    Identité vérifiée
                  </h4>
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: D.textSec }}>Type de pièce</span>
                      <span style={{ color: D.text }}>
                        {(selectedOrder.identity_snapshot as any)?.id_type === "drivers_license" ? "Permis de conduire" :
                         (selectedOrder.identity_snapshot as any)?.id_type === "passport" ? "Passeport" :
                         (selectedOrder.identity_snapshot as any)?.id_type === "health_card" ? "Carte assurance maladie" :
                         (selectedOrder.identity_snapshot as any)?.id_type || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: D.textSec }}>Numéro</span>
                      <span className="font-mono" style={{ color: D.text }}>
                        {(selectedOrder.identity_snapshot as any)?.id_number
                          ? `••••${(selectedOrder.identity_snapshot as any).id_number.slice(-4)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Device Info */}
              {(selectedOrder.sim_number || selectedOrder.imei_number || selectedOrder.serial_number) && (
                <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                  <h4 className="font-medium mb-3" style={{ color: D.text }}>Informations appareil</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Numéro SIM", value: selectedOrder.sim_number },
                      { label: "IMEI", value: selectedOrder.imei_number },
                      { label: "Numéro de série", value: selectedOrder.serial_number },
                    ].filter(r => r.value).map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span style={{ color: D.textSec }}>{label}</span>
                        <span className="font-mono" style={{ color: D.text }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 3 — Tracking */}
              {selectedOrder.tracking_number && !isProInstall(selectedOrder) && (
                <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                  <h4 className="font-medium mb-3" style={{ color: D.text }}>Suivi d'expédition</h4>
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)" }}>
                    <div>
                      <p className="text-sm" style={{ color: D.textSec }}>Numéro de suivi</p>
                      <p className="font-mono" style={{ color: "#2dd4bf" }}>{selectedOrder.tracking_number}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedOrder.tracking_number, "Numéro de suivi")}
                      style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Livraison & activation */}
              <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                <OrderShippingActivationPanel
                  order={selectedOrder}
                  variant="client"
                  hideShipping={isProInstall(selectedOrder)}
                />
              </div>

              {selectedOrder.notes && (
                <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                  <h4 className="font-medium mb-2" style={{ color: D.text }}>Notes</h4>
                  <p className="text-sm" style={{ color: D.textSec }}>{selectedOrder.notes}</p>
                </div>
              )}

              {/* Contract Summary Button */}
              <div className="pt-4" style={{ borderTop: `1px solid ${D.borderLt}` }}>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setDetailsOpen(false); setSummaryOpen(true); }}
                  style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Voir Résumé du contrat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Summary Dialog */}
      {selectedOrder && (
        <ContractSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          orderId={selectedOrder.id}
          usePortalClient
        />
      )}
    </ClientLayout>
  );
};

export default ClientOrders;
