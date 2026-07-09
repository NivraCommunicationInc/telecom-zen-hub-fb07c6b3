/**
 * AccountStateBanner — Customer-facing state banner.
 *
 * Reads the canonical account state and renders a coloured banner with an
 * explanation + appropriate CTA. Returns null when the state is "active"
 * so an active customer sees a clean dashboard.
 *
 * Used at the top of the client portal dashboard.
 */
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccountState } from "@/hooks/useAccountState";
import { explainState, type AccountState } from "@/lib/accountState";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  accountId: string | null | undefined;
  /** Hide entirely when the account is in an OK state. Default: true. */
  hideWhenActive?: boolean;
}

interface BannerStyle {
  /** Outer container classes — gradient + border for the state */
  container: string;
  /** Icon + accent text colour */
  accent: string;
  /** Primary CTA button variant */
  buttonClass: string;
}

const STYLE_BY_STATE: Partial<Record<AccountState, BannerStyle>> = {
  suspended_non_payment: {
    container: "bg-red-50 border-red-200",
    accent: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  pending_payment: {
    container: "bg-amber-50 border-amber-200",
    accent: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  pending_kyc: {
    container: "bg-blue-50 border-blue-200",
    accent: "text-blue-600",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  pending_activation: {
    container: "bg-blue-50 border-blue-200",
    accent: "text-blue-600",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  cancelled: {
    container: "bg-slate-50 border-slate-200",
    accent: "text-slate-600",
    buttonClass: "bg-slate-700 hover:bg-slate-800 text-white",
  },
  closed: {
    container: "bg-slate-50 border-slate-200",
    accent: "text-slate-600",
    buttonClass: "bg-slate-700 hover:bg-slate-800 text-white",
  },
  new: {
    container: "bg-blue-50 border-blue-200",
    accent: "text-blue-600",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

const ICON_BY_STATE: Partial<Record<AccountState, React.ComponentType<{ className?: string }>>> = {
  suspended_non_payment: XCircle,
  pending_payment: AlertTriangle,
  pending_kyc: AlertCircle,
  pending_activation: Clock,
  cancelled: XCircle,
  closed: XCircle,
  new: CheckCircle2,
  active: CheckCircle2,
};

interface CTA {
  label: string;
  to: string;
  external?: boolean;
}

function ctaForState(state: AccountState, isFr: boolean): CTA | null {
  switch (state) {
    case "suspended_non_payment":
    case "pending_payment":
      return {
        label: isFr ? "Payer maintenant" : "Pay now",
        to: "/portal/billing",
      };
    case "pending_kyc":
      return {
        label: isFr ? "Vérifier mon identité" : "Verify my identity",
        to: "/portal/identity-verification",
      };
    case "pending_activation":
      return {
        label: isFr ? "Suivre ma commande" : "Track my order",
        to: "/portal/orders",
      };
    case "cancelled":
    case "new":
      return {
        label: isFr ? "Commander un service" : "Order a service",
        to: "/commander",
      };
    case "closed":
      return {
        label: isFr ? "Contacter le support" : "Contact support",
        to: "/contact",
      };
    default:
      return null;
  }
}

export default function AccountStateBanner({ accountId, hideWhenActive = true }: Props) {
  const { state, isLoading } = useAccountState(accountId);
  const { language } = useLanguage();
  const isFr = language === "fr";

  if (isLoading || !state) return null;
  if (hideWhenActive && state.state === "active") return null;
  if (state.state === "not_found") return null;

  const style = STYLE_BY_STATE[state.state];
  const Icon = ICON_BY_STATE[state.state] ?? AlertCircle;
  const cta = ctaForState(state.state, isFr);

  if (!style) return null;

  const title = isFr ? state.label_fr : state.label_en;
  const explanation = explainState(state, isFr ? "fr" : "en");

  return (
    <div
      role="alert"
      className={`rounded-xl border-2 p-5 ${style.container}`}
      data-testid="account-state-banner"
      data-state={state.state}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${style.accent}`} />
          <div>
            <h2 className={`text-lg font-bold ${style.accent}`}>{title}</h2>
            <p className="mt-1 text-sm text-foreground/80">{explanation}</p>
            {state.signals.overdue_invoices > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground/70">
                <Mail className="h-3 w-3" />
                {isFr
                  ? "Un courriel détaillant le solde dû vous a été envoyé."
                  : "A detailed email about the outstanding balance has been sent to you."}
              </p>
            )}
          </div>
        </div>
        {cta && (
          <Button asChild className={`flex-shrink-0 ${style.buttonClass}`}>
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
