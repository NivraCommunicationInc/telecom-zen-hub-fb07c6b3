/**
 * CoreActivationRequestsPage — /core/wifi-requests
 * Manages WiFi activation requests submitted by clients via /portal/activation.
 * Admins can change status, view decrypted WiFi password, add notes,
 * and trigger client confirmation flow.
 */
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Zap, Search, Eye, EyeOff, Phone, Mail, User, Wifi, Clock,
  CheckCircle2, AlertTriangle, X, Loader2, RefreshCw, Send,
  Wrench, XCircle, History, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "pending", label: "Nouvelle demande", color: "bg-blue-500/20 text-blue-700 border-blue-300" },
  { value: "in_progress", label: "En traitement", color: "bg-amber-500/20 text-amber-700 border-amber-300" },
  { value: "activating", label: "Activation en cours", color: "bg-purple-500/20 text-purple-700 border-purple-300" },
  { value: "activated", label: "Service activé", color: "bg-emerald-500/20 text-emerald-700 border-emerald-300" },
  { value: "client_confirming", label: "Attente confirmation client", color: "bg-orange-500/20 text-orange-700 border-orange-300" },
  { value: "completed", label: "Complété", color: "bg-emerald-600/30 text-emerald-800 border-emerald-400" },
  { value: "technician_required", label: "Technicien requis", color: "bg-red-500/20 text-red-700 border-red-300" },
  { value: "rejected", label: "Rejeté", color: "bg-red-600/30 text-red-800 border-red-400" },
  { value: "cancelled", label: "Annulé", color: "bg-slate-500/20 text-slate-700 border-slate-300" },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

interface ActivationRequest {
  id: string;
  client_id: string;
  order_id: string | null;
  wifi_network_name: string;
  wifi_password_encrypted: string;
  contact_phone: string;
  client_notes: string | null;
  status: string;
  assigned_to: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  started_at: string | null;
  activated_at: string | null;
  completed_at: string | null;
  business_notified: boolean;
  // Joined client info
  client?: {
    full_name: string | null;
    email: string | null;
    client_number: string | null;
  };
}

