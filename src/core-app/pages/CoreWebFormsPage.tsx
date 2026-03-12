/**
 * CoreWebFormsPage — Transferred from AdminWebForms.tsx
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreWebFormsPage() {
  const [search, setSearch] = useState("");
  const { data: submissions = [] } = useQuery({
    queryKey: ["core-web-forms"],
    queryFn: async () => {
      const { data } = await supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });
  const filtered = submissions.filter((s: any) => !search || [s.name, s.email, s.message].join(" ").toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Formulaire web</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Soumissions du formulaire de contact</p></div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" /><Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      <div className="space-y-2">{filtered.map((s: any) => (
        <div key={s.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-sky-400" /><span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{s.name} · {s.email}</span></div><Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">{s.status || "new"}</Badge></div>
          <p className="text-xs text-[hsl(var(--core-text-secondary))] line-clamp-2">{s.message}</p>
          <p className="text-[11px] text-[hsl(var(--core-text-label))] mt-1">{s.created_at && format(new Date(s.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
        </div>
      ))}{filtered.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune soumission</div>}</div>
    </div>
  );
}
