/**
 * SimEsimStep — SIM physique + eSIM activation
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Smartphone, CheckCircle2, XCircle, Search, AlertCircle, QrCode, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { proc: any; }

const SIM_TYPES = [
  { value: "physical", label: "SIM physique" },
  { value: "replacement", label: "SIM de remplacement" },
  { value: "additional", label: "SIM additionnelle" },
];
const OPERATORS = [
  { value: "telus", label: "Telus" },
  { value: "bell", label: "Bell" },
  { value: "rogers", label: "Rogers" },
];
const NETWORK_PLANS = [
  { value: "giga_unlimited", label: "GIGA Illimité" },
  { value: "standard_50go", label: "Standard 50Go" },
  { value: "data_only", label: "Data seulement" },
];
const ESIM_PROFILES = [
  { value: "new", label: "Générer nouveau" },
  { value: "reuse", label: "Réutiliser existant" },
];

export function SimEsimStep({ proc }: Props) {
  const mf = proc.mobileFulfillment || {};

  const [iccid, setIccid] = useState<string>(mf.sim_iccid || "");
  const [imei, setImei] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>(mf.assigned_number || "");
  const [simType, setSimType] = useState<string>(mf.sim_type || "physical");
  const [operator, setOperator] = useState<string>(mf.sim_carrier || "telus");
  const [networkPlan, setNetworkPlan] = useState<string>("giga_unlimited");
  const [iccidCheck, setIccidCheck] = useState<{ status: "idle" | "found" | "missing"; label?: string }>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const [eid, setEid] = useState<string>("");
  const [esimProfile, setEsimProfile] = useState<string>("new");

  const simActive = mf.activation_status === "active" && mf.sim_type !== "esim";
  const esimActive = mf.activation_status === "active" && mf.sim_type === "esim";

  const isValidIccid = (v: string) => /^\d{19,20}$/.test(v.trim());

  const handleVerifyIccid = async () => {
    if (!iccid.trim()) { toast.error("Saisir un ICCID à vérifier"); return; }
    setIccidCheck({ status: "idle" });
    try {
      const { data, error } = await supabase.from("equipment_inventory")
        .select("id, status, catalog_name").eq("iccid", iccid.trim()).maybeSingle();
      if (error) throw error;
      if (data) setIccidCheck({ status: "found", label: `${data.catalog_name || "SIM"} (${data.status})` });
      else setIccidCheck({ status: "missing" });
    } catch (err: any) {
      toast.error(`Erreur de vérification: ${err?.message || "inconnue"}`);
    }
  };

  const handleActivateSim = async () => {
    if (!isValidIccid(iccid)) { toast.error("ICCID invalide — 19 à 20 chiffres requis"); return; }
    if (!phoneNumber.trim()) { toast.error("Numéro de téléphone requis"); return; }
    setBusy(true);
    try {
      await proc.activateSim({
        iccid: iccid.trim(), imei: imei.trim() || null, phone_number: phoneNumber.trim(),
        sim_type: simType, operator, plan: networkPlan,
      });
    } finally { setBusy(false); }
  };

  const handleDeactivateSim = async () => {
    setBusy(true);
    try { await proc.deactivateSim(); } finally { setBusy(false); }
  };

  const handleActivateEsim = async () => {
    if (!eid.trim()) { toast.error("EID requis"); return; }
    setBusy(true);
    try { await proc.activateEsim({ eid: eid.trim(), profile_type: esimProfile }); } finally { setBusy(false); }
  };

  const handleResendQr = async () => {
    setBusy(true);
    try { await proc.resendEsimQr(); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">SIM / eSIM</div>

      {/* Info alert */}
      <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Vérifier que l'ICCID est présent dans l'inventaire avant activation.</span>
      </div>

      {/* SIM physique */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" /> SIM physique
          </h3>
          {simActive && <span className="bg-green-900/50 text-green-300 text-[10px] font-medium px-2 py-1 rounded-full">Active</span>}
        </div>
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">ICCID</Label>
            <div className="flex gap-2">
              <Input value={iccid} onChange={(e) => setIccid(e.target.value)} placeholder="89014103211118510720" maxLength={20}
                className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
              <Button type="button" onClick={handleVerifyIccid} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
                <Search className="mr-1 h-4 w-4" /> Vérifier
              </Button>
            </div>
            {iccidCheck.status === "found" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-300"><CheckCircle2 className="h-3 w-3" /> Trouvé — {iccidCheck.label}</p>
            )}
            {iccidCheck.status === "missing" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-300"><XCircle className="h-3 w-3" /> Aucun ICCID correspondant trouvé</p>
            )}
            {iccid && !isValidIccid(iccid) && (
              <p className="mt-1 text-xs text-red-300">Format attendu: 19 à 20 chiffres</p>
            )}
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">IMEI</Label>
            <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="358240051111110"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Numéro de téléphone</Label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 514 555 0000"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Type de SIM</Label>
            <Select value={simType} onValueChange={setSimType}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{SIM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Opérateur réseau</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Forfait réseau</Label>
            <Select value={networkPlan} onValueChange={setNetworkPlan}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{NETWORK_PLANS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <Button onClick={handleActivateSim} disabled={busy} className="text-sm bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="mr-1 h-4 w-4" /> Activer SIM
            </Button>
            <Button onClick={handleDeactivateSim} disabled={busy || !simActive} className="text-sm bg-red-700 hover:bg-red-800 text-white">
              <XCircle className="mr-1 h-4 w-4" /> Désactiver SIM
            </Button>
          </div>
        </div>
      </div>

      {/* eSIM */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Smartphone className="h-3.5 w-3.5" /> eSIM
          </h3>
          {esimActive && <span className="bg-green-900/50 text-green-300 text-[10px] font-medium px-2 py-1 rounded-full">Active</span>}
        </div>
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">EID</Label>
            <Input value={eid} onChange={(e) => setEid(e.target.value)} placeholder="89049032005008882600003156712345"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Profil eSIM</Label>
            <Select value={esimProfile} onValueChange={setEsimProfile}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{ESIM_PROFILES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <Button onClick={handleActivateEsim} disabled={busy} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
              <QrCode className="mr-1 h-4 w-4" /> Générer QR Code eSIM
            </Button>
            <Button onClick={handleResendQr} disabled={busy || !esimActive} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
              <Send className="mr-1 h-4 w-4" /> Envoyer QR au client
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
