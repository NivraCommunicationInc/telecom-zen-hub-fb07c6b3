import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  const [form, setForm] = useState({
    wifi_network_name: "",
    wifi_password: "",
    wifi_password_confirm: "",
    contact_phone: "",
    client_notes: "",
  });

  const { data: latestRequest, isLoading } = useQuery({
    queryKey: ["client-activation-request", clientId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("activation_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !authLoading,
  });

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
          queryClient.invalidateQueries({ queryKey: ["client-activation-request", clientId] });
        },
      )
      .subscribe();

    return () => {
      portalSupabase.removeChannel(channel);
    };
  }, [authLoading, clientId, queryClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const { data, error } = await portalSupabase.rpc("submit_activation_request", {
        p_wifi_network_name: parsed.data.wifi_network_name,
        p_wifi_password: parsed.data.wifi_password,
        p_contact_phone: parsed.data.contact_phone,
        p_client_notes: parsed.data.client_notes || null,
        p_order_id: null,
      });
      if (error) throw error;

      portalSupabase.functions.invoke("notify-activation-request", {
        body: { activation_request_id: data },
      }).catch((err) => console.warn("[notify-activation] failed:", err));

      toast.success("Demande soumise! Notre équipe va l'activer sous peu.");
      setSuccessMessage("✅ Demande envoyée! Notre équipe traite maintenant votre activation WiFi.");
      setForm({
        wifi_network_name: "",
        wifi_password: "",
        wifi_password_confirm: "",
        contact_phone: "",
        client_notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["client-activation-request", clientId] });
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-3 border-b">
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

              <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
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