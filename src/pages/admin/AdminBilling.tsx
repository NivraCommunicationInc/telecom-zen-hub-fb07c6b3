/**
 * AdminBilling — DEPRECATED & KILLED
 * 
 * This legacy page read/wrote the `billing` and `payments` tables directly,
 * bypassing the canonical `billing_invoices` / `billing_payments` schema.
 * 
 * All billing operations are now handled by:
 *   - /admin/invoices  → AdminInvoices (billing_invoices)
 *   - /admin/payments  → AdminPaymentsV2 (billing_payments)
 *   - /core/billing    → CoreBillingPage
 * 
 * This page now shows a deprecation notice with links to canonical pages.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, CreditCard, LayoutDashboard } from "lucide-react";

const AdminBilling = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.warn("[AdminBilling] DEPRECATED — Legacy billing page accessed. All write paths have been removed.");
  }, []);

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="max-w-lg w-full border-amber-500/50 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <CardTitle className="text-xl">Page désactivée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            L'ancienne page de facturation a été désactivée. Toutes les opérations
            de facturation et de paiement passent désormais par les consoles canoniques.
          </p>
          <div className="grid gap-2">
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/admin/invoices")}
            >
              <FileText className="h-4 w-4" />
              Factures (Invoices)
            </Button>
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/admin/payments")}
            >
              <CreditCard className="h-4 w-4" />
              Paiements (Payments)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/admin")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Retour au tableau de bord
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBilling;
