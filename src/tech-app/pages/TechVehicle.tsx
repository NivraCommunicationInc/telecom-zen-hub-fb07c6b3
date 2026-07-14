/**
 * TechVehicle — Check-list véhicule + EHS (santé/sécurité).
 */
import { useState } from "react";
import { Truck, Fuel, ShieldAlert, Check, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import TechHeader from "../components/TechHeader";

const CHECKS = [
  "Pneus (pression + usure)",
  "Phares et clignotants",
  "Freins",
  "Huile & liquides",
  "Extincteur & trousse premier soin",
  "Cônes / triangle de sécurité",
  "Cargaison sécurisée",
];

const PPE = [
  "Chaussures de sécurité",
  "Lunettes de protection",
  "Gants",
  "Casque",
  "Veste haute visibilité",
];

export default function TechVehicle() {
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("");
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [ppe, setPpe] = useState<Record<number, boolean>>({});
  const [incident, setIncident] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("installation_job_logs").insert({
        action: "vehicle_check",
        details: {
          odometer_km: Number(odometer) || null,
          fuel_level: fuel,
          checks: CHECKS.map((c, i) => ({ label: c, ok: !!checks[i] })),
          ppe: PPE.map((c, i) => ({ label: c, ok: !!ppe[i] })),
          incident: incident.trim() || null,
        },
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Check-list enregistrée");
      setIncident("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TechHeader title="Véhicule & EHS" subtitle="Check-list quotidienne" back />

      <section className="px-4 mt-4">
        <div className="rounded-2xl bg-zinc-900 text-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-5 w-5 text-amber-400" />
            <p className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Départ du dépôt</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-black italic uppercase text-zinc-400">Odomètre (km)</span>
              <input value={odometer} onChange={(e) => setOdometer(e.target.value)} type="number" className="mt-1 w-full h-10 px-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-[14px]" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black italic uppercase text-zinc-400">Essence</span>
              <select value={fuel} onChange={(e) => setFuel(e.target.value)} className="mt-1 w-full h-10 px-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-[14px]">
                <option value="">—</option>
                <option value="full">Plein</option>
                <option value="3/4">3/4</option>
                <option value="1/2">1/2</option>
                <option value="1/4">1/4</option>
                <option value="empty">Vide</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <Group title="Inspection véhicule" items={CHECKS} state={checks} setState={setChecks} />
      <Group title="Équipement de sécurité" items={PPE} state={ppe} setState={setPpe} />

      <section className="px-4 mt-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500">Incident / anomalie</h2>
        </div>
        <textarea
          value={incident}
          onChange={(e) => setIncident(e.target.value)}
          rows={3}
          placeholder="Décrire tout incident, dommage ou risque…"
          className="w-full p-3 rounded-xl border border-zinc-200 bg-white text-[13px]"
        />
      </section>

      <section className="px-4 mt-5 mb-8">
        <button
          onClick={submit}
          disabled={saving}
          className="w-full h-14 rounded-xl font-black italic uppercase tracking-wide disabled:opacity-50"
          style={{ background: "#fbbf24", color: "#18181b" }}
        >
          {saving ? "Enregistrement…" : "Envoyer la check-list"}
        </button>
      </section>
    </>
  );
}

function Group({ title, items, state, setState }: { title: string; items: string[]; state: Record<number, boolean>; setState: any }) {
  return (
    <section className="px-4 mt-5">
      <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">{title}</h2>
      <div className="space-y-1.5">
        {items.map((label, i) => {
          const on = !!state[i];
          return (
            <button
              key={i}
              onClick={() => setState((s: any) => ({ ...s, [i]: !s[i] }))}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border text-left"
              style={{ borderColor: on ? "#fbbf24" : "#e4e4e7" }}
            >
              <span
                className="h-6 w-6 rounded-md flex items-center justify-center"
                style={{ background: on ? "#fbbf24" : "#f4f4f5", color: on ? "#18181b" : "transparent" }}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="text-[13px] font-bold text-zinc-900">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
