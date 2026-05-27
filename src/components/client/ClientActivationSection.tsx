import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wifi,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  Send,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useClientAuth } from "@/hooks/useClientAuth";

const STATUS_STEPS = [
  { key: "pending", label: "Demande reçue", icon: Send },
  { key: "in_progress", label: "En traitement", icon: Clock },
  { key: "activating", label: "Activation en cours", icon: Loader2 },
  { key: "activated", label: "Service activé", icon: Zap },
] as const;

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  activating: 2,
  activated: 3,
  client_confirming: 3,
  completed: 3,
  technician_required: 1,
  rejected: -1,
  cancelled: -1,
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "🔵 Demande reçue", className: "bg-blue-100 text-blue-800 border-blue-300" },
  in_progress: { label: "🟡 En traitement", className: "bg-amber-100 text-amber-800 border-amber-300" },
  activating: { label: "🟣 Activation en cours", className: "bg-purple-100 text-purple-800 border-purple-300" },
  activated: { label: "✅ Service activé", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  client_confirming: { label: "🟠 Confirmez svp", className: "bg-orange-100 text-orange-800 border-orange-300" },
  completed: { label: "✅ Complété", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  technician_required: { label: "🔧 Technicien requis", className: "bg-red-100 text-red-800 border-red-300" },
  rejected: { label: "❌ Rejeté", className: "bg-red-100 text-red-800 border-red-300" },
  cancelled: { label: "⬜ Annulé", className: "bg-slate-100 text-slate-700 border-slate-300" },
};

const ELIGIBLE_ORDER_STATUSES = ["confirmed", "processing", "shipped", "pending"] as const;
const LIGHT_COLOR_OPTIONS = [
  "Blanc fixe",
  "Orange fixe",
  "Orange clignotant",
  "Blanc clignotant",
  "Aucune lumière",
] as const;
const LIGHT_OK = "Blanc fixe";

const formSchema = z.object({
  wifi_network_name: z.string().trim().min(1, "Nom requis").max(32, "32 caractères max"),
  wifi_password: z.string().min(8, "Min. 8 caractères").max(63, "Max 63 caractères"),
  wifi_password_confirm: z.string(),
  contact_phone: z.string().trim().min(10, "Numéro invalide").max(20),
  client_notes: z.string().max(500).optional(),
}).refine((d) => d.wifi_password === d.wifi_password_confirm, {
  message: "Les mots de passe ne correspondent pas",
  path: ["wifi_password_confirm"],
});

interface ClientActivationSectionProps {
  clientId: string;
  compact?: boolean;
}

export default function ClientActivationSection({ clientId, compact = false }: ClientActivationSectionProps) {
  const queryClient = useQueryClient();
  const { isLoading: authLoading } = useClientAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState<"yes" | "no" | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [checks, setChecks] = useState({
    coaxial: false,
    power: false,
    hasTerminal: false,
    hdmi: false,
    terminalPower: false,
  });
  const [lightColor, setLightColor] = useState<string>("");
  const [form, setForm] = useState({
    wifi_network_name: "",
    wifi_password: "",
    wifi_password_confirm: "",
    contact_phone: "",
    client_notes: "",
  });

  const { data: canonical, isLoading } = useCanonicalClientData(clientId);

  const latestRequest = ((canonical?.activationRequests || []) as any[])
    .slice()
    .sort((a, b) => String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")))[0] || null;

  // Eligible orders for activation — Internet/TV/Bundle/Combo only.
  const ELIGIBLE_KEYWORDS = ["internet", "tv", "bundle", "combo"] as const;
  const EXCLUDED_ONLY_KEYWORDS = ["mobile", "sim", "stream", "equip", "accessoire"] as const;
  const matchesEligible = (s: string) =>
    ELIGIBLE_KEYWORDS.some((k) => s.includes(k));
  const matchesExcluded = (s: string) =>
    EXCLUDED_ONLY_KEYWORDS.some((k) => s.includes(k));

  const eligibleOrders = (() => {
    const allOrders = ((canonical?.orders || []) as any[]).filter((o) =>
      (ELIGIBLE_ORDER_STATUSES as unknown as string[]).includes(o.status)
    );
    if (allOrders.length === 0) return [];

    const items = (canonical?.orderItems || []) as any[];
    const itemsByOrder = new Map<string, any[]>();
    items.forEach((it) => {
      const arr = itemsByOrder.get(it.order_id) || [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    });

    const filtered = allOrders.filter((o: any) => {
      const lineStrings = (itemsByOrder.get(o.id) || []).map((it: any) =>
        [it.service_type, it.plan_name, it.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      );
      const orderString = [o.service_type, o.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const haystack = lineStrings.length > 0 ? lineStrings : [orderString];
      const hasEligible = haystack.some((s) => matchesEligible(s));
      const allExcluded =
        haystack.length > 0 && haystack.every((s) => matchesExcluded(s) && !matchesEligible(s));
      return hasEligible && !allExcluded;
    });

    const activeReqs = ((canonical?.activationRequests || []) as any[]).filter(
      (r) => !["rejected", "cancelled", "completed"].includes(String(r.status))
    );
    const blocked = new Set(activeReqs.map((r: any) => r.order_id));

    return filtered
      .filter((o: any) => !blocked.has(o.id))
      .map((o: any) => {
        const firstItem = (itemsByOrder.get(o.id) || [])[0];
        const display_label =
          firstItem?.plan_name ||
          firstItem?.description ||
          o.category ||
          o.service_type ||
          "Service";
        return { ...o, display_label };
      });
  })();


  useEffect(() => {
    if (!clientId || authLoading) return;
    const channel = portalSupabase
      .channel(`activation-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activation_requests",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["canonical-client-data", clientId] });
          queryClient.invalidateQueries({ queryKey: ["canonical-client-data", clientId] });
        },
      )
      .subscribe();

    return () => {
      portalSupabase.removeChannel(channel);
    };
  }, [authLoading, clientId, queryClient]);

  const validateChecklist = (): string | null => {
    // Order selection is OPTIONAL — clients can submit without an associated order.
    // Pre-flight checklist is also optional; we only flag inconsistent terminal state.
    if (checks.hasTerminal && (!checks.hdmi || !checks.terminalPower)) {
      return "Veuillez confirmer le branchement du Terminal TV ou décocher l'option.";
    }
    return null;
  };

  const lightOk = lightColor === LIGHT_OK;
  // Submit is always enabled (apart from in-flight submission). Order is optional.
  const canSubmit = true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checklistErr = validateChecklist();
    if (checklistErr) {
      toast.error(checklistErr);
      return;
    }
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Formulaire invalide");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await portalSupabase.auth.getSession();

      if (!session?.user) {
        throw new Error("Session portail introuvable. Rechargez la page puis réessayez.");
      }

      const resolvedLightColor = lightColor
        ? (lightColor === LIGHT_OK ? "blanc_fixe" : lightColor)
        : null;
      const terminalConnected = checks.hasTerminal ? checks.hdmi && checks.terminalPower : null;

      const { data, error } = await portalSupabase.rpc("submit_activation_request", {
        p_wifi_network_name: parsed.data.wifi_network_name,
        p_wifi_password: parsed.data.wifi_password,
        p_contact_phone: parsed.data.contact_phone,
        p_client_notes: parsed.data.client_notes || null,
        p_order_id: selectedOrderId ?? null,
        p_light_color: resolvedLightColor,
        p_has_terminal: checks.hasTerminal,
        p_terminal_connected: terminalConnected,
      } as any);
      if (error) throw error;

      portalSupabase.functions.invoke("notify-activation-request", {
        body: { activation_request_id: data },
      }).catch((err) => console.warn("[notify-activation] failed:", err));

      toast.success("Votre demande d'activation a été envoyée. Notre équipe vous contactera sous 24-48h.");
      setSuccessMessage("Votre demande d'activation a été envoyée. Notre équipe vous contactera sous 24-48h.");
      setForm({
        wifi_network_name: "",
        wifi_password: "",
        wifi_password_confirm: "",
        contact_phone: "",
        client_notes: "",
      });
      setChecks({
        coaxial: false,
        power: false,
        hasTerminal: false,
        hdmi: false,
        terminalPower: false,
      });
      setLightColor("");
      setSelectedOrderId(null);
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", clientId] });
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", clientId] });
    } catch (err: any) {
      console.error("[submit_activation_request]", err);
      toast.error(err?.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientConfirmation = async (works: boolean) => {
    if (!latestRequest) return;
    setConfirming(works ? "yes" : "no");
    try {
      const { error } = await portalSupabase
        .from("activation_requests")
        .update({
          status: works ? "completed" : "in_progress",
          completed_at: works ? new Date().toISOString() : null,
          client_notes: works
            ? `${latestRequest.client_notes || ""}\n[Client a confirmé que tout fonctionne]`
            : `${latestRequest.client_notes || ""}\n[Client signale un problème — attention requise]`,
        })
        .eq("id", latestRequest.id);
      if (error) throw error;
      toast.success(works ? "Merci! Demande fermée." : "Notre équipe a été alertée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setConfirming(null);
    }
  };

  const currentStatus = latestRequest?.status || "pending";
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const isTerminal = ["completed", "rejected", "cancelled"].includes(currentStatus);
  const showForm = !latestRequest || isTerminal;
  const awaitingConfirmation = currentStatus === "activated" || currentStatus === "client_confirming";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <Wifi className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className={`${compact ? "text-2xl" : "text-3xl"} font-bold text-slate-900`}>Activation des services</h2>
          <p className="text-slate-500 mt-1">Demandez l'activation de votre service WiFi en quelques clics</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      )}

      {successMessage && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 text-sm font-medium text-emerald-900">
            {successMessage}
          </CardContent>
        </Card>
      )}

      {latestRequest && !isTerminal && (
        <Card className="border-blue-200">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Statut de votre activation</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Réseau: <span className="font-mono font-semibold">{latestRequest.wifi_network_name}</span>
                </p>
              </div>
              <Badge variant="outline" className={STATUS_BADGES[currentStatus]?.className}>
                {STATUS_BADGES[currentStatus]?.label || currentStatus}
              </Badge>
            </div>

            <div className="relative">
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200" />
              <div
                className="absolute top-5 left-5 h-0.5 bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, currentRank) * 33.33}%` }}
              />
              <div className="relative grid grid-cols-4 gap-2">
                {STATUS_STEPS.map((step, i) => {
                  const done = i < currentRank;
                  const active = i === currentRank;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex flex-col items-center text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : active
                              ? "bg-white border-blue-500 text-blue-600 shadow-md"
                              : "bg-white border-slate-300 text-slate-400"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : active && step.key === "activating" ? (
                          <Icon className="w-4 h-4 animate-spin" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <span className={`text-xs mt-2 ${done || active ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              ⏱ Délai estimé: 10 à 30 minutes après soumission
            </div>

            {currentStatus === "technician_required" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Une visite de technicien est requise. Notre équipe vous contactera au {latestRequest.contact_phone}.</span>
              </div>
            )}

            {awaitingConfirmation && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-900">✅ Votre service a été activé! Confirmez-vous que tout fonctionne?</p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handleClientConfirmation(true)}
                    disabled={confirming !== null}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {confirming === "yes" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : "✅ "}
                    Oui, tout fonctionne!
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleClientConfirmation(false)} disabled={confirming !== null}>
                    {confirming === "no" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : "❌ "}
                    Non, j'ai un problème
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {latestRequest && isTerminal && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className={STATUS_BADGES[currentStatus]?.className}>
                {STATUS_BADGES[currentStatus]?.label}
              </Badge>
              <span className="text-sm text-slate-500">Dernière demande: {latestRequest.wifi_network_name}</span>
            </div>
            {currentStatus === "rejected" && latestRequest.rejection_reason && (
              <p className="text-sm text-slate-700">Raison: {latestRequest.rejection_reason}</p>
            )}
            <p className="text-sm text-slate-500 mt-2">Vous pouvez soumettre une nouvelle demande ci-dessous.</p>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Order selection — OPTIONAL */}
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4" /> Associer cette demande à une commande (optionnel)
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Vous pouvez soumettre votre demande sans sélectionner de commande.
                </p>
                <div className="mt-3 space-y-2">
                  {eligibleOrders.map((order: any) => {
                    const active = selectedOrderId === order.id;
                    return (
                      <button
                        type="button"
                        key={order.id}
                        onClick={() => setSelectedOrderId(active ? null : order.id)}
                        className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-colors ${
                          active
                            ? "border-2 border-violet-500 bg-violet-50"
                            : "border border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <Package className={`w-5 h-5 ${active ? "text-violet-600" : "text-slate-400"}`} />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 text-sm">
                            Commande #{order.order_number}
                          </div>
                          <div className="text-xs text-slate-500">
                            {order.display_label || order.category || order.service_type || "Service"} · Passée le{" "}
                            {new Date(order.created_at).toLocaleDateString("fr-CA")}
                          </div>
                        </div>
                        {active && <CheckCircle2 className="w-5 h-5 text-violet-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-3 border-b">
                <Wifi className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Activation WiFi</h3>
              </div>

              <div>
                <Label htmlFor="ssid">Nom du réseau WiFi désiré *</Label>
                <Input
                  id="ssid"
                  value={form.wifi_network_name}
                  onChange={(e) => setForm({ ...form, wifi_network_name: e.target.value })}
                  maxLength={32}
                  placeholder="Ex: Maison-Jutras"
                  className="mt-1.5"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">{form.wifi_network_name.length}/32</p>
              </div>

              <div>
                <Label htmlFor="pwd">Mot de passe WiFi *</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="pwd"
                    type={showPassword ? "text" : "password"}
                    value={form.wifi_password}
                    onChange={(e) => setForm({ ...form, wifi_password: e.target.value })}
                    minLength={8}
                    maxLength={63}
                    placeholder="Min. 8 caractères"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="pwd2">Confirmer le mot de passe *</Label>
                <Input
                  id="pwd2"
                  type={showPassword ? "text" : "password"}
                  value={form.wifi_password_confirm}
                  onChange={(e) => setForm({ ...form, wifi_password_confirm: e.target.value })}
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Numéro de téléphone de contact *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="819-555-1234"
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes / Instructions spéciales</Label>
                <Textarea
                  id="notes"
                  value={form.client_notes}
                  onChange={(e) => setForm({ ...form, client_notes: e.target.value })}
                  placeholder="Optionnel"
                  rows={3}
                  maxLength={500}
                  className="mt-1.5"
                />
              </div>

              {/* ─── Pre-activation checklist ─── */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <div className="text-sm font-bold text-slate-900 mb-1">
                  ✅ Vérification avant activation
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  Veuillez confirmer que votre équipement est correctement installé avant de soumettre votre demande.
                </p>

                {/* Borne Nivra WiFi */}
                <div className="mb-4">
                  <div className="text-sm font-bold text-violet-700 mb-3">📡 Borne Nivra WiFi</div>

                  <label className="flex items-start gap-3 mb-3 cursor-pointer">
                    <Checkbox
                      checked={checks.coaxial}
                      onCheckedChange={(v) => setChecks({ ...checks, coaxial: v === true })}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">
                      Le câble coaxial est bien vissé à la borne ET à la prise murale *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 mb-3 cursor-pointer">
                    <Checkbox
                      checked={checks.power}
                      onCheckedChange={(v) => setChecks({ ...checks, power: v === true })}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">
                      Le bloc d'alimentation est branché à la borne ET dans la prise de courant murale *
                    </span>
                  </label>

                  <div className="mb-2">
                    <p className="text-sm font-semibold text-slate-800 mb-2">
                      Quelle est la couleur du voyant lumineux de votre borne? *
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LIGHT_COLOR_OPTIONS.map((color) => {
                        const active = lightColor === color;
                        const isOk = color === LIGHT_OK;
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setLightColor(color)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                              active
                                ? isOk
                                  ? "border-2 border-emerald-500 bg-emerald-100 text-emerald-800 font-bold"
                                  : "border-2 border-amber-500 bg-amber-100 text-amber-900 font-bold"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {color} {isOk ? "✅" : ""}
                          </button>
                        );
                      })}
                    </div>

                    {lightColor && lightColor !== LIGHT_OK && (
                      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900 space-y-2">
                        <p className="font-bold">⚠️ Votre borne n'est pas prête.</p>
                        <p>La lumière doit être blanche fixe avant de pouvoir activer votre service.</p>
                        <div>
                          <p className="font-semibold mt-1">Que faire :</p>
                          <ul className="list-disc list-inside space-y-0.5 mt-1">
                            <li>Assurez-vous que le câble coaxial est bien vissé</li>
                            <li>Assurez-vous que le bloc d'alimentation est bien branché</li>
                            <li>Attendez 5 à 20 minutes — le démarrage peut prendre du temps</li>
                          </ul>
                        </div>
                        <p>
                          Si la lumière reste <strong>{lightColor.toLowerCase()}</strong> après 20 minutes,
                          contactez-nous :{" "}
                          <a href="mailto:support@nivra-telecom.ca" className="underline font-medium">
                            support@nivra-telecom.ca
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Terminal Nivra TV */}
                <div className="border-t border-violet-100 pt-4">
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <Checkbox
                      checked={checks.hasTerminal}
                      onCheckedChange={(v) => setChecks({ ...checks, hasTerminal: v === true })}
                    />
                    <span className="text-sm font-bold text-slate-800">
                      📺 J'ai aussi un Terminal Nivra TV à installer (optionnel)
                    </span>
                  </label>

                  {checks.hasTerminal && (
                    <div className="ml-7">
                      <label className="flex items-start gap-3 mb-3 cursor-pointer">
                        <Checkbox
                          checked={checks.hdmi}
                          onCheckedChange={(v) => setChecks({ ...checks, hdmi: v === true })}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-slate-700">
                          Le câble HDMI est bien branché au terminal ET au téléviseur
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={checks.terminalPower}
                          onCheckedChange={(v) => setChecks({ ...checks, terminalPower: v === true })}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-slate-700">
                          Le bloc d'alimentation du terminal est branché au terminal ET dans la prise murale
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Soumission…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Soumettre la demande d'activation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
