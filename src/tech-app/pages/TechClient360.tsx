/**
 * TechClient360 — Fiche client pour le technicien (services, dernière facture, contact).
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Phone, Mail, MapPin, DollarSign, Wifi, Tv, Smartphone, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TechHeader from "../components/TechHeader";

export default function TechClient360() {
  const [sp] = useSearchParams();
  const initialQ = sp.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, city")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    setResults(data ?? []);
    setLoading(false);
  }

  useEffect(() => { if (initialQ) search(); }, []);

  return (
    <>
      <TechHeader title="Client 360" subtitle="Fiche terrain" back />

      <section className="px-4 mt-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Nom, courriel, téléphone…"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[14px]"
            />
          </div>
          <button onClick={search} className="h-11 px-4 rounded-xl font-black italic uppercase text-[12px]" style={{ background: "#fbbf24", color: "#18181b" }}>
            OK
          </button>
        </div>
      </section>

      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>}

      {!selected && results.length > 0 && (
        <section className="px-4 mt-4 space-y-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full text-left p-3 rounded-xl bg-white border border-zinc-200"
            >
              <p className="text-[14px] font-black italic uppercase text-zinc-900">{r.first_name} {r.last_name}</p>
              <p className="text-[11px] text-zinc-500">{r.email} · {r.phone ?? "—"}</p>
            </button>
          ))}
        </section>
      )}

      {selected && (
        <>
          <section className="px-4 mt-4">
            <div className="rounded-2xl bg-zinc-900 text-white p-5">
              <p className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Client</p>
              <p className="mt-1 text-xl font-black italic uppercase">{selected.first_name} {selected.last_name}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`tel:${selected.phone}`} className="h-10 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-black italic uppercase" style={{ background: "#fbbf24", color: "#18181b" }}>
                  <Phone className="h-3.5 w-3.5" /> Appeler
                </a>
                <a href={`mailto:${selected.email}`} className="h-10 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-black italic uppercase bg-zinc-800 text-white">
                  <Mail className="h-3.5 w-3.5" /> Courriel
                </a>
              </div>
            </div>
          </section>

          <section className="px-4 mt-4 space-y-2">
            <div className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3">
              <Mail className="h-4 w-4 text-zinc-400" />
              <span className="text-[13px] text-zinc-900">{selected.email}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3">
              <Phone className="h-4 w-4 text-zinc-400" />
              <span className="text-[13px] text-zinc-900">{selected.phone ?? "—"}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <span className="text-[13px] text-zinc-900">{selected.city ?? "—"}</span>
            </div>
          </section>

          <section className="px-4 mt-4">
            <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Actions terrain</h2>
            <div className="space-y-2">
              <button className="w-full p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3 text-left">
                <span className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center"><Wifi className="h-4 w-4 text-amber-400" /></span>
                <span className="text-[13px] font-black italic uppercase text-zinc-900">Services actifs</span>
              </button>
              <button className="w-full p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3 text-left">
                <span className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center"><DollarSign className="h-4 w-4 text-amber-400" /></span>
                <span className="text-[13px] font-black italic uppercase text-zinc-900">Collecter un paiement</span>
              </button>
              <button className="w-full p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3 text-left">
                <span className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center"><Tv className="h-4 w-4 text-amber-400" /></span>
                <span className="text-[13px] font-black italic uppercase text-zinc-900">Historique factures</span>
              </button>
              <button className="w-full p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3 text-left">
                <span className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center"><Smartphone className="h-4 w-4 text-amber-400" /></span>
                <span className="text-[13px] font-black italic uppercase text-zinc-900">Équipement du client</span>
              </button>
            </div>
          </section>

          <div className="px-4 mt-4 mb-8">
            <button onClick={() => setSelected(null)} className="w-full h-11 rounded-xl bg-zinc-100 font-black italic uppercase text-[12px] text-zinc-900">
              Retour à la recherche
            </button>
          </div>
        </>
      )}
    </>
  );
}
