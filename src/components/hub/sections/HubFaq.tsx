/**
 * HubFaq — Searchable accordion FAQ.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, HelpCircle, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function HubFaq({ search = "" }: { search?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState("Tous");
  const { data, isLoading } = useQuery({
    queryKey: ["hub-faq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_faq")
        .select("*")
        .eq("is_published", true)
        .order("order_index")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const categories = ["Tous", ...Array.from(new Set((data || []).map((f: any) => f.category).filter(Boolean)))];
  const filtered = (data || []).filter((f: any) => {
    if (cat !== "Tous" && f.category !== cat) return false;
    if (search) {
      const s = search.toLowerCase();
      return (f.question || "").toLowerCase().includes(s) || (f.answer || "").toLowerCase().includes(s);
    }
    return true;
  });

  if (!filtered.length) {
    return (
      <div className="text-center py-16">
        <HelpCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucune question pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c: any) => (
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
      )}
      <div className="space-y-2">
        {filtered.map((f: any) => {
          const open = openId === f.id;
          return (
            <div key={f.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : f.id)}
                className="w-full text-left p-4 flex items-center gap-2 min-h-[44px]"
              >
                <span className="text-sm font-semibold text-foreground flex-1">{f.question}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-line border-t border-border pt-3">
                  {f.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
