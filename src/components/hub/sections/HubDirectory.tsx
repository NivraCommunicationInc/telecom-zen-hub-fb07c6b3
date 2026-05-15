/**
 * HubDirectory — Internal staff directory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, Mail, User } from "lucide-react";
import { useState } from "react";

export default function HubDirectory({ search = "" }: { search?: string }) {
  const [dept, setDept] = useState("Tous");
  const { data, isLoading } = useQuery({
    queryKey: ["hub-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_directory")
        .select("*")
        .eq("is_visible", true)
        .order("order_index")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const departments = ["Tous", ...Array.from(new Set((data || []).map((d: any) => d.department).filter(Boolean)))];
  const filtered = (data || []).filter((d: any) => {
    if (dept !== "Tous" && d.department !== dept) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.name || "").toLowerCase().includes(s) || (d.role || "").toLowerCase().includes(s);
    }
    return true;
  });

  if (!filtered.length) {
    return (
      <div className="text-center py-16">
        <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucun contact à afficher.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {departments.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {departments.map((d: any) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`min-h-[44px] sm:min-h-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                dept === d ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {d.avatar_url ? (
                <img src={d.avatar_url} alt={d.name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold">
                  {d.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.role}</div>
                {d.department && <div className="text-[10px] text-muted-foreground/70 truncate">{d.department}</div>}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {d.email && (
                <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:underline min-h-[32px]">
                  <Mail className="h-3.5 w-3.5" /> {d.email}
                </a>
              )}
              {d.phone && (
                <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:underline min-h-[32px]">
                  <Phone className="h-3.5 w-3.5" /> {d.phone}{d.extension ? ` × ${d.extension}` : ""}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
