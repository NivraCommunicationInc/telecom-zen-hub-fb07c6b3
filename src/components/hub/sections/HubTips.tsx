/**
 * HubTips — Sales tips & playbooks (hub_posts section='tips').
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lightbulb, Clock } from "lucide-react";
import { useState } from "react";

const CATEGORIES = ["Tous", "Objections", "Scripts", "Techniques", "Produits", "Territoire"];

export default function HubTips({ search = "" }: { search?: string }) {
  const [cat, setCat] = useState("Tous");
  const { data, isLoading } = useQuery({
    queryKey: ["hub-tips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_posts")
        .select("*")
        .eq("section", "tips")
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const filtered = (data || []).filter((p: any) => {
    if (cat !== "Tous" && p.category?.toLowerCase() !== cat.toLowerCase()) return false;
    if (search) {
      const s = search.toLowerCase();
      return (p.title || "").toLowerCase().includes(s) || (p.content || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`min-h-[44px] sm:min-h-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              cat === c ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="text-center py-16">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun conseil pour cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p: any) => (
            <article key={p.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap text-[10px]">
                {p.category && (
                  <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 font-semibold uppercase tracking-wider">
                    {p.category}
                  </span>
                )}
                {p.is_featured && <span className="rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 font-semibold uppercase tracking-wider">⭐ Featured</span>}
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {readTime(p.content)} min</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{p.title}</h3>
              {p.content && <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">{p.content}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function readTime(content?: string): number {
  if (!content) return 1;
  return Math.max(1, Math.round(content.split(/\s+/).length / 200));
}
