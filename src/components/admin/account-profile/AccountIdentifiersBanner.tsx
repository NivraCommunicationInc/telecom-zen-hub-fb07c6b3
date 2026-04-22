/**
 * AccountIdentifiersBanner — diagnostic banner showing the canonical
 * identifiers used to load this client's data (account_id, client_id,
 * customer_id, profile email, order count). Helps verify that
 * invoices/payments/contracts are being resolved against the correct
 * customer the admin is currently managing.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  accountId?: string | null;
  clientId?: string | null;
  customerId?: string | null;
  profileEmail?: string | null;
  invoicesCount: number;
  paymentsCount: number;
  contractsCount: number;
  ordersCount: number;
}

export function AccountIdentifiersBanner({
  accountId,
  clientId,
  customerId,
  profileEmail,
  invoicesCount,
  paymentsCount,
  contractsCount,
  ordersCount,
}: Props) {
  const customerLinked = !!customerId;
  const hasFinancialData = invoicesCount + paymentsCount > 0;
  const variant = customerLinked || hasFinancialData ? "default" : "destructive";
  const Icon = customerLinked ? ShieldCheck : hasFinancialData ? CheckCircle2 : AlertTriangle;

  return (
    <Alert variant={variant} className="border-l-4">
      <Icon className="h-4 w-4" />
      <AlertDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold uppercase tracking-wide">Identifiants liés</span>
          <span className="font-mono text-[11px]">
            account_id: <Badge variant="outline" className="font-mono ml-1">{accountId?.slice(0, 8) || "—"}</Badge>
          </span>
          <span className="font-mono text-[11px]">
            user_id: <Badge variant="outline" className="font-mono ml-1">{clientId?.slice(0, 8) || "—"}</Badge>
          </span>
          <span className="font-mono text-[11px]">
            billing_customer_id:{" "}
            <Badge variant={customerLinked ? "outline" : "destructive"} className="font-mono ml-1">
              {customerId?.slice(0, 8) || "non lié"}
            </Badge>
          </span>
          {profileEmail && (
            <span className="font-mono text-[11px]">
              email: <Badge variant="outline" className="font-mono ml-1">{profileEmail}</Badge>
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <Badge variant="secondary">{ordersCount} commandes</Badge>
            <Badge variant="secondary">{invoicesCount} factures</Badge>
            <Badge variant="secondary">{paymentsCount} paiements</Badge>
            <Badge variant="secondary">{contractsCount} contrats</Badge>
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
