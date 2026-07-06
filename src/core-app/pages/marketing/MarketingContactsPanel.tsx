/**
 * MarketingContactsPanel — Contact selector for targeted marketing sends.
 * Unifies `clients` and `crm_contacts` (228 leads) with checkboxes.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Send, Loader2, Users, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { MKCard, MKCardHeader } from "./_marketing-ui";

export interface UnifiedContact {
  id: string;
  source: "client" | "crm";
  email: string;
  name: string;
  city: string | null;
  status: string | null;
}

interface Props {
  /** Called when user clicks "Envoyer aux sélectionnés". Provides split IDs. */
  onSendToSelected: (payload: { client_ids: string[]; crm_contact_ids: string[] }) => Promise<void> | void;
  /** Whether a builder has content ready (subject + body). Disables Send otherwise. */
  builderReady: boolean;
}

export default function MarketingContactsPanel({ onSendToSelected, builderReady }: Props) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "client" | "crm">("all");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [clientsRes, crmRes, unsubsRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, email, first_name, last_name, service_city, status")
            .not("email", "is", null)
            .neq("email", "")
            .limit(2000),
          supabase
            .from("crm_contacts")
            .select("id, email, first_name, last_name, city, call_status, unsubscribed_at")
            .not("email", "is", null)
            .neq("email", "")
            .is("unsubscribed_at", null)
            .limit(2000),
          supabase.from("email_unsubscribes").select("email").eq("is_active", true),
        ]);

        const unsubs = new Set(
          (unsubsRes.data ?? []).map((u: any) => String(u.email).toLowerCase()),
        );

        const unified: UnifiedContact[] = [];
        for (const c of clientsRes.data ?? []) {
          if (unsubs.has(String(c.email).toLowerCase())) continue;
          unified.push({
            id: c.id,
            source: "client",
            email: c.email,
            name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
            city: c.service_city ?? null,
            status: c.status ?? null,
          });
        }
        for (const c of crmRes.data ?? []) {
          if (unsubs.has(String(c.email).toLowerCase())) continue;
          unified.push({
            id: c.id,
            source: "crm",
            email: c.email,
            name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
            city: c.city ?? null,
            status: c.call_status ?? null,
          });
        }
        setContacts(unified);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (source !== "all" && c.source !== source) return false;
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, source]);

  const counts = useMemo(() => {
    let clients = 0, crm = 0;
    for (const c of contacts) {
      if (c.source === "client") clients++;
      else crm++;
    }
    return { clients, crm, total: contacts.length };
  }, [contacts]);

  const toggleAll = () => {
    if (filtered.every((c) => selected.has(`${c.source}:${c.id}`))) {
      const next = new Set(selected);
      filtered.forEach((c) => next.delete(`${c.source}:${c.id}`));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((c) => next.add(`${c.source}:${c.id}`));
      setSelected(next);
    }
  };

  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un contact");
      return;
    }
    if (!builderReady) {
      toast.error("Écrivez d'abord le sujet et le corps dans l'onglet Nouveau");
      return;
    }
    const client_ids: string[] = [];
    const crm_contact_ids: string[] = [];
    for (const key of selected) {
      const [src, id] = key.split(":");
      if (src === "client") client_ids.push(id);
      else crm_contact_ids.push(id);
    }
    setSending(true);
    try {
      await onSendToSelected({ client_ids, crm_contact_ids });
      setSelected(new Set());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total" value={counts.total} icon={Users} color="#7C3AED" />
        <MiniStat label="Clients" value={counts.clients} icon={UserCheck} color="#10B981" />
        <MiniStat label="Prospects CRM" value={counts.crm} icon={UserPlus} color="#F59E0B" />
      </div>

      <MKCard>
        <MKCardHeader
          title={`Contacts · ${filtered.length} affichés · ${selected.size} sélectionnés`}
          action={
            <Button
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="rounded-[10px] text-white border-0 h-8 font-semibold text-xs"
              style={{ background: "#7C3AED" }}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Envoyer aux {selected.size} sélectionnés
            </Button>
          }
        />
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher email, nom, ville..."
                className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#666] rounded-[10px] pl-8 h-9"
              />
            </div>
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger className="w-[180px] bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D0D1A] border-[#1E1E2E] text-white">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="client">Clients seulement</SelectItem>
                <SelectItem value="crm">Prospects CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-[10px] border border-[#1E1E2E] overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 bg-[#0a0a14] border-b border-[#1E1E2E] text-[10px] uppercase tracking-[2px] text-[#888]">
              <Checkbox
                checked={filtered.length > 0 && filtered.every((c) => selected.has(`${c.source}:${c.id}`))}
                onCheckedChange={toggleAll}
                className="border-[#3a3a4e]"
              />
              <div className="flex-1">Contact</div>
              <div className="w-32 hidden sm:block">Ville</div>
              <div className="w-24">Source</div>
            </div>
            {loading ? (
              <div className="py-12 text-center text-[#888]">
                <Loader2 className="h-5 w-5 animate-spin inline" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#888]">Aucun contact trouvé</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                {filtered.slice(0, 500).map((c) => {
                  const key = `${c.source}:${c.id}`;
                  const isSel = selected.has(key);
                  return (
                    <div
                      key={key}
                      onClick={() => toggleOne(key)}
                      className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1E1E2E] last:border-0 cursor-pointer transition ${
                        isSel ? "bg-[#7C3AED15]" : "hover:bg-[#0a0a14]"
                      }`}
                    >
                      <Checkbox checked={isSel} onCheckedChange={() => toggleOne(key)} className="border-[#3a3a4e]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                        <div className="text-[11px] text-[#888] truncate">{c.email}</div>
                      </div>
                      <div className="w-32 text-xs text-[#888] hidden sm:block truncate">{c.city ?? "—"}</div>
                      <div className="w-24">
                        {c.source === "client" ? (
                          <Badge className="bg-[#10B98122] text-[#10B981] border-0 text-[10px]">CLIENT</Badge>
                        ) : (
                          <Badge className="bg-[#F59E0B22] text-[#F59E0B] border-0 text-[10px]">PROSPECT</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length > 500 && (
                  <div className="py-3 text-center text-[11px] text-[#666]">
                    {filtered.length - 500} contacts supplémentaires masqués — affinez la recherche.
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#666]">
            Les désabonnés sont automatiquement exclus. Cliquez sur une ligne pour la sélectionner.
          </p>
        </div>
      </MKCard>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="rounded-[10px] p-4 bg-[#0D0D1A] border border-[#1E1E2E]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[2px] text-[#888]">{label}</span>
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: `${color}1A` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold tabular-nums mt-2 text-white">{value}</div>
    </div>
  );
}
