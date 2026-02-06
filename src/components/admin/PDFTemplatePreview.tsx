/**
 * PDF Template Preview Component
 * Admin tool to preview and test the 3 billing templates
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Receipt, ShoppingBag } from "lucide-react";
import { 
  useInvoiceMonthlyPDF, 
  useInvoiceOneTimePDF, 
  useOrderSummaryPDF 
} from "@/hooks/usePDFTemplates";
import type { 
  InvoiceMonthlyData, 
  InvoiceOneTimeData, 
  OrderSummaryData 
} from "@/lib/pdf";
import { format } from "date-fns";

// ============================================================================
// SAMPLE DATA
// ============================================================================

const today = new Date().toISOString().split("T")[0];
const cycleStart = today;
const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const SAMPLE_MONTHLY: InvoiceMonthlyData = {
  account_number: "ACC-2026-0001",
  invoice_number: "INV-2026-0123",
  invoice_date: today,
  bill_cycle_date: 1,
  cycle_start: cycleStart,
  cycle_end: cycleEnd,
  status: "pending",
  subtotal_before_discounts: 119.98,
  total_discounts: 10.00,
  subtotal_after_discounts: 109.98,
  tax_gst: 5.50,
  tax_qst: 10.97,
  total_due: 126.45,
  client_name: "Jean-Pierre Tremblay",
  client_email: "jptremblay@example.com",
  client_phone: "514-555-1234",
  client_address: "1234 Rue Principale, Montréal, QC H2X 1Y4",
  invoice_lines: [
    {
      service_type: "Internet",
      service_description: "Fibre 500 Mbps Illimité",
      service_period: `${format(new Date(cycleStart), "dd/MM")} - ${format(new Date(cycleEnd), "dd/MM/yyyy")}`,
      service_price: 79.99,
      service_promo: "-5$",
      service_total: 74.99,
    },
    {
      service_type: "TV",
      service_description: "Forfait Essentiel 60+ chaînes",
      service_period: `${format(new Date(cycleStart), "dd/MM")} - ${format(new Date(cycleEnd), "dd/MM/yyyy")}`,
      service_price: 39.99,
      service_promo: "-5$",
      service_total: 34.99,
    },
  ],
};

const SAMPLE_ONETIME: InvoiceOneTimeData = {
  account_number: "ACC-2026-0001",
  invoice_number: "INV-2026-0124",
  invoice_date: today,
  bill_cycle_date: 1,
  cycle_start: cycleStart,
  cycle_end: cycleEnd,
  status: "paid",
  subtotal_before_discounts: 199.98,
  total_discounts: 0,
  subtotal_after_discounts: 199.98,
  tax_gst: 10.00,
  tax_qst: 19.95,
  total_due: 229.93,
  payment_reference: "PP-8MC585209K746631H",
  client_name: "Marie-Claire Dubois",
  client_email: "mcdubois@example.com",
  client_phone: "438-555-9876",
  client_address: "5678 Boulevard Saint-Laurent, Laval, QC H7T 2Y5",
  order_number: "CMD-2026-0456",
  paid_at: today,
  payment_method: "paypal",
  items: [
    {
      item_name: "Routeur Wi-Fi 6",
      item_description: "Routeur haute performance",
      qty: 1,
      unit_price: 149.99,
      line_total: 149.99,
      serial_number: "RTR-ABC123456",
    },
    {
      item_name: "Frais d'installation",
      item_description: "Installation standard",
      qty: 1,
      unit_price: 49.99,
      line_total: 49.99,
    },
  ],
};

const SAMPLE_ORDER: OrderSummaryData = {
  order_number: "CMD-2026-0789",
  order_date: today,
  account_number: "ACC-2026-0002",
  client_name: "André Gagnon",
  client_email: "agagnon@example.com",
  client_phone: "450-555-4321",
  service_address: "9012 Rue du Commerce, Québec, QC G1V 3X5",
  billing_address: "9012 Rue du Commerce, Québec, QC G1V 3X5",
  services: [
    {
      service_type: "Internet",
      service_description: "Fibre 1 Gbps Illimité",
      service_period: "/mois",
      service_price: 99.99,
      service_total: 99.99,
    },
    {
      service_type: "Mobile",
      service_description: "Forfait 15 Go Canada/USA",
      service_period: "/30 jours",
      service_price: 45.00,
      service_total: 45.00,
    },
  ],
  items: [
    {
      item_name: "Routeur Mesh",
      item_description: "3-pack couverture maison",
      qty: 1,
      unit_price: 199.99,
      line_total: 199.99,
      serial_number: "MESH-XYZ789012",
    },
    {
      item_name: "Carte SIM",
      item_description: "SIM physique",
      qty: 1,
      unit_price: 10.00,
      line_total: 10.00,
    },
  ],
  subtotal_services: 144.99,
  subtotal_equipment: 209.99,
  total_discounts: 20.00,
  subtotal_before_tax: 334.98,
  tax_gst: 16.75,
  tax_qst: 33.41,
  total_due: 385.14,
  payment_status: "paid",
  payment_method: "interac",
  payment_reference: "CA1234567890",
  paid_at: today,
  promo_code: "BIENVENUE20",
  promo_description: "20$ de rabais",
  estimated_activation: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  first_billing_date: cycleEnd,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PDFTemplatePreview() {
  const [activeTab, setActiveTab] = useState("monthly");
  
  const monthlyPDF = useInvoiceMonthlyPDF();
  const oneTimePDF = useInvoiceOneTimePDF();
  const orderPDF = useOrderSummaryPDF();

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Aperçu des Templates PDF
          <Badge variant="outline" className="ml-2">V2</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Facture Mensuelle
            </TabsTrigger>
            <TabsTrigger value="onetime" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Facture One-Time
            </TabsTrigger>
            <TabsTrigger value="order" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Résumé Commande
            </TabsTrigger>
          </TabsList>

          {/* Monthly Invoice */}
          <TabsContent value="monthly" className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Facture Mensuelle (Prépayé style Postpayé)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Template pour les services récurrents (Internet, TV, Mobile). 
                Affiche la période de service, les rabais, et les taxes TPS/TVQ.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => monthlyPDF.open(SAMPLE_MONTHLY)}
                  disabled={monthlyPDF.isGenerating}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => monthlyPDF.download(SAMPLE_MONTHLY)}
                  disabled={monthlyPDF.isGenerating}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Variables:</strong> account_number, invoice_number, invoice_date, 
              cycle_start, cycle_end, status, invoice_lines[], taxes, total_due
            </div>
          </TabsContent>

          {/* One-Time Invoice */}
          <TabsContent value="onetime" className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Facture Équipements/Frais</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Template pour les achats ponctuels (routeur, terminal, frais d'installation).
                Inclut les numéros de série et la quantité.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => oneTimePDF.open(SAMPLE_ONETIME)}
                  disabled={oneTimePDF.isGenerating}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => oneTimePDF.download(SAMPLE_ONETIME)}
                  disabled={oneTimePDF.isGenerating}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Variables:</strong> items[] avec item_name, qty, unit_price, 
              line_total, serial_number
            </div>
          </TabsContent>

          {/* Order Summary */}
          <TabsContent value="order" className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Résumé de Commande</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Confirmation envoyée après paiement. Combine services et équipements
                avec les dates d'activation prévues.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => orderPDF.open(SAMPLE_ORDER)}
                  disabled={orderPDF.isGenerating}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => orderPDF.download(SAMPLE_ORDER)}
                  disabled={orderPDF.isGenerating}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Variables:</strong> order_number, services[], items[], 
              payment_status, promo_code, estimated_activation
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PDFTemplatePreview;
