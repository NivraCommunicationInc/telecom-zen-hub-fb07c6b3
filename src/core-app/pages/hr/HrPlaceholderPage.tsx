/**
 * HrPlaceholderPage — Temporary placeholder for HR sub-pages not yet fully built.
 */
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

const TITLES: Record<string, string> = {
  payroll: "Paie",
  commissions: "Commissions",
  time: "Temps & Punch",
  schedules: "Horaires",
  documents: "Documents RH",
  "tax-documents": "Documents fiscaux",
  requests: "Demandes RH",
  audit: "Audit RH",
};

export default function HrPlaceholderPage() {
  const location = useLocation();
  const segment = location.pathname.split("/").pop() ?? "";
  const title = TITLES[segment] ?? segment;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <Construction className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ce module sera implémenté dans un prochain bloc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
