/**
 * Admin Documents Panel — Lots 2-5 (Approved 2026-04-21)
 *
 * Generates on-demand the 17 administrative documents tied to an account,
 * grouped in 4 categories:
 *   • Lot 2 — Compte (4)        : welcome, address, payment method, certificate
 *   • Lot 3 — Suspension (4)    : suspension, cancellation, chargeback, final refund
 *   • Lot 4 — Logistique (4)    : delivery, return, install, activation
 *   • Lot 5 — Légal (5)         : amendment, formal demand, collections, complaint, preauth
 *
 * All client identity data (name/email/phone/address/account) is pre-filled
 * from canonical props. Only document-specific fields require admin input.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, MapPin, CreditCard, BadgeCheck,
  PauseCircle, XCircle, AlertTriangle, RotateCcw,
  Truck, PackageOpen, Wrench, Zap,
  FileEdit, Gavel, ArrowRightCircle, MessageSquare, ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateWelcomeLetterPDF,
  generateAddressChangePDF,
  generatePaymentMethodChangePDF,
  generateServiceCertificatePDF,
  generateSuspensionNoticePDF,
  generateCancellationConfirmationPDF,
  generateChargebackNoticePDF,
  generateFinalRefundReceiptPDF,
  generateDeliverySlipPDF,
  generateReturnInstructionsPDF,
  generateInstallationReportPDF,
  generateActivationConfirmationPDF,
  generateContractAmendmentPDF,
  generateFormalDemandPDF,
  generateCollectionsTransferPDF,
  generateComplaintAcknowledgmentPDF,
  generatePreauthorizationConfirmationPDF,
  downloadPDF,
} from "@/lib/pdf";

interface ClientLike {
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
}

interface AdminDocumentsPanelProps {
  client: ClientLike;
  /** Optional context for pre-filling */
  invoices?: any[];
  subscriptions?: any[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const seq = () => Math.floor(Math.random() * 9000 + 1000).toString();
const yr = () => new Date().getFullYear();
const addDays = (iso: string, days: number) => {
  const d = new Date(iso); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function AdminDocumentsPanel({ client, invoices = [], subscriptions = [] }: AdminDocumentsPanelProps) {
  const [busy, setBusy] = useState(false);
  const safe = async (fn: () => any, label: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.success) { downloadPDF(r); toast.success(`${label} généré ✓`); }
      else toast.error(r?.error || "Erreur de génération");
    } catch (e: any) { toast.error(e?.message || "Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-core-text-primary">
          <FileText className="w-4 h-4 text-emerald-400" />
          Documents administratifs <span className="text-[10px] text-core-text-label font-normal">(17)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-3">
            <TabsTrigger value="account" className="text-[11px]">Compte (4)</TabsTrigger>
            <TabsTrigger value="suspension" className="text-[11px]">Suspension (4)</TabsTrigger>
            <TabsTrigger value="logistics" className="text-[11px]">Logistique (4)</TabsTrigger>
            <TabsTrigger value="legal" className="text-[11px]">Légal (5)</TabsTrigger>
          </TabsList>

          {/* ─────── LOT 2 — COMPTE ─────── */}
          <TabsContent value="account" className="grid grid-cols-2 gap-2">
            <WelcomeLetterDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
            <AddressChangeDialog client={client} safe={safe} busy={busy} />
            <PaymentMethodDialog client={client} safe={safe} busy={busy} />
            <CertificateDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
          </TabsContent>

          {/* ─────── LOT 3 — SUSPENSION ─────── */}
          <TabsContent value="suspension" className="grid grid-cols-2 gap-2">
            <SuspensionDialog client={client} invoices={invoices} subscriptions={subscriptions} safe={safe} busy={busy} />
            <CancellationDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
            <ChargebackDialog client={client} invoices={invoices} safe={safe} busy={busy} />
            <FinalRefundDialog client={client} safe={safe} busy={busy} />
          </TabsContent>

          {/* ─────── LOT 4 — LOGISTIQUE ─────── */}
          <TabsContent value="logistics" className="grid grid-cols-2 gap-2">
            <DeliveryDialog client={client} safe={safe} busy={busy} />
            <ReturnDialog client={client} safe={safe} busy={busy} />
            <InstallReportDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
            <ActivationDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
          </TabsContent>

          {/* ─────── LOT 5 — LÉGAL ─────── */}
          <TabsContent value="legal" className="grid grid-cols-2 gap-2">
            <AmendmentDialog client={client} subscriptions={subscriptions} safe={safe} busy={busy} />
            <FormalDemandDialog client={client} invoices={invoices} safe={safe} busy={busy} />
            <CollectionsDialog client={client} invoices={invoices} safe={safe} busy={busy} />
            <ComplaintDialog client={client} safe={safe} busy={busy} />
            <PreauthDialog client={client} safe={safe} busy={busy} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Reusable trigger button
// ────────────────────────────────────────────────────────────────────────────
function DocButton({ icon: Icon, label, busy }: { icon: any; label: string; busy: boolean }) {
  return (
    <Button variant="outline" size="sm" disabled={busy} className="justify-start text-xs h-9">
      {busy ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Icon className="w-3 h-3 mr-2 text-emerald-400" />}
      {label}
    </Button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOT 2 — COMPTE
// ════════════════════════════════════════════════════════════════════════════

function WelcomeLetterDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [serviceName, setServiceName] = useState(sub?.plan_name || "");
  const [activationDate, setActivationDate] = useState(todayISO());
  const [monthly, setMonthly] = useState(String(sub?.plan_price || ""));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={FileText} label="Lettre bienvenue" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Lettre de bienvenue</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Service activé</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="Internet Fibre 1 Gbps" /></div>
          <div><Label>Date activation</Label><Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} /></div>
          <div><Label>Frais mensuels (taxes incluses)</Label><Input type="number" step="0.01" value={monthly} onChange={e => setMonthly(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!serviceName) return toast.error("Service requis");
            await safe(() => generateWelcomeLetterPDF({
              letter_number: `BVN-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_name: serviceName, activation_date: activationDate,
              monthly_amount: parseFloat(monthly) || 0,
              next_billing_date: addDays(activationDate, 30),
              portal_url: "https://nivra-telecom.ca/portal",
            }), "Lettre de bienvenue");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddressChangeDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPostal, setNewPostal] = useState("");
  const [effective, setEffective] = useState(todayISO());
  const [continuity, setContinuity] = useState<"no_interruption" | "scheduled_interruption" | "reinstall_required">("no_interruption");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={MapPin} label="Changement adresse" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Changement d'adresse</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-[11px] text-core-text-label">Ancienne : {client.client_address}, {client.client_city}</div>
          <div><Label>Nouvelle adresse</Label><Input value={newAddress} onChange={e => setNewAddress(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Ville</Label><Input value={newCity} onChange={e => setNewCity(e.target.value)} /></div>
            <div><Label>Code postal</Label><Input value={newPostal} onChange={e => setNewPostal(e.target.value)} /></div>
          </div>
          <div><Label>Date effective</Label><Input type="date" value={effective} onChange={e => setEffective(e.target.value)} /></div>
          <div><Label>Continuité de service</Label>
            <Select value={continuity} onValueChange={v => setContinuity(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_interruption">Aucune interruption</SelectItem>
                <SelectItem value="scheduled_interruption">Interruption planifiée</SelectItem>
                <SelectItem value="reinstall_required">Réinstallation requise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!newAddress) return toast.error("Nouvelle adresse requise");
            await safe(() => generateAddressChangePDF({
              notice_number: `ADR-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              old_address: client.client_address || "", old_city: client.client_city,
              old_province: client.client_province, old_postal: client.client_postal,
              new_address: newAddress, new_city: newCity, new_province: "QC", new_postal: newPostal,
              effective_date: effective, service_continuity: continuity,
            }), "Changement d'adresse");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMethodDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [oldMethod, setOldMethod] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [autopay, setAutopay] = useState(true);
  const [effective, setEffective] = useState(todayISO());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={CreditCard} label="Changement paiement" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Changement mode de paiement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Ancien mode</Label><Input value={oldMethod} onChange={e => setOldMethod(e.target.value)} placeholder="Carte ****1234" /></div>
          <div><Label>Nouveau mode</Label><Input value={newMethod} onChange={e => setNewMethod(e.target.value)} placeholder="PayPal — exemple@email.com" /></div>
          <div><Label>Date effective</Label><Input type="date" value={effective} onChange={e => setEffective(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={autopay} onCheckedChange={setAutopay} /><Label>Paiement automatique activé</Label></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!oldMethod || !newMethod) return toast.error("Modes requis");
            await safe(() => generatePaymentMethodChangePDF({
              notice_number: `MDP-${yr()}-${seq()}`, issue_date: todayISO(),
              client_name: client.client_name, client_email: client.client_email, account_number: client.account_number,
              old_method: oldMethod, new_method: newMethod, effective_date: effective, autopay_enabled: autopay,
            }), "Changement mode de paiement");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CertificateDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [serviceName, setServiceName] = useState(sub?.plan_name || "");
  const [activationDate, setActivationDate] = useState(sub?.cycle_start_date || todayISO());
  const [monthly, setMonthly] = useState(String(sub?.plan_price || ""));
  const [purpose, setPurpose] = useState("Preuve d'adresse");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={BadgeCheck} label="Attestation service" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Attestation de service actif</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Service</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} /></div>
          <div><Label>Date d'activation</Label><Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} /></div>
          <div><Label>Frais mensuels</Label><Input type="number" step="0.01" value={monthly} onChange={e => setMonthly(e.target.value)} /></div>
          <div><Label>Motif (optionnel)</Label><Input value={purpose} onChange={e => setPurpose(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!serviceName) return toast.error("Service requis");
            await safe(() => generateServiceCertificatePDF({
              certificate_number: `ATT-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_address: client.client_address || "", service_city: client.client_city,
              service_province: client.client_province, service_postal: client.client_postal,
              service_name: serviceName, activation_date: activationDate, status: "Actif",
              monthly_amount: parseFloat(monthly) || 0, purpose,
            }), "Attestation de service");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOT 3 — SUSPENSION
// ════════════════════════════════════════════════════════════════════════════

function SuspensionDialog({ client, invoices, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [serviceName, setServiceName] = useState(sub?.plan_name || "");
  const [reason, setReason] = useState("Solde impayé");
  const [suspensionDate, setSuspensionDate] = useState(todayISO());
  const unpaid = invoices.filter((i: any) => (i.balance_due ?? 0) > 0);
  const totalDue = unpaid.reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0);
  const [amountDue, setAmountDue] = useState(String(totalDue.toFixed(2)));
  const [reactivationFee, setReactivationFee] = useState("25");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={PauseCircle} label="Avis suspension" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avis de suspension de service</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Service concerné</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} /></div>
          <div><Label>Motif</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div><Label>Date de suspension</Label><Input type="date" value={suspensionDate} onChange={e => setSuspensionDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Solde dû</Label><Input type="number" step="0.01" value={amountDue} onChange={e => setAmountDue(e.target.value)} /></div>
            <div><Label>Frais réactivation</Label><Input type="number" step="0.01" value={reactivationFee} onChange={e => setReactivationFee(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            await safe(() => generateSuspensionNoticePDF({
              notice_number: `SUS-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_name: serviceName, reason, suspension_date: suspensionDate,
              amount_due: parseFloat(amountDue) || 0,
              invoice_numbers: unpaid.map((i: any) => i.invoice_number).filter(Boolean),
              reactivation_fee: parseFloat(reactivationFee) || 0,
              reactivation_instructions: "Régler le solde dû et les frais de réactivation par PayPal, virement Interac ou par carte via le portail client.",
            }), "Avis de suspension");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancellationDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [serviceName, setServiceName] = useState(sub?.plan_name || "");
  const [cancellationDate, setCancellationDate] = useState(todayISO());
  const [effectiveDate, setEffectiveDate] = useState(addDays(todayISO(), 30));
  const [reason, setReason] = useState("");
  const [finalBalance, setFinalBalance] = useState("0");
  const [equipment, setEquipment] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={XCircle} label="Confirmation annulation" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmation d'annulation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Service annulé</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date demande</Label><Input type="date" value={cancellationDate} onChange={e => setCancellationDate(e.target.value)} /></div>
            <div><Label>Date effective</Label><Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></div>
          </div>
          <div><Label>Motif</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Déménagement, insatisfaction, etc." /></div>
          <div><Label>Solde final (positif = dû / négatif = remboursement)</Label><Input type="number" step="0.01" value={finalBalance} onChange={e => setFinalBalance(e.target.value)} /></div>
          <div><Label>Équipements à retourner (un par ligne)</Label><Textarea value={equipment} onChange={e => setEquipment(e.target.value)} rows={2} placeholder="Borne WiFi&#10;Terminal TV" /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            await safe(() => generateCancellationConfirmationPDF({
              confirmation_number: `ANL-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_name: serviceName, cancellation_date: cancellationDate, effective_date: effectiveDate,
              reason, final_balance: parseFloat(finalBalance) || 0,
              equipment_to_return: equipment.split("\n").map(s => s.trim()).filter(Boolean),
            }), "Confirmation d'annulation");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargebackDialog({ client, invoices, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [invId, setInvId] = useState("");
  const [chargebackAmount, setChargebackAmount] = useState("");
  const [chargebackDate, setChargebackDate] = useState(todayISO());
  const [bankRef, setBankRef] = useState("");
  const [reactivationFee, setReactivationFee] = useState("25");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={AlertTriangle} label="Avis chargeback" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avis de chargeback</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Facture concernée</Label>
            <Select value={invId} onValueChange={setInvId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {invoices.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {(i.total ?? 0).toFixed(2)} $</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Montant rétrofacturé</Label><Input type="number" step="0.01" value={chargebackAmount} onChange={e => setChargebackAmount(e.target.value)} /></div>
          <div><Label>Date du chargeback</Label><Input type="date" value={chargebackDate} onChange={e => setChargebackDate(e.target.value)} /></div>
          <div><Label>Référence bancaire</Label><Input value={bankRef} onChange={e => setBankRef(e.target.value)} /></div>
          <div><Label>Frais réactivation</Label><Input type="number" step="0.01" value={reactivationFee} onChange={e => setReactivationFee(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const inv = invoices.find((i: any) => i.id === invId);
            if (!inv) return toast.error("Facture requise");
            const cb = parseFloat(chargebackAmount) || 0;
            const rf = parseFloat(reactivationFee) || 0;
            await safe(() => generateChargebackNoticePDF({
              notice_number: `CHB-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              invoice_number: inv.invoice_number, invoice_date: (inv.created_at || todayISO()).slice(0, 10),
              invoice_amount: inv.total || 0, chargeback_amount: cb, chargeback_date: chargebackDate,
              bank_reference: bankRef, reactivation_fee: rf,
              total_due: cb + rf, response_deadline: addDays(todayISO(), 10),
            }), "Avis de chargeback");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalRefundDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Virement Interac");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("Remboursement final lors de fermeture de compte");
  const [accountClosed, setAccountClosed] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={RotateCcw} label="Remboursement final" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reçu de remboursement final</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Montant remboursé</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Méthode</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Virement Interac">Virement Interac</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
                <SelectItem value="Remboursement carte">Remboursement carte</SelectItem>
                <SelectItem value="Crédit au compte">Crédit au compte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Référence</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
          <div><Label>Motif</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={accountClosed} onCheckedChange={setAccountClosed} /><Label>Compte fermé</Label></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const amt = parseFloat(amount);
            if (!amt || amt <= 0) return toast.error("Montant invalide");
            await safe(() => generateFinalRefundReceiptPDF({
              receipt_number: `RFN-${yr()}-${seq()}`, issue_date: todayISO(),
              client_name: client.client_name, client_email: client.client_email, account_number: client.account_number,
              refund_amount: amt, refund_method: method, reference_number: reference,
              processed_date: todayISO(), reason, account_closed: accountClosed,
            }), "Remboursement final");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOT 4 — LOGISTIQUE
// ════════════════════════════════════════════════════════════════════════════

function DeliveryDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("Postes Canada");
  const [tracking, setTracking] = useState("");
  const [eta, setEta] = useState(addDays(todayISO(), 3));
  const [items, setItems] = useState("Borne WiFi Nivra | NV-WIFI-001\nTerminal TV | NV-TV-001");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={Truck} label="Bon de livraison" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bon de livraison</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Transporteur</Label><Input value={carrier} onChange={e => setCarrier(e.target.value)} /></div>
            <div><Label>Suivi</Label><Input value={tracking} onChange={e => setTracking(e.target.value)} /></div>
          </div>
          <div><Label>Date livraison estimée</Label><Input type="date" value={eta} onChange={e => setEta(e.target.value)} /></div>
          <div><Label>Articles (description | numéro de série)</Label>
            <Textarea value={items} onChange={e => setItems(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const parsed = items.split("\n").map(l => {
              const [desc, sn] = l.split("|").map(s => s.trim());
              return desc ? { description: desc, serial_number: sn || undefined, quantity: 1 } : null;
            }).filter(Boolean) as any[];
            if (parsed.length === 0) return toast.error("Au moins 1 article requis");
            await safe(() => generateDeliverySlipPDF({
              slip_number: `BLV-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              delivery_address: client.client_address || "", delivery_city: client.client_city,
              delivery_province: client.client_province, delivery_postal: client.client_postal,
              carrier, tracking_number: tracking, estimated_delivery: eta, items: parsed,
            }), "Bon de livraison");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState(addDays(todayISO(), 14));
  const [items, setItems] = useState("Borne WiFi Nivra | NV-WIFI-001\nTerminal TV | NV-TV-001");
  const [fee, setFee] = useState("60");
  const [rma, setRma] = useState(`RMA-${yr()}-${seq()}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={PackageOpen} label="Instructions retour" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Instructions de retour d'équipement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date limite retour</Label><Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
          <div><Label>Articles à retourner (description | numéro de série)</Label>
            <Textarea value={items} onChange={e => setItems(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Frais non-retour</Label><Input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} /></div>
            <div><Label>N° RMA</Label><Input value={rma} onChange={e => setRma(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const parsed = items.split("\n").map(l => {
              const [desc, sn] = l.split("|").map(s => s.trim());
              return desc ? { description: desc, serial_number: sn || undefined } : null;
            }).filter(Boolean) as any[];
            if (parsed.length === 0) return toast.error("Au moins 1 article requis");
            await safe(() => generateReturnInstructionsPDF({
              instruction_number: `RTN-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              return_deadline: deadline,
              return_address: "Nivra Telecom — Service retours, 1234 boul. Industriel",
              return_city: "Montréal", return_province: "QC", return_postal: "H1A 1A1",
              items: parsed, non_return_fee: parseFloat(fee) || 0,
              return_method: "Postes Canada — étiquette prépayée fournie", rma_number: rma,
            }), "Instructions de retour");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstallReportDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [techName, setTechName] = useState("");
  const [techId, setTechId] = useState("");
  const [apptDate, setApptDate] = useState(todayISO());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [serviceInstalled, setServiceInstalled] = useState(sub?.plan_name || "");
  const [equipment, setEquipment] = useState("Borne WiFi Nivra | NV-WIFI-001");
  const [outcome, setOutcome] = useState<"success" | "partial" | "failed">("success");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={Wrench} label="Rapport installation" busy={busy} /></div></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Rapport d'installation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Technicien</Label><Input value={techName} onChange={e => setTechName(e.target.value)} /></div>
            <div><Label>Référence technicien (optionnel)</Label><Input value={techId} onChange={e => setTechId(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Date</Label><Input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} /></div>
            <div><Label>Début</Label><Input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><Label>Fin</Label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div><Label>Service installé</Label><Input value={serviceInstalled} onChange={e => setServiceInstalled(e.target.value)} /></div>
          <div><Label>Équipement (description | numéro de série)</Label>
            <Textarea value={equipment} onChange={e => setEquipment(e.target.value)} rows={2} />
          </div>
          <div><Label>Résultat</Label>
            <Select value={outcome} onValueChange={v => setOutcome(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Réussite</SelectItem>
                <SelectItem value="partial">Partielle</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!techName) return toast.error("Technicien requis");
            const parsed = equipment.split("\n").map(l => {
              const [desc, sn] = l.split("|").map(s => s.trim());
              return desc ? { description: desc, serial_number: sn || undefined } : null;
            }).filter(Boolean) as any[];
            await safe(() => generateInstallationReportPDF({
              report_number: `INS-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_address: client.client_address || "", service_city: client.client_city,
              service_province: client.client_province, service_postal: client.client_postal,
              technician_name: techName, technician_id: techId,
              appointment_date: apptDate, start_time: start, end_time: end,
              service_installed: serviceInstalled, equipment_installed: parsed,
              outcome, notes, client_signature_required: true,
            }), "Rapport d'installation");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivationDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [serviceName, setServiceName] = useState(sub?.plan_name || "");
  const [serviceType, setServiceType] = useState<"mobile" | "internet" | "tv" | "other">("internet");
  const [activationDate, setActivationDate] = useState(todayISO());
  const [phone, setPhone] = useState("");
  const [iccid, setIccid] = useState("");
  const [speed, setSpeed] = useState("");
  const [monthly, setMonthly] = useState(String(sub?.plan_price || ""));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={Zap} label="Confirmation activation" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmation d'activation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Service</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={serviceType} onValueChange={v => setServiceType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="tv">TV</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Date activation</Label><Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} /></div>
          {serviceType === "mobile" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Numéro tél.</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div><Label>ICCID SIM</Label><Input value={iccid} onChange={e => setIccid(e.target.value)} /></div>
            </div>
          )}
          {serviceType === "internet" && (
            <div><Label>Vitesse</Label><Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="1 Gbps" /></div>
          )}
          <div><Label>Frais mensuels</Label><Input type="number" step="0.01" value={monthly} onChange={e => setMonthly(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!serviceName) return toast.error("Service requis");
            await safe(() => generateActivationConfirmationPDF({
              confirmation_number: `ACT-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              service_name: serviceName, service_type: serviceType, activation_date: activationDate,
              phone_number: phone || undefined, sim_iccid: iccid || undefined, internet_speed: speed || undefined,
              monthly_amount: parseFloat(monthly) || 0,
              first_billing_cycle: `${activationDate} — ${addDays(activationDate, 30)}`,
            }), "Confirmation d'activation");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOT 5 — LÉGAL
// ════════════════════════════════════════════════════════════════════════════

function AmendmentDialog({ client, subscriptions, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const sub = subscriptions[0];
  const [origNumber, setOrigNumber] = useState(`CON-${yr() - 1}-001`);
  const [origDate, setOrigDate] = useState(sub?.cycle_start_date || todayISO());
  const [effective, setEffective] = useState(todayISO());
  const [changes, setChanges] = useState("Forfait | Internet 500 Mbps | Internet 1 Gbps");
  const [newMonthly, setNewMonthly] = useState(String(sub?.plan_price || ""));
  const [reason, setReason] = useState("Mise à niveau du forfait");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={FileEdit} label="Avenant contrat" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avenant au contrat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>N° contrat original</Label><Input value={origNumber} onChange={e => setOrigNumber(e.target.value)} /></div>
            <div><Label>Date contrat original</Label><Input type="date" value={origDate} onChange={e => setOrigDate(e.target.value)} /></div>
          </div>
          <div><Label>Date d'effet</Label><Input type="date" value={effective} onChange={e => setEffective(e.target.value)} /></div>
          <div><Label>Modifications (champ | ancienne valeur | nouvelle valeur)</Label>
            <Textarea value={changes} onChange={e => setChanges(e.target.value)} rows={3} />
          </div>
          <div><Label>Nouveau montant mensuel</Label><Input type="number" step="0.01" value={newMonthly} onChange={e => setNewMonthly(e.target.value)} /></div>
          <div><Label>Motif</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const parsed = changes.split("\n").map(l => {
              const [field, ov, nv] = l.split("|").map(s => s.trim());
              return field ? { field, old_value: ov || "", new_value: nv || "" } : null;
            }).filter(Boolean) as any[];
            if (parsed.length === 0) return toast.error("Au moins 1 modification requise");
            await safe(() => generateContractAmendmentPDF({
              amendment_number: `AVN-${yr()}-${seq()}`, issue_date: todayISO(),
              client_name: client.client_name, client_email: client.client_email, account_number: client.account_number,
              original_contract_number: origNumber, original_contract_date: origDate,
              effective_date: effective, changes: parsed,
              new_monthly_amount: parseFloat(newMonthly) || undefined, reason,
            }), "Avenant au contrat");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormalDemandDialog({ client, invoices, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const unpaid = invoices.filter((i: any) => (i.balance_due ?? 0) > 0);
  const totalDue = unpaid.reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={Gavel} label="Avis final de régularisation" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avis final de régularisation</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[12px]">
          <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400">
            ⚠ Document légal — réserver aux comptes en recouvrement avancé.
          </div>
          <div>Total dû : <strong>{totalDue.toFixed(2)} $</strong></div>
          <div>Factures impayées : <strong>{unpaid.length}</strong></div>
          <div>Échéance de réponse : <strong>10 jours ouvrables</strong></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (unpaid.length === 0) return toast.error("Aucune facture impayée");
            await safe(() => generateFormalDemandPDF({
              demand_number: `MED-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              total_due: totalDue,
              invoices: unpaid.map((i: any) => ({
                invoice_number: i.invoice_number, invoice_date: (i.created_at || todayISO()).slice(0, 10),
                amount: i.balance_due ?? 0,
                days_overdue: Math.max(0, Math.floor((Date.now() - new Date(i.due_date || i.created_at).getTime()) / 86400000)),
              })),
              response_deadline: addDays(todayISO(), 10), legal_basis: "C.c.Q. art. 1594",
            }), "Avis final de régularisation");
            setOpen(false);
          }} variant="destructive">Générer l'avis final de régularisation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectionsDialog({ client, invoices, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const unpaid = invoices.filter((i: any) => (i.balance_due ?? 0) > 0);
  const totalTransferred = unpaid.reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0);
  const [agencyName, setAgencyName] = useState("Agence de recouvrement Québec inc.");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [reference, setReference] = useState("");
  const [reportCredit, setReportCredit] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={ArrowRightCircle} label="Transfert recouvrement" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avis de transfert au recouvrement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-red-400 text-[12px]">
            ⚠ Action irréversible — signale le compte aux bureaux de crédit.
          </div>
          <div>Montant transféré : <strong>{totalTransferred.toFixed(2)} $</strong></div>
          <div><Label>Nom de l'agence</Label><Input value={agencyName} onChange={e => setAgencyName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Téléphone agence</Label><Input value={agencyPhone} onChange={e => setAgencyPhone(e.target.value)} /></div>
            <div><Label>Courriel agence</Label><Input value={agencyEmail} onChange={e => setAgencyEmail(e.target.value)} /></div>
          </div>
          <div><Label>Référence dossier</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={reportCredit} onCheckedChange={setReportCredit} /><Label>Signalé aux bureaux de crédit</Label></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (totalTransferred <= 0) return toast.error("Aucun solde à transférer");
            await safe(() => generateCollectionsTransferPDF({
              notice_number: `RCV-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              total_transferred: totalTransferred,
              collection_agency_name: agencyName, collection_agency_phone: agencyPhone,
              collection_agency_email: agencyEmail, collection_agency_reference: reference,
              transfer_effective_date: todayISO(), credit_bureau_reported: reportCredit,
            }), "Transfert recouvrement");
            setOpen(false);
          }} variant="destructive">Générer le transfert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComplaintDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [received, setReceived] = useState(todayISO());
  const [summary, setSummary] = useState("");
  const [caseNum, setCaseNum] = useState(`CAS-${yr()}-${seq()}`);
  const [agent, setAgent] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={MessageSquare} label="Accusé plainte" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Accusé de réception de plainte</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date réception plainte</Label><Input type="date" value={received} onChange={e => setReceived(e.target.value)} /></div>
          <div><Label>Résumé de la plainte</Label><Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>N° dossier</Label><Input value={caseNum} onChange={e => setCaseNum(e.target.value)} /></div>
            <div><Label>Agent assigné</Label><Input value={agent} onChange={e => setAgent(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!summary) return toast.error("Résumé requis");
            await safe(() => generateComplaintAcknowledgmentPDF({
              acknowledgment_number: `ACK-${yr()}-${seq()}`, issue_date: todayISO(), ...client,
              complaint_received_date: received, complaint_summary: summary,
              case_number: caseNum, assigned_agent: agent || undefined,
              expected_resolution_date: addDays(received, 14),
              next_step: "Un membre de notre équipe vous contactera par courriel dans les 10 jours ouvrables.",
            }), "Accusé de plainte");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreauthDialog({ client, safe, busy }: any) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [purpose, setPurpose] = useState("Garantie d'équipement");
  const [captureDeadline, setCaptureDeadline] = useState(addDays(todayISO(), 7));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div><DocButton icon={ShieldCheck} label="Pré-autorisation" busy={busy} /></div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmation de pré-autorisation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Montant autorisé</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Mode de paiement</Label><Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Carte ****1234" /></div>
          <div><Label>Motif</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Garantie d'équipement">Garantie d'équipement</SelectItem>
                <SelectItem value="Pré-autorisation commande">Pré-autorisation commande</SelectItem>
                <SelectItem value="Caution chargeback">Caution chargeback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date limite de capture</Label><Input type="date" value={captureDeadline} onChange={e => setCaptureDeadline(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const amt = parseFloat(amount);
            if (!amt || amt <= 0) return toast.error("Montant invalide");
            if (!paymentMethod) return toast.error("Mode de paiement requis");
            await safe(() => generatePreauthorizationConfirmationPDF({
              confirmation_number: `PAU-${yr()}-${seq()}`, issue_date: todayISO(),
              client_name: client.client_name, client_email: client.client_email, account_number: client.account_number,
              authorized_amount: amt, payment_method: paymentMethod,
              capture_deadline: captureDeadline, purpose,
            }), "Pré-autorisation");
            setOpen(false);
          }}>Générer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdminDocumentsPanel;
