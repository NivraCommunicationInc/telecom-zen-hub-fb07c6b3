/**
 * Client Portal - Payments Page
 * 
 * Displays client's payment history and invoices.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, Calendar, DollarSign, FileText } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Payment {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
}

const PortalPayments = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/payments" },
          replace: true 
        });
        return;
      }

      const { data } = await portalSupabase
        .from("billing")
        .select("id, invoice_number, amount, status, created_at, due_date, paid_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setPayments(data || []);
      setIsLoading(false);
    };

    fetchPayments();
  }, [navigate]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };
    const labels: Record<string, string> = {
      paid: isFrench ? "Payé" : "Paid",
      pending: isFrench ? "En attente" : "Pending",
      overdue: isFrench ? "En retard" : "Overdue",
      cancelled: isFrench ? "Annulé" : "Cancelled",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/portal/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isFrench ? "Retour au tableau de bord" : "Back to dashboard"}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          {isFrench ? "Paiements" : "Payments"}
        </h1>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isFrench ? "Aucun paiement trouvé" : "No payments found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {payment.invoice_number || (isFrench ? "Facture" : "Invoice")}
                    </CardTitle>
                    {getStatusBadge(payment.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(payment.created_at), "PPP", { 
                          locale: isFrench ? fr : undefined 
                        })}
                      </div>
                      {payment.due_date && (
                        <div className="text-muted-foreground">
                          {isFrench ? "Échéance:" : "Due:"} {format(new Date(payment.due_date), "PP", { 
                            locale: isFrench ? fr : undefined 
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-medium">
                      <DollarSign className="w-4 h-4" />
                      {payment.amount?.toFixed(2)} $
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalPayments;
