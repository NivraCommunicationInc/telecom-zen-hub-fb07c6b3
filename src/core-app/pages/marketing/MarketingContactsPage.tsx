/**
 * MarketingContactsPage — Vue unifiée des contacts marketing (clients + CRM leads + imports).
 * Recherche, filtre par source, sélection multiple, export CSV.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Users, Loader2, RefreshCw, Target, Send } from "lucide-react";
import { toast } from "sonner";
import { MKPage, MKCard, MKCardHeader, MKStat } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";

type Row = {
  id: string;
  source: "client" | "crm" | "custom";
  email: string;
  name: string;
  city: string | null;
  status: string | null;
};

export default function MarketingContactsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | "client" | "crm" | "custom">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [clientsRes, crmRes, customRes] = await Promise.all([
        supabase.from("profiles").select("user_id, email, first_name, last_name, city").not("email", "is", null).limit(2000),
        supabase.from("crm_contacts").select("id, email, first_name, last_name, city, status").not("email", "is", null).limit(2000),
        supabase.from("mkt_contacts_custom").select("id, email, first_name, last_name, city, status").limit(2000),
      ]);
      const out: Row[] = [];
      (clientsRes.data ?? []).forEach((c: any) => c.email && out.push({
        id: `client:${c.user_id}`, source: "client", email: c.email,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email,
        city: c.city, status: "client",
      }));
      (crmRes.data ?? []).forEach((c: any) => c.email && out.push({
        id: `crm:${c.id}`, source: "crm", email: c.email,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email,
        city: c.city, status: c.status,
      }));
      (customRes.data ?? []).forEach((c: any) => c.email && out.push({
        id: `custom:${c.id}`, source: "custom", email: c.email,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email,
        city: c.city, status: c.status,
      }));
      // Dedupe by email
      const seen = new Set<string>();
      setRows(out.filter(r => { const k = r.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }));
    } catch (e: any) {
      toast.error("Erreur chargement contacts: " + (e?.message ?? String(e)));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (source !== "all" && r.source !== source) return false;
      if (!needle) return true;
      return r.email.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle) || (r.city ?? "").toLowerCase().includes(needle);
    });
  }, [rows, q, source]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)));

  const exportCsv = () => {
    const target = selected.size ? filtered.filter(r => selected.has(r.id)) : filtered;
    const csv = ["email,name,source,city,status", ...target.map(r =>
      `"${r.email}","${r.name.replace(/"/g, '""')}",${r.source},"${r.city ?? ""}","${r.status ?? ""}"`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `contacts-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${target.length} contacts exportés`);
  };

  const createAudienceFromSelection = async () => {
    if (!selected.size) {
      toast.error("Sélectionne au moins un contact");
      return;
    }
    const emails = filtered.filter((r) => selected.has(r.id)).map((r) => r.email.toLowerCase());
    const { error } = await supabase.from("mkt_audiences").insert({
      name: `Sélection contacts · ${new Date().toLocaleDateString("fr-CA")}`,
      description: `${emails.length} contacts sélectionnés manuellement depuis la liste marketing`,
      rules: { source: "selected_emails", filters: { emails } },
      member_count: emails.length,
      last_refreshed_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success(`Audience créée · ${emails.length} contacts`);
  };

  const counts = useMemo(() => ({
    total: rows.length,
    client: rows.filter(r => r.source === "client").length,
    crm: rows.filter(r => r.source === "crm").length,
    custom: rows.filter(r => r.source === "custom").length,
  }), [rows]);

  return (
    <MKPage
      title="Contacts"
      subtitle="Vue unifiée: clients, leads CRM, imports personnalisés"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load} className="border-[#1E1E2E] bg-[#0D0D1A] text-white hover:bg-[#1E1E2E]">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
          </Button>
          <Button size="sm" onClick={exportCsv} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Download className="h-4 w-4 mr-1.5" /> Exporter CSV
          </Button>
          <Button size="sm" onClick={createAudienceFromSelection} disabled={!selected.size} className="rounded-full font-black">
            <Target className="h-4 w-4 mr-1.5" /> Audience sélection
          </Button>
        </>
      }
    >
      <MarketingNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MKStat label="Total" value={counts.total} icon={Users} />
        <MKStat label="Clients" value={counts.client} accent="#10B981" />
        <MKStat label="Leads CRM" value={counts.crm} accent="#F59E0B" />
        <MKStat label="Custom" value={counts.custom} accent="#7C3AED" />
      </div>

      <MKCard>
        <MKCardHeader title={`Contacts (${filtered.length})`} action={
          selected.size ? <Badge className="bg-[#7C3AED]"><Send className="mr-1 h-3 w-3" />{selected.size} sélectionnés</Badge> : null
        } />
        <div className="p-4 flex flex-wrap gap-2 border-b border-[#1E1E2E]">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888]" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher email, nom, ville…"
              className="pl-9 bg-[#0D0D1A] border-[#1E1E2E] text-white placeholder:text-[#666]" />
          </div>
          <Select value={source} onValueChange={v => setSource(v as any)}>
            <SelectTrigger className="w-[180px] bg-[#0D0D1A] border-[#1E1E2E] text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sources</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="crm">Leads CRM</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-[#888]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#888]">Aucun contact ne correspond aux filtres.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[#888] text-xs uppercase tracking-wider">
                <tr className="border-b border-[#1E1E2E]">
                  <th className="p-3 w-8"><Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Nom</th>
                  <th className="p-3 text-left">Source</th>
                  <th className="p-3 text-left">Ville</th>
                  <th className="p-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map(r => (
                  <tr key={r.id} className="border-b border-[#1E1E2E] hover:bg-[#1E1E2E]/30">
                    <td className="p-3"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                    <td className="p-3 text-white font-mono text-xs">{r.email}</td>
                    <td className="p-3 text-white">{r.name}</td>
                    <td className="p-3"><Badge variant="outline" className="border-[#1E1E2E] text-[#888] capitalize">{r.source}</Badge></td>
                    <td className="p-3 text-[#888]">{r.city ?? "—"}</td>
                    <td className="p-3 text-[#888]">{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="p-3 text-xs text-[#888] text-center border-t border-[#1E1E2E]">
                Affichage limité à 500 lignes. Filtrez pour affiner.
              </div>
            )}
          </div>
        )}
      </MKCard>
    </MKPage>
  );
}