export default function CoreActivationRequestsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ActivationRequest | null>(null);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["core-activation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activation_requests")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;

      // Fetch clients separately
      const clientIds = [...new Set((data || []).map((r: any) => r.client_id))];
      const { data: clients } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .in("user_id", clientIds);
      const clientMap = new Map((clients || []).map((c: any) => [c.user_id, c]));

      return (data || []).map((r: any) => ({
        ...r,
        client: clientMap.get(r.client_id) || null,
      })) as ActivationRequest[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("core-activations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activation_requests" },
        () => queryClient.invalidateQueries({ queryKey: ["core-activation-requests"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.wifi_network_name?.toLowerCase().includes(s) ||
          r.client?.full_name?.toLowerCase().includes(s) ||
          r.client?.email?.toLowerCase().includes(s) ||
          r.client?.client_number?.toLowerCase().includes(s) ||
          r.contact_phone?.includes(s)
        );
      }
      return true;
    });
  }, [requests, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    requests.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [requests]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-500" />
            Demandes WiFi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demandes d'activation WiFi soumises par les clients
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
        </Button>
      </div>

      {/* Counts row */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-700 border border-blue-200">
          {counts.pending || 0} en attente
        </span>
        <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-700 border border-amber-200">
          {counts.in_progress || 0} en traitement
        </span>
        <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-700 border border-purple-200">
          {counts.activating || 0} activation en cours
        </span>
        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-200">
          {(counts.completed || 0) + (counts.activated || 0)} complétées
        </span>
        <span className="px-2 py-1 rounded bg-red-500/10 text-red-700 border border-red-200">
          {counts.technician_required || 0} technicien requis
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher: client, réseau, téléphone…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Client</th>
              <th className="text-left px-4 py-3 font-semibold">Réseau WiFi</th>
              <th className="text-left px-4 py-3 font-semibold">Téléphone</th>
              <th className="text-left px-4 py-3 font-semibold">Soumis</th>
              <th className="text-left px-4 py-3 font-semibold">Statut</th>
              <th className="text-right px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Chargement…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Aucune demande d'activation
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = STATUS_MAP[r.status];
              return (
                <tr
                  key={r.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {r.client?.full_name || "Client inconnu"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.client?.client_number ? `#${r.client.client_number}` : r.client?.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">{r.wifi_network_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.contact_phone}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(r.submitted_at), "dd MMM HH:mm", { locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={status?.color}>
                      {status?.label || r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost">Ouvrir</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (
            <ActivationDetail
              request={selected}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ["core-activation-requests"] });
              }}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Detail panel ───────────────────────────────────── */

function ActivationDetail({
  request,
  onChanged,
  onClose,
}: {
  request: ActivationRequest;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPwd, setDecryptedPwd] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [rejectionReason, setRejectionReason] = useState(request.rejection_reason || "");
  const [updating, setUpdating] = useState(false);

  const status = STATUS_MAP[request.status];

  // History timeline
  const { data: history = [] } = useQuery({
    queryKey: ["activation-history", request.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activation_request_history")
        .select("*")
        .eq("activation_request_id", request.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleRevealPassword = async () => {
    if (decryptedPwd) {
      setShowPassword(!showPassword);
      return;
    }
    setDecrypting(true);
    try {
      const { data, error } = await supabase.rpc("decrypt_wifi_password", {
        p_encrypted: request.wifi_password_encrypted,
      });
      if (error) throw error;
      setDecryptedPwd(data || "");
      setShowPassword(true);
    } catch (err: any) {
      toast.error(err?.message || "Impossible de déchiffrer");
    } finally {
      setDecrypting(false);
    }
  };

  const updateStatus = async (newStatus: string, extraFields: Record<string, any> = {}) => {
    setUpdating(true);
    try {
      const updates: Record<string, any> = { status: newStatus, ...extraFields };
      if (newStatus === "in_progress" && !request.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (newStatus === "activated" && !request.activated_at) {
        updates.activated_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("activation_requests")
        .update(updates)
        .eq("id", request.id);
      if (error) throw error;
      toast.success("Statut mis à jour");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("activation_requests")
        .update({ admin_notes: adminNotes, rejection_reason: rejectionReason || null })
        .eq("id", request.id);
      if (error) throw error;
      toast.success("Notes enregistrées");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" />
          Demande d'activation
        </SheetTitle>
      </SheetHeader>

      {/* Status badge + ID */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="outline" className={status?.color}>
          {status?.label || request.status}
        </Badge>
        <code className="text-xs text-muted-foreground">#{request.id.slice(0, 8)}</code>
      </div>

      {/* Client info */}
      <section className="border rounded-lg p-4 bg-muted/30">
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <User className="w-3 h-3" /> Client
        </h3>
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-foreground">
            {request.client?.full_name || "Client inconnu"}
          </div>
          {request.client?.client_number && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Hash className="w-3 h-3" /> Compte #{request.client.client_number}
            </div>
          )}
          {request.client?.email && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mail className="w-3 h-3" /> {request.client.email}
            </div>
          )}
          <div className="flex items-center gap-1 text-foreground font-medium">
            <Phone className="w-3 h-3" /> {request.contact_phone}
            <span className="text-xs text-muted-foreground ml-1">(contact pour activation)</span>
          </div>
        </div>
      </section>

      {/* WiFi config */}
      <section className="border rounded-lg p-4 bg-blue-50/50">
        <h3 className="text-xs font-bold uppercase text-blue-900 mb-2 flex items-center gap-1">
          <Wifi className="w-3 h-3" /> Configuration WiFi demandée
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Nom du réseau:</span>
            <div className="font-mono font-bold text-foreground bg-white rounded px-2 py-1 mt-0.5 border">
              {request.wifi_network_name}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Mot de passe:</span>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="font-mono font-bold text-foreground bg-white rounded px-2 py-1 border flex-1">
                {showPassword && decryptedPwd ? decryptedPwd : "••••••••••••"}
              </code>
              <Button size="sm" variant="outline" onClick={handleRevealPassword} disabled={decrypting}>
                {decrypting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Client notes */}
      {request.client_notes && (
        <section className="border rounded-lg p-4">
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
            Notes du client
          </h3>
          <p className="text-sm whitespace-pre-wrap text-foreground">{request.client_notes}</p>
        </section>
      )}

      {/* Status change */}
      <section className="border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
          Changer le statut
        </h3>
        <Select
          value={request.status}
          onValueChange={(v) => updateStatus(v)}
          disabled={updating}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Quick actions */}
      <section className="border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
          Actions rapides
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => updateStatus("in_progress")} disabled={updating}>
            <Clock className="w-3 h-3 mr-1" /> En traitement
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus("activating")} disabled={updating}>
            <Loader2 className="w-3 h-3 mr-1" /> Activation en cours
          </Button>
          <Button
            size="sm"
            onClick={() => updateStatus("activated")}
            disabled={updating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Service activé
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus("technician_required")} disabled={updating}>
            <Wrench className="w-3 h-3 mr-1" /> Technicien requis
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus("rejected")} disabled={updating} className="text-red-700">
            <X className="w-3 h-3 mr-1" /> Rejeter
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating}>
            <XCircle className="w-3 h-3 mr-1" /> Annuler
          </Button>
        </div>
        <a
          href={`tel:${request.contact_phone}`}
          className="mt-2 flex items-center justify-center gap-2 text-sm text-blue-600 hover:underline border rounded p-2"
        >
          <Phone className="w-4 h-4" /> Appeler le client: {request.contact_phone}
        </a>
      </section>

      {/* Admin notes */}
      <section className="border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
          Notes admin (interne)
        </h3>
        <Textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="Notes internes…"
          className="text-sm"
        />
        {(request.status === "rejected" || rejectionReason) && (
          <>
            <h4 className="text-xs font-bold uppercase text-muted-foreground mt-3 mb-1">
              Raison du rejet (visible par le client)
            </h4>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </>
        )}
        <Button size="sm" onClick={saveNotes} disabled={updating} className="mt-2">
          Enregistrer
        </Button>
      </section>

      {/* History */}
      <section className="border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <History className="w-3 h-3" /> Historique
        </h3>
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun historique</p>
          )}
          {history.map((h: any) => (
            <div key={h.id} className="flex gap-2 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">
                {format(new Date(h.created_at), "dd MMM HH:mm", { locale: fr })}
              </span>
              <span className="text-foreground">
                {h.from_status ? `${h.from_status} → ` : ""}
                <span className="font-semibold">{h.to_status}</span>
                {h.actor_name && <span className="text-muted-foreground"> par {h.actor_name}</span>}
                {h.note && <div className="text-muted-foreground italic">{h.note}</div>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
