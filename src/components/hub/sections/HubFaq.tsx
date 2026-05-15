/**
 * HubFaq — Searchable FAQ with up/down votes (hub_faq_votes).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, HelpCircle, ChevronDown, ThumbsUp, ThumbsDown, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function HubFaq({ search: initialSearch = "" }: { search?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState("Tous");
  const [search, setSearch] = useState(initialSearch);
  const qc = useQueryClient();

  useEffect(() => setSearch(initialSearch), [initialSearch]);

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["hub-faq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_faq")
        .select("*")
        .eq("is_published", true)
        .order("upvotes", { ascending: false })
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: myVotes } = useQuery({
    queryKey: ["hub-faq-votes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_faq_votes")
        .select("faq_id, vote")
        .eq("user_id", userId!);
      if (error) throw error;
      const map: Record<string, "up" | "down"> = {};
      (data || []).forEach((v: any) => (map[v.faq_id] = v.vote));
      return map;
    },
  });

  const vote = useMutation({
    mutationFn: async ({ faqId, value }: { faqId: string; value: "up" | "down" }) => {
      if (!userId) throw new Error("Vous devez être connecté");
      const { error } = await supabase
        .from("hub_faq_votes")
        .upsert({ user_id: userId, faq_id: faqId, vote: value }, { onConflict: "user_id,faq_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-faq"] });
      qc.invalidateQueries({ queryKey: ["hub-faq-votes", userId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du vote"),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const categories = ["Tous", ...Array.from(new Set((data || []).map((f: any) => f.category).filter(Boolean)))];
  const filtered = (data || []).filter((f: any) => {
    if (cat !== "Tous" && f.category !== cat) return false;
    if (search) {
      const s = search.toLowerCase();
      return (f.question || "").toLowerCase().includes(s) || (f.answer || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une question…"
          className="w-full rounded-full border border-border bg-card pl-9 pr-4 py-2.5 text-sm min-h-[44px]"
        />
      </div>

      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c: any) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "min-h-[44px] sm:min-h-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                cat === c ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {!filtered.length ? (
        <div className="text-center py-16">
          <HelpCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune question pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f: any) => {
            const open = openId === f.id;
            const my = myVotes?.[f.id];
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="w-full text-left p-4 flex items-center gap-2 min-h-[44px]"
                >
                  <span className="text-sm font-semibold text-foreground flex-1">{f.question}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <div className="text-sm text-muted-foreground whitespace-pre-line">{f.answer}</div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <span className="text-[11px] text-muted-foreground mr-1">Cette réponse vous a aidé ?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); vote.mutate({ faqId: f.id, value: "up" }); }}
                        disabled={!userId || vote.isPending}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[36px]",
                          my === "up" ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {f.upvotes ?? 0}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); vote.mutate({ faqId: f.id, value: "down" }); }}
                        disabled={!userId || vote.isPending}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[36px]",
                          my === "down" ? "bg-red-500/10 border-red-500 text-red-600" : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> {f.downvotes ?? 0}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
