/**
 * CoreRmaPage — Nivra Core RMA (Retours d'équipement) management.
 *
 * Full CRUD + lifecycle management for equipment returns:
 * - Stats bar (total/pending/approved/shipped/received/closed)
 * - Search, status & device-type filters
 * - Paginated table (10/page)
 * - Lifecycle actions per status (approve/reject/ship/receive/replace/close)
 * - Create RMA dialog (account picker + device + reason)
 * - Detail drawer (timeline, tracking number, editable notes)
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Search,
  RefreshCw,
  Check,
  X,
  Truck,
  Package,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type RmaStatus =
  | "pending"
  | "approved"
  | "shipped"
  | "received"
  | "replaced"
  | "closed";

type StatusHistoryEntry = {
  status: RmaStatus;
  at: string;
  by?: string | null;
  note?: string | null;
};

type RmaRow = {
  id: string;
  account_id: string | null;
  client_name: string | null;
  device_type: string;
  serial_number: string | null;
  reason: string;
  status: RmaStatus;
  tracking_number: string | null;
  notes: string | null;
  status_history: StatusHistoryEntry[] | null;
  created_at: string;
  updated_at: string;
};

type AccountOption = {
  id: string;
  account_number: string | null;
  account_name: string | null;
};

const STATUS_LABEL: Record<RmaStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  shipped: "Expédié",
  received: "Reçu",
  replaced: "Remplacé",
  closed: "Fermé",
};

const STATUS_STYLE: Record<RmaStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  shipped: "bg-purple-100 text-purple-800 border-purple-300",
  received: "bg-orange-100 text-orange-800 border-orange-300",
  replaced: "bg-green-100 text-green-800 border-green-300",
  closed: "bg-gray-200 text-gray-800 border-gray-300",
};

const DEVICE_TYPES = [
  "Borne Nivra WiFi",
  "Terminal Nivra 4K",
  "SIM Nivra",
  "Décodeur TV",
  "Autre",
];

const PAGE_SIZE = 10;

export default function CoreRmaPage() {
  const qc = useQueryClient();

  // ── filters & pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RmaStatus>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // ── dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ── query
  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["core-rma", statusFilter, deviceFilter, search],
    queryFn: async (): Promise<RmaRow[]> => {
      let q = supabase
        .from("rma_requests" as any)
        .select(
          "id, account_id, client_name, device_type, serial_number, reason, status, tracking_number, notes, status_history, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (deviceFilter !== "all") q = q.eq("device_type", deviceFilter);

      const { data, error } = await q;
      if (error) throw error;

      let filtered = (data as unknown as RmaRow[]) || [];
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.client_name || "").toLowerCase().includes(s) ||
            (r.serial_number || "").toLowerCase().includes(s),
        );
      }
      return filtered;
    },
  });

  // ── stats
  const stats = useMemo(() => {
    const s = {
      total: 0,
      pending: 0,
      approved: 0,
      shipped: 0,
      received: 0,
      closed: 0,
    };
    (rows || []).forEach((r) => {
      s.total += 1;
      if (r.status === "pending") s.pending += 1;
      if (r.status === "approved") s.approved += 1;
      if (r.status === "shipped") s.shipped += 1;
      if (r.status === "received") s.received += 1;
      if (r.status === "closed" || r.status === "replaced") s.closed += 1;
    });
    return s;
  }, [rows]);

  // ── pagination
  const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / PAGE_SIZE));
  const pageRows = (rows || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── detail row (live)
  const detailRow = useMemo(
    () => (rows || []).find((r) => r.id === detailId) || null,
    [rows, detailId],
  );

  return (
    <>
      <Helmet>
        <title>RMA — Retours d'équipement | Nivra Core</title>
      </Helmet>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Retours RMA</h1>
            <p className="text-sm text-muted-foreground">
              Gestion complète des retours et remplacements d'équipement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nouveau RMA
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="En attente" value={stats.pending} tone="yellow" />
          <StatCard label="Approuvés" value={stats.approved} tone="blue" />
          <StatCard label="Expédiés" value={stats.shipped} tone="purple" />
          <StatCard label="Reçus" value={stats.received} tone="orange" />
          <StatCard label="Fermés" value={stats.closed} tone="gray" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher par client ou numéro de série…"
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as any);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(Object.keys(STATUS_LABEL) as RmaStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={deviceFilter}
              onValueChange={(v) => {
                setDeviceFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Type d'appareil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les appareils</SelectItem>
                {DEVICE_TYPES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {rows?.length ?? 0} demande{(rows?.length ?? 0) > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                Aucune demande de retour pour ces filtres.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Appareil / Série</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(r.id)}
                    >
                      <TableCell className="font-medium">
                        {r.client_name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.device_type}</div>
                        {r.serial_number && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {r.serial_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm">
                        {(r.reason || "").length > 50
                          ? `${r.reason.slice(0, 50)}…`
                          : r.reason}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLE[r.status]}
                        >
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy", {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions row={r} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Page {page} / {totalPages}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <CreateRmaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["core-rma"] });
          setCreateOpen(false);
        }}
      />

      <RmaDetailDrawer
        row={detailRow}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}

/* ─────────────────────────────  Stat card  ───────────────────────────── */

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "yellow" | "blue" | "purple" | "orange" | "green" | "gray";
}) {
  const toneClass =
    tone === "yellow"
      ? "text-yellow-700"
      : tone === "blue"
        ? "text-blue-700"
        : tone === "purple"
          ? "text-purple-700"
          : tone === "orange"
            ? "text-orange-700"
            : tone === "green"
              ? "text-green-700"
              : tone === "gray"
                ? "text-gray-700"
                : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────  Row actions  ─────────────────────────── */

function RowActions({ row }: { row: RmaRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [tracking, setTracking] = useState(row.tracking_number || "");

  const transition = async (next: RmaStatus, extra: Partial<RmaRow> = {}) => {
    setBusy(true);
    try {
      const history = Array.isArray(row.status_history)
        ? [...row.status_history]
        : [];
      history.push({
        status: next,
        at: new Date().toISOString(),
        by: null,
      });
      const { error } = await supabase
        .from("rma_requests" as any)
        .update({
          status: next,
          status_history: history,
          ...extra,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABEL[next]}`);
      qc.invalidateQueries({ queryKey: ["core-rma"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusy(false);
      setTrackingOpen(false);
    }
  };

  if (row.status === "pending") {
    return (
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => transition("approved")}
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Approuver
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => transition("closed")}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Refuser
        </Button>
      </div>
    );
  }

  if (row.status === "approved") {
    return (
      <>
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => setTrackingOpen(true)}
        >
          <Truck className="w-3.5 h-3.5 mr-1" />
          Marquer expédié
        </Button>
        <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Numéro de suivi</DialogTitle>
              <DialogDescription>
                Saisissez le numéro de tracking du transporteur.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="ex: 1Z999AA10123456784"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTrackingOpen(false)}
              >
                Annuler
              </Button>
              <Button
                disabled={busy || !tracking.trim()}
                onClick={() =>
                  transition("shipped", { tracking_number: tracking.trim() })
                }
              >
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (row.status === "shipped") {
    return (
      <Button
        size="sm"
        variant="default"
        disabled={busy}
        onClick={() => transition("received")}
      >
        <Package className="w-3.5 h-3.5 mr-1" />
        Marquer reçu
      </Button>
    );
  }

  if (row.status === "received") {
    return (
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => transition("replaced")}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Remplacer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => transition("closed")}
        >
          Fermer
        </Button>
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

/* ────────────────────────  Create dialog  ─────────────────────────── */

function CreateRmaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [accountSearch, setAccountSearch] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [deviceType, setDeviceType] = useState<string>("Borne Nivra WiFi");
  const [serial, setSerial] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data: accounts } = useQuery({
    queryKey: ["core-rma-accounts", accountSearch],
    enabled: open,
    queryFn: async (): Promise<AccountOption[]> => {
      let q = supabase
        .from("accounts")
        .select("id, account_number, account_name")
        .order("created_at", { ascending: false })
        .limit(20);
      if (accountSearch.trim()) {
        const s = `%${accountSearch.trim()}%`;
        q = q.or(`account_number.ilike.${s},account_name.ilike.${s}`);
      }
      const { data } = await q;
      return (data as AccountOption[]) || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        account_id: accountId,
        client_name:
          clientName.trim() ||
          accounts?.find((a) => a.id === accountId)?.account_name ||
          null,
        device_type: deviceType,
        serial_number: serial.trim() || null,
        reason: reason.trim(),
        notes: notes.trim() || null,
        status: "pending",
        status_history: [
          { status: "pending", at: new Date().toISOString(), by: null },
        ],
      };
      const { error } = await supabase
        .from("rma_requests" as any)
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande RMA créée");
      setAccountSearch("");
      setAccountId(null);
      setClientName("");
      setDeviceType("Borne Nivra WiFi");
      setSerial("");
      setReason("");
      setNotes("");
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle demande RMA</DialogTitle>
          <DialogDescription>
            Créer une demande de retour ou remplacement d'équipement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Rechercher compte (n° ou nom)</Label>
            <Input
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="ex: 100234 ou Jean Tremblay"
            />
            {accounts && accounts.length > 0 && (
              <div className="mt-1 max-h-32 overflow-auto border border-border rounded">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAccountId(a.id);
                      setClientName(a.account_name || "");
                    }}
                    className={`w-full text-left text-xs px-2 py-1.5 hover:bg-muted ${
                      accountId === a.id ? "bg-muted font-semibold" : ""
                    }`}
                  >
                    {a.account_number ? `#${a.account_number}` : "—"} ·{" "}
                    {a.account_name || "Sans nom"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Nom du client</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom complet"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type d'appareil</Label>
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numéro de série</Label>
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <div>
            <Label>Raison du retour *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrire le problème ou la raison du retour…"
              rows={3}
            />
          </div>

          <div>
            <Label>Notes internes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optionnel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!reason.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending && (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            )}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────  Detail drawer  ─────────────────────────── */

function RmaDetailDrawer({
  row,
  onClose,
}: {
  row: RmaRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [tracking, setTracking] = useState("");

  // sync local edits when row changes
  useMemo(() => {
    setNotes(row?.notes || "");
    setTracking(row?.tracking_number || "");
  }, [row?.id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { error } = await supabase
        .from("rma_requests" as any)
        .update({
          notes: notes.trim() || null,
          tracking_number: tracking.trim() || null,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      qc.invalidateQueries({ queryKey: ["core-rma"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Sheet open={!!row} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Détail RMA</SheetTitle>
          <SheetDescription>
            {row && (
              <span className="text-xs font-mono">{row.id.slice(0, 8)}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {row && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2 text-sm">
              <Field label="Client" value={row.client_name || "—"} />
              <Field label="Type d'appareil" value={row.device_type} />
              <Field
                label="Numéro de série"
                value={row.serial_number || "—"}
              />
              <Field label="Raison" value={row.reason} />
              <div>
                <div className="text-xs text-muted-foreground">Statut</div>
                <Badge
                  variant="outline"
                  className={STATUS_STYLE[row.status]}
                >
                  {STATUS_LABEL[row.status]}
                </Badge>
              </div>
              <Field
                label="Créé le"
                value={format(
                  new Date(row.created_at),
                  "d MMM yyyy HH:mm",
                  { locale: fr },
                )}
              />
            </div>

            <div>
              <Label>Numéro de suivi</Label>
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking transporteur"
              />
            </div>

            <div>
              <Label>Notes internes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Enregistrer
            </Button>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                Historique
              </div>
              <div className="space-y-1.5">
                {(row.status_history || []).length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Aucun changement enregistré.
                  </div>
                )}
                {(row.status_history || []).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs border border-border rounded px-2 py-1.5"
                  >
                    <Badge
                      variant="outline"
                      className={STATUS_STYLE[h.status as RmaStatus]}
                    >
                      {STATUS_LABEL[h.status as RmaStatus] || h.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {format(new Date(h.at), "d MMM HH:mm", { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}
