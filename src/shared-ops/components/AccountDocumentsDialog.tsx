/**
 * AccountDocumentsDialog — Phase 11
 * Staff-only read of all client documents (contracts, auto-docs, uploads, order docs).
 * Pulls via the `account-documents-list` edge function which signs storage URLs.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Loader2, RefreshCw, Search, FolderOpen, FileSignature, FileCheck2, Upload, PackageCheck, Receipt, FileSpreadsheet, FileQuestion, Send, Trash2, UploadCloud, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId?: string | null;
  initialData?: any;
  /** true when caller is a Nivra Core admin — enables upload/delete controls */
  isAdmin?: boolean;
  /** true when caller is any staff (agent/admin) — enables "resend signature" */
  isStaff?: boolean;
}

interface DocItem {
  id: string;
  source: "contract" | "auto" | "uploaded" | "order" | "invoice" | "receipt" | "quote";
  category: string;
  name: string;
  number?: string | null;
  created_at: string;
  url: string | null;
  signed: boolean;
  size_bytes?: number | null;
  metadata?: Record<string, any> | null;
}

const sourceMeta: Record<DocItem["source"], { label: string; icon: any; tone: string }> = {
  contract: { label: "Contrats", icon: FileSignature, tone: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  auto: { label: "Auto-générés", icon: FileCheck2, tone: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  uploaded: { label: "Téléversés", icon: Upload, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  order: { label: "Commandes", icon: PackageCheck, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  invoice: { label: "Factures", icon: FileSpreadsheet, tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  receipt: { label: "Reçus", icon: Receipt, tone: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  quote: { label: "Soumissions", icon: FileQuestion, tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
};

function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function docsFromCanonical(data: any): DocItem[] {
  if (!data) return [];
  const rows: DocItem[] = [];
  (data.contracts || []).forEach((c: any) => rows.push({
    id: `canonical-contract-${c.id}`,
    source: "contract",
    category: "Contrat",
    name: c.contract_number ? `Contrat ${c.contract_number}` : c.contract_name || "Contrat",
    number: c.contract_number,
    created_at: c.created_at,
    url: c.contract_pdf_url || c.contract_url || null,
    signed: false,
    metadata: { status: c.status, signed_at: c.client_signed_at || c.signed_at },
  }));
  (data.documents || []).forEach((d: any) => rows.push({
    id: `canonical-upload-${d.id}`,
    source: "uploaded",
    category: d.document_type || "Document",
    name: d.document_name || "Document",
    created_at: d.created_at,
    url: d.document_url || null,
    signed: false,
  }));
  (data.invoices || []).forEach((inv: any) => rows.push({
    id: `canonical-invoice-${inv.id}`,
    source: "invoice",
    category: "Facture",
    name: `Facture ${inv.invoice_number || inv.id.slice(0, 8)}`,
    number: inv.invoice_number,
    created_at: inv.created_at,
    url: inv.pdf_url || inv.invoice_pdf_url || null,
    signed: false,
    metadata: { status: inv.status, total: inv.total, balance_due: inv.balance_due },
  }));
  (data.payments || []).forEach((p: any) => rows.push({
    id: `canonical-receipt-${p.id}`,
    source: "receipt",
    category: "Reçu de paiement",
    name: `Reçu ${p.payment_number || p.reference || p.id.slice(0, 8)}`,
    number: p.payment_number || p.reference || p.id.slice(0, 8),
    created_at: p.received_at || p.created_at,
    url: p.receipt_url || null,
    signed: false,
    metadata: { status: p.status, amount: p.amount, method: p.method },
  }));
  (data.orders || []).forEach((o: any) => rows.push({
    id: `canonical-order-${o.id}`,
    source: "order",
    category: "Commande",
    name: `Commande ${o.order_number || o.id.slice(0, 8)}`,
    number: o.order_number,
    created_at: o.created_at,
    url: null,
    signed: false,
    metadata: { status: o.status, total: o.total_amount },
  }));
  return rows;
}

export function AccountDocumentsDialog({ open, onClose, clientUserId, clientName, accountId, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DocItem[]>([]);
  const [tab, setTab] = useState<"all" | DocItem["source"]>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!clientUserId) return;
    setLoading(true);
    try {
      const fallbackItems = docsFromCanonical(initialData);
      if (fallbackItems.length > 0) setItems(fallbackItems);
      const { data, error } = await supabase.functions.invoke("account-documents-list", {
        body: { client_user_id: clientUserId, account_id: accountId ?? null },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erreur");
      const merged = [...(data.items ?? []), ...fallbackItems];
      setItems(Array.from(new Map(merged.map((i: DocItem) => [`${i.source}-${i.id}`, i])).values()));
    } catch (e: any) {
      toast.error("Erreur chargement documents", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, clientUserId]);

  const counts = useMemo(() => {
    const c: Record<DocItem["source"], number> = { contract: 0, auto: 0, uploaded: 0, order: 0, invoice: 0, receipt: 0, quote: 0 };
    for (const i of items) c[i.source]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => tab === "all" || i.source === tab)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.number ?? "").toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [items, tab, search]);

  const openDoc = (it: DocItem) => {
    if (!it.url) {
      toast.warning("Aucun fichier disponible pour ce document");
      return;
    }
    window.open(it.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-violet-400" />
            Documents — {clientName}
          </DialogTitle>
          <DialogDescription>
            Contrats, factures, reçus, documents KYC et pièces de commande. Les liens vers le stockage privé expirent après 5 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (numéro, nom, type…)"
              className="pl-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="all">Tout ({items.length})</TabsTrigger>
            <TabsTrigger value="contract">Contrats ({counts.contract})</TabsTrigger>
            <TabsTrigger value="invoice">Factures ({counts.invoice})</TabsTrigger>
            <TabsTrigger value="receipt">Reçus ({counts.receipt})</TabsTrigger>
            <TabsTrigger value="auto">Auto ({counts.auto})</TabsTrigger>
            <TabsTrigger value="uploaded">Téléversés ({counts.uploaded})</TabsTrigger>
            <TabsTrigger value="order">Commandes ({counts.order})</TabsTrigger>
            <TabsTrigger value="quote">Soumissions ({counts.quote})</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun document trouvé.
            </div>
          ) : (
            <ul className="space-y-2 py-2">
              {filtered.map((it) => {
                const meta = sourceMeta[it.source];
                const Icon = meta.icon;
                return (
                  <li
                    key={`${it.source}-${it.id}`}
                    className="rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,10%)] hover:border-violet-500/40 transition-colors p-3 flex items-center gap-3"
                  >
                    <div className={`shrink-0 h-10 w-10 rounded-md border flex items-center justify-center ${meta.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate text-core-text-primary">{it.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                        <Badge variant="outline" className="text-[10px] border-[hsl(220,15%,22%)] text-core-text-secondary">{it.category}</Badge>
                        {it.signed && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30">
                            Lien temporaire 5 min
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-core-text-label mt-1 flex items-center gap-3 flex-wrap">
                        <span>{new Date(it.created_at).toLocaleString("fr-CA")}</span>
                        {it.number && <span>N° {it.number}</span>}
                        <span>{formatBytes(it.size_bytes)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDoc(it)}
                      disabled={!it.url}
                      className="shrink-0"
                    >
                      {it.url ? <><Download className="h-3.5 w-3.5 mr-1.5" /> Ouvrir</> : <><FileText className="h-3.5 w-3.5 mr-1.5" /> Indisponible</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
