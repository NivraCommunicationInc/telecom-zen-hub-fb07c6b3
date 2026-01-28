/**
 * POSPaymentFormAdmin - Enhanced payment form for Admin POS
 * Features: PayPal, Interac, Carte, Paiement différé
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Banknote, 
  Clock, 
  Loader2, 
  Check, 
  Copy,
  Mail,
  AlertCircle,
  DollarSign,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";

export type AdminPaymentMethod = "paypal" | "interac" | "card" | "cash" | "deferred";

export interface AdminPaymentData {
  payment_method: AdminPaymentMethod;
  payment_reference?: string;
  paypal_transaction_id?: string;
  paypal_payer_email?: string;
  notes?: string;
}

interface POSPaymentFormAdminProps {
  onSubmit: (data: AdminPaymentData) => void;
  isSubmitting?: boolean;
  totalAmount: number;
}

export function POSPaymentFormAdmin({ onSubmit, isSubmitting, totalAmount }: POSPaymentFormAdminProps) {
  const [method, setMethod] = useState<AdminPaymentMethod>("interac");
  const [reference, setReference] = useState("");
  const [paypalTransactionId, setPaypalTransactionId] = useState("");
  const [paypalPayerEmail, setPaypalPayerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate PayPal transaction ID
    if (method === "paypal" && !paypalTransactionId.trim()) {
      toast.error("Veuillez entrer l'ID de transaction PayPal");
      return;
    }
    
    onSubmit({ 
      payment_method: method, 
      payment_reference: reference || undefined, 
      paypal_transaction_id: paypalTransactionId || undefined,
      paypal_payer_email: paypalPayerEmail || undefined,
      notes: notes || undefined 
    });
  };

  const paymentMethods: { value: AdminPaymentMethod; label: string; icon: React.ReactNode; color: string; badge?: string }[] = [
    { 
      value: "interac", 
      label: "Interac e-Transfer", 
      icon: <Banknote className="h-5 w-5" />, 
      color: "text-emerald-400",
      badge: "Recommandé"
    },
    { 
      value: "paypal", 
      label: "PayPal", 
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z"/>
          <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z"/>
          <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z"/>
        </svg>
      ), 
      color: "text-blue-400"
    },
    { 
      value: "card", 
      label: "Carte de crédit", 
      icon: <CreditCard className="h-5 w-5" />, 
      color: "text-cyan-400"
    },
    { 
      value: "cash", 
      label: "Comptant", 
      icon: <Wallet className="h-5 w-5" />, 
      color: "text-green-400"
    },
    { 
      value: "deferred", 
      label: "Paiement différé", 
      icon: <Clock className="h-5 w-5" />, 
      color: "text-amber-400"
    },
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Mode de paiement
          </span>
          <Badge className="bg-orange-500/20 text-orange-400 border-0 text-lg px-3">
            {totalAmount.toFixed(2)} $
          </Badge>
        </CardTitle>
        <CardDescription className="text-slate-400">
          Sélectionnez le mode de paiement et entrez les informations de transaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Methods */}
          <RadioGroup 
            value={method} 
            onValueChange={(v) => setMethod(v as AdminPaymentMethod)} 
            className="space-y-3"
          >
            {paymentMethods.map((pm) => (
              <div
                key={pm.value}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                  method === pm.value
                    ? "bg-slate-700/50 border-cyan-500/50"
                    : "bg-slate-700/30 border-slate-600/50 hover:border-slate-500/50"
                )}
                onClick={() => setMethod(pm.value)}
              >
                <RadioGroupItem value={pm.value} id={pm.value} />
                <Label htmlFor={pm.value} className={cn("flex items-center gap-2 cursor-pointer flex-1", pm.color)}>
                  {pm.icon}
                  <span className="text-white">{pm.label}</span>
                  {pm.badge && (
                    <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                      {pm.badge}
                    </Badge>
                  )}
                </Label>
                {method === pm.value && (
                  <Check className="w-5 h-5 text-cyan-400" />
                )}
              </div>
            ))}
          </RadioGroup>

          {/* Interac Info */}
          {method === "interac" && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <p className="text-sm font-medium text-white">
                Envoyez le virement Interac à :
              </p>
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Mail className="w-5 h-5 text-emerald-400" />
                <span className="font-mono text-lg flex-1 text-white">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="gap-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copié!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copier
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-slate-400">
                Montant: <span className="text-white font-semibold">{totalAmount.toFixed(2)} $</span>
              </p>
            </div>
          )}

          {/* PayPal Fields */}
          {method === "paypal" && (
            <div className="space-y-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Entrez les informations de la transaction PayPal reçue
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-slate-300">ID de transaction PayPal *</Label>
                  <Input
                    value={paypalTransactionId}
                    onChange={(e) => setPaypalTransactionId(e.target.value)}
                    placeholder="Ex: 5TY123456789ABC"
                    className="bg-slate-700/50 border-slate-600 font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email du payeur</Label>
                  <Input
                    type="email"
                    value={paypalPayerEmail}
                    onChange={(e) => setPaypalPayerEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="bg-slate-700/50 border-slate-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reference for non-deferred payments */}
          {method !== "deferred" && method !== "paypal" && (
            <div>
              <Label className="text-slate-300">Référence de paiement</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="bg-slate-700/50 border-slate-600"
                placeholder={method === "interac" ? "Numéro de confirmation Interac..." : "Numéro de confirmation..."}
              />
            </div>
          )}

          {/* Deferred Warning */}
          {method === "deferred" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                La commande sera créée avec le statut "En attente de paiement"
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-slate-300">Notes internes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-700/50 border-slate-600"
              placeholder="Notes visibles uniquement par le personnel..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full font-bold text-white",
              method === "deferred" 
                ? "bg-amber-500 hover:bg-amber-400"
                : "bg-orange-500 hover:bg-orange-400"
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {method === "deferred" ? "Créer commande en attente" : "Confirmer le paiement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default POSPaymentFormAdmin;
