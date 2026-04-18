/**
 * SimEsimStep — SIM physique + eSIM activation
 * Both sub-sections rendered simultaneously (no tabs).
 * All writes go through proc.* mutations defined in useOrderProcessing.ts.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  // SIM physique state
  const [iccid, setIccid] = useState<string>(mf.sim_iccid || "");
  const [imei, setImei] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>(mf.assigned_number || "");
  const [simType, setSimType] = useState<string>(mf.sim_type || "physical");
  const [operator, setOperator] = useState<string>(mf.sim_carrier || "telus");
  const [networkPlan, setNetworkPlan] = useState<string>("giga_unlimited");
  const [iccidCheck, setIccidCheck] = useState<{ status: "idle" | "found" | "missing"; label?: string }>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  // eSIM state
  const [eid, setEid] = useState<string>("");
  const [esimProfile, setEsimProfile] = useState<string>("new");

  const simActive = mf.activation_status === "active" && mf.sim_type !== "esim";
  const esimActive = mf.activation_status === "active" && mf.sim_type === "esim";

  const isValidIccid = (v: string) => /^\d{19,20}$/.test(v.trim());

  const handleVerifyIccid = async () => {
    if (!iccid.trim()) {
      toast.error("Saisir un ICCID à vérifier");
      return;
    }
    setIccidCheck({ status: "idle" });
    try {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, status, catalog_name")
        .eq("iccid", iccid.trim())
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setIccidCheck({ status: "found", label: `${data.catalog_name || "SIM"} (${data.status})` });
      } else {
        setIccidCheck({ status: "missing" });
      }
    } catch (err: any) {
      toast.error(`Erreur de vérification: ${err?.message || "inconnue"}`);
    }
  };

  const handleActivateSim = async () => {
    if (!isValidIccid(iccid)) {
      toast.error("ICCID invalide — 19 à 20 chiffres requis");
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error("Numéro de téléphone requis");
      return;
    }
    setBusy(true);
    try {
      await proc.activateSim({
        iccid: iccid.trim(),
        imei: imei.trim() || null,
        phone_number: phoneNumber.trim(),
        sim_type: simType,
        operator,
        plan: networkPlan,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivateSim = async () => {
    setBusy(true);
    try {
      await proc.deactivateSim();
    } finally {
      setBusy(false);
    }
  };

  const handleActivateEsim = async () => {
    if (!eid.trim()) {
      toast.error("EID requis");
      return;
    }
    setBusy(true);
    try {
      await proc.activateEsim({ eid: eid.trim(), profile_type: esimProfile });
    } finally {
      setBusy(false);
    }
  };

  const handleResendQr = async () => {
    setBusy(true);
    try {
      await proc.resendEsimQr();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info alert */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>Vérifier que l'ICCID est présent dans l'inventaire avant activation.</span>
      </div>

      {/* SIM PHYSIQUE */}
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">SIM physique</h3>
          </div>
          {simActive && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>}
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="iccid">ICCID</Label>
            <div className="flex gap-2">
              <Input
                id="iccid"
                value={iccid}
                onChange={(e) => setIccid(e.target.value)}
                placeholder="89014103211118510720"
                maxLength={20}
              />
              <Button type="button" variant="outline" onClick={handleVerifyIccid}>
                <Search className="mr-1 h-4 w-4" />
                Vérifier ICCID
              </Button>
            </div>
            {iccidCheck.status === "found" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Trouvé dans l'inventaire — {iccidCheck.label}
              </p>
            )}
            {iccidCheck.status === "missing" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-700">
                <XCircle className="h-3 w-3" /> Aucun ICCID correspondant trouvé dans l'inventaire
              </p>
            )}
            {iccid && !isValidIccid(iccid) && (
              <p className="mt-1 text-xs text-red-600">Format attendu: 19 à 20 chiffres</p>
            )}
          </div>

          <div>
            <Label htmlFor="imei">IMEI</Label>
            <Input id="imei" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="358240051111110" />
          </div>

          <div>
            <Label htmlFor="phone">Numéro de téléphone assigné</Label>
            <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 514 555 0000" />
          </div>

          <div>
            <Label>Type de SIM</Label>
            <Select value={simType} onValueChange={setSimType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Opérateur réseau</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Forfait réseau</Label>
            <Select value={networkPlan} onValueChange={setNetworkPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NETWORK_PLANS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleActivateSim} disabled={busy}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Activer SIM
          </Button>
          <Button variant="outline" onClick={handleDeactivateSim} disabled={busy || !simActive}>
            <XCircle className="mr-1 h-4 w-4" />
            Désactiver SIM
          </Button>
        </div>
      </section>

      {/* eSIM */}
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">eSIM</h3>
          </div>
          {esimActive && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>}
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="eid">EID</Label>
            <Input id="eid" value={eid} onChange={(e) => setEid(e.target.value)} placeholder="89049032005008882600003156712345" />
          </div>

          <div>
            <Label>Profil eSIM</Label>
            <Select value={esimProfile} onValueChange={setEsimProfile}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESIM_PROFILES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleActivateEsim} disabled={busy}>
            <QrCode className="mr-1 h-4 w-4" />
            Générer QR Code eSIM
          </Button>
          <Button variant="outline" onClick={handleResendQr} disabled={busy || !esimActive}>
            <Send className="mr-1 h-4 w-4" />
            Envoyer QR au client
          </Button>
        </div>
      </section>
    </div>
  );
}
