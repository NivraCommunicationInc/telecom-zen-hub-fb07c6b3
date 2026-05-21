/**
 * CoreReviewsPage — Nivra Core admin view of all client reviews.
 *
 * Features:
 *   - Stats bar (Total / Avg / % recommend / This month)
 *   - Filter tabs (all / activation / deactivation / 5..1 stars)
 *   - Search by client name or email
 *   - Table with paginated rows (10 / page)
 *   - Detail dialog: full review, admin response editor, feature toggle
 *
 * Access: Core admins only (RLS enforces; client-side guard for UX).
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Star, Search, Eye, ChevronLeft, ChevronRight, Loader2,
  ThumbsUp, ThumbsDown, MessageSquare, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ReviewRow = {
  id: string;
  account_id: string | null;
  trigger_type: "activation" | "deactivation";
  rating: number | null;
  review_text: string | null;
  service_quality: number | null;
  support_quality: number | null;
  value_for_money: number | null;
  would_recommend: boolean | null;
  submitted_at: string | null;
  status: "pending" | "submitted" | "archived";
  is_featured: boolean;
  admin_response: string | null;
  admin_responded_by: string | null;
  admin_responded_at: string | null;
  created_at: string;
};

type FilterKey = "all" | "activation" | "deactivation" | "5" | "4" | "3" | "2" | "1";

const PAGE_SIZE = 10;

function StarsDisplay({ value, size = 14 }: { value: number | null; size?: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          className={n <= value ? "text-amber-500" : "text-muted-foreground/30"}
          fill={n <= value ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border bg-card p-4 transition-all hover:shadow-md min-h-[88px]",
        active && "ring-2 ring-primary border-primary"
      )}
    >
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </button>
  );
}

export default function CoreReviewsPage() {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useIsCoreAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  // Fetch reviews (admin-only; RLS enforces)
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["core-reviews"],
    enabled: !!isAdmin,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reviews")
        .select("*")
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
  });

  // Fetch related accounts + profiles for display
  const accountIds = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.account_id).filter(Boolean) as string[])),
    [reviews]
  );

  const { data: accounts = [] } = useQuery({
    queryKey: ["core-reviews-accounts", accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_number, client_id")
        .in("id", accountIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientIds = useMemo(
    () => Array.from(new Set(accounts.map((a: any) => a.client_id).filter(Boolean))),
    [accounts]
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["core-reviews-profiles", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, first_name, email")
        .in("user_id", clientIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const accountMap = useMemo(() => {
    const m = new Map<string, any>();
    accounts.forEach((a: any) => m.set(a.id, a));
    return m;
  }, [accounts]);

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    profiles.forEach((p: any) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const enriched = useMemo(() => {
    return reviews.map((r) => {
      const acc = r.account_id ? accountMap.get(r.account_id) : null;
      const prof = acc?.client_id ? profileMap.get(acc.client_id) : null;
      const fullName =
        prof?.full_name ||
        prof?.first_name ||
        (acc?.account_number ? `Compte ${acc.account_number}` : "Client");
      return {
        ...r,
        client_full_name: fullName as string,
        client_email: (prof?.email as string) || "",
        account_number: (acc?.account_number as string) || "",
      };
    });
  }, [reviews, accountMap, profileMap]);

  // Filter logic (only show submitted reviews in the table; pending appear in Total only)
  const submitted = useMemo(
    () => enriched.filter((r) => r.status === "submitted"),
    [enriched]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submitted.filter((r) => {
      if (filter === "activation" && r.trigger_type !== "activation") return false;
      if (filter === "deactivation" && r.trigger_type !== "deactivation") return false;
      if (["1", "2", "3", "4", "5"].includes(filter) && r.rating !== parseInt(filter, 10))
        return false;
      if (q) {
        const blob = `${r.client_full_name} ${r.client_email} ${r.account_number}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [submitted, filter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  );

  // Stats
  const stats = useMemo(() => {
    const total = submitted.length;
    const ratings = submitted.map((r) => r.rating).filter((n): n is number => !!n);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const recs = submitted.filter((r) => r.would_recommend !== null);
    const recPct = recs.length
      ? Math.round((recs.filter((r) => r.would_recommend === true).length / recs.length) * 100)
      : 0;
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);
    const thisMonth = submitted.filter(
      (r) => r.submitted_at && new Date(r.submitted_at) >= startMonth
    ).length;
    return { total, avg, recPct, thisMonth };
  }, [submitted]);

  const selected = useMemo(
    () => enriched.find((r) => r.id === selectedId) ?? null,
    [enriched, selectedId]
  );

  // Open dialog with existing response
  const openDialog = (id: string) => {
    setSelectedId(id);
    const r = enriched.find((x) => x.id === id);
    setResponseText(r?.admin_response ?? "");
  };

  // Save admin response
  const saveResponse = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase
        .from("client_reviews")
        .update({
          admin_response: text.trim() || null,
          admin_responded_by: user?.id ?? null,
          admin_responded_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réponse enregistrée");
      qc.invalidateQueries({ queryKey: ["core-reviews"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  // Toggle featured
  const toggleFeatured = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("client_reviews")
        .update({ is_featured: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["core-reviews"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (roleLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Accès réservé aux administrateurs Nivra Core.
          </CardContent>
        </Card>
      </div>
    );
  }

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "activation", label: "Activation" },
    { key: "deactivation", label: "Résiliation" },
    { key: "5", label: "5 étoiles" },
    { key: "4", label: "4" },
    { key: "3", label: "3" },
    { key: "2", label: "2" },
    { key: "1", label: "1" },
  ];

  return (
    <>
      <Helmet>
        <title>Avis clients — Nivra Core</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Avis clients</h1>
          <p className="text-sm text-muted-foreground">
            Retours soumis par les clients après activation ou résiliation.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total avis" value={stats.total} />
          <StatCard label="Note moyenne" value={`${stats.avg.toFixed(1)} / 5`} />
          <StatCard label="% Recommandent" value={`${stats.recPct}%`} />
          <StatCard label="Avis ce mois" value={stats.thisMonth} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {filterTabs.map((t) => (
            <Button
              key={t.key}
              variant={filter === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter(t.key);
                setPage(0);
              }}
            >
              {t.label}
            </Button>
          ))}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, courriel, n° compte)…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Aucun avis trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Client</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Note</th>
                      <th className="text-left p-3 hidden md:table-cell">Service</th>
                      <th className="text-left p-3 hidden md:table-cell">Support</th>
                      <th className="text-left p-3 hidden md:table-cell">Prix</th>
                      <th className="text-left p-3">Recommande</th>
                      <th className="text-left p-3 hidden lg:table-cell">Date</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{r.client_full_name}</div>
                          <div className="text-xs text-muted-foreground">{r.client_email}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant={r.trigger_type === "activation" ? "default" : "secondary"}>
                            {r.trigger_type === "activation" ? "Activation" : "Résiliation"}
                          </Badge>
                          {r.is_featured && (
                            <Badge variant="outline" className="ml-1 border-amber-400 text-amber-600">
                              Vedette
                            </Badge>
                          )}
                        </td>
                        <td className="p-3"><StarsDisplay value={r.rating} /></td>
                        <td className="p-3 hidden md:table-cell"><StarsDisplay value={r.service_quality} size={11} /></td>
                        <td className="p-3 hidden md:table-cell"><StarsDisplay value={r.support_quality} size={11} /></td>
                        <td className="p-3 hidden md:table-cell"><StarsDisplay value={r.value_for_money} size={11} /></td>
                        <td className="p-3">
                          {r.would_recommend === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                              <ThumbsUp className="w-3.5 h-3.5" /> Oui
                            </span>
                          ) : r.would_recommend === false ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
                              <ThumbsDown className="w-3.5 h-3.5" /> Non
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {r.submitted_at ? format(new Date(r.submitted_at), "dd MMM yyyy", { locale: fr }) : "—"}
                        </td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" onClick={() => openDialog(r.id)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Voir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Detail dialog */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Avis de {selected?.client_full_name}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  {selected.client_email} • Compte {selected.account_number} •{" "}
                  {selected.submitted_at &&
                    format(new Date(selected.submitted_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </div>

                <div
                  className={cn(
                    "rounded-lg p-3 text-sm font-medium",
                    selected.would_recommend === true
                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-300"
                      : "bg-amber-500/10 text-amber-700 border border-amber-300"
                  )}
                >
                  {selected.would_recommend === true
                    ? "✅ Ce client recommande Nivra Telecom"
                    : "⚠️ Ce client ne recommande pas Nivra Telecom pour l'instant"}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Note globale</div>
                    <StarsDisplay value={selected.rating} size={18} />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <div className="text-sm font-medium">
                      {selected.trigger_type === "activation" ? "Activation" : "Résiliation"}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Service Internet</div>
                    <StarsDisplay value={selected.service_quality} />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Support client</div>
                    <StarsDisplay value={selected.support_quality} />
                  </div>
                  <div className="rounded-lg border p-3 col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Rapport qualité/prix</div>
                    <StarsDisplay value={selected.value_for_money} />
                  </div>
                </div>

                {selected.review_text && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Commentaire du client
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{selected.review_text}</p>
                  </div>
                )}

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mettre en vedette</span>
                    <Switch
                      checked={selected.is_featured}
                      onCheckedChange={(v) =>
                        toggleFeatured.mutate({ id: selected.id, value: v })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Les avis en vedette peuvent être affichés sur le site public.
                  </p>
                </div>

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">Réponse de l'équipe Nivra</div>
                  {selected.admin_response && (
                    <div className="text-xs text-muted-foreground">
                      Dernière mise à jour:{" "}
                      {selected.admin_responded_at &&
                        format(new Date(selected.admin_responded_at), "d MMM yyyy HH:mm", {
                          locale: fr,
                        })}
                    </div>
                  )}
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    placeholder="Écrire une réponse publique au client…"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      saveResponse.mutate({ id: selected.id, text: responseText })
                    }
                    disabled={saveResponse.isPending}
                  >
                    {saveResponse.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Enregistrer la réponse
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedId(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
