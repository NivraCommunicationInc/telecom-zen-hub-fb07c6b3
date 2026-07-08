import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Eye, PackageCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { usePDFViewer } from "@/hooks/usePDFViewer";
import { downloadClientDeliverySlipPDF, generateClientDeliverySlipPDF } from "@/lib/clientDeliverySlip";

interface ClientDeliverySlipsListProps {
  canonicalData: any;
  isLoading?: boolean;
}

export function ClientDeliverySlipsList({ canonicalData, isLoading = false }: ClientDeliverySlipsListProps) {
  const orders = canonicalData?.orders || [];
  const pdfViewer = usePDFViewer();

  const handleView = (order: any) => {
    const result = generateClientDeliverySlipPDF(canonicalData, order);
    if (!result.success || !result.blob) {
      toast.error(result.error || "Bordereau indisponible");
      return;
    }

    pdfViewer.openWithBlob(
      result.blob,
      `Bordereau de livraison — ${order.order_number || order.id?.slice?.(0, 8) || "Commande"}`,
      result.filename || `Bon_Livraison_${order.order_number || order.id}.pdf`,
    );
  };

  const handleDownload = (order: any) => {
    try {
      downloadClientDeliverySlipPDF(canonicalData, order);
      toast.success("Bordereau téléchargé");
    } catch (error: any) {
      toast.error(error?.message || "Téléchargement impossible");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-500" />
            Bordereaux de livraison
          </CardTitle>
          <CardDescription>
            Un bordereau de livraison est disponible pour chaque commande.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order: any) => (
                <div
                  key={order.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg border border-border hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border shrink-0">
                      <PackageCheck className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        Bordereau de livraison — {order.order_number || order.id?.slice?.(0, 8)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(order.created_at || Date.now()), "d MMM yyyy", { locale: fr })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Disponible
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleView(order)}>
                      <Eye className="w-4 h-4" />
                      Voir
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleDownload(order)}>
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Télécharger</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Aucune commande trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PDFViewerDialog
        open={pdfViewer.isOpen}
        onOpenChange={pdfViewer.setOpen}
        pdfBlob={pdfViewer.pdfBlob}
        title={pdfViewer.title}
        filename={pdfViewer.filename}
        isLoading={pdfViewer.isLoading}
        error={pdfViewer.error}
      />
    </>
  );
}

export default ClientDeliverySlipsList;