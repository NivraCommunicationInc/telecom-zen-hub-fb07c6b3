import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, CheckCircle, XCircle, Eye, FileJson } from "lucide-react";
import { useCryptoIPNLogs, CryptoIPNLog } from "@/hooks/useCryptoPayments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

export default function AdminCryptoIPNLogs() {
  const { data: logs, isLoading, refetch } = useCryptoIPNLogs();
  const [selectedLog, setSelectedLog] = useState<CryptoIPNLog | null>(null);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileJson className="h-8 w-8" />
              Logs IPN
            </h1>
            <p className="text-muted-foreground">Historique des webhooks NOWPayments</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Derniers webhooks reçus</CardTitle>
            <CardDescription>
              Les 100 derniers callbacks IPN de NOWPayments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun log IPN trouvé
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead>Traité</TableHead>
                      <TableHead>Erreur</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {log.payment_id ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {log.payment_id.slice(0, 12)}...
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.event_type || "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.signature_valid ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valide
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Invalide
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.processed ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Oui
                            </Badge>
                          ) : (
                            <Badge variant="outline">Non</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.error_message ? (
                            <span className="text-red-600 text-sm">{log.error_message}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total IPN</CardDescription>
              <CardTitle className="text-2xl">{logs?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Signatures valides</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {logs?.filter(l => l.signature_valid).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Signatures invalides</CardDescription>
              <CardTitle className="text-2xl text-red-600">
                {logs?.filter(l => !l.signature_valid).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Erreurs</CardDescription>
              <CardTitle className="text-2xl text-orange-600">
                {logs?.filter(l => l.error_message).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Raw Payload Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payload IPN brut</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment ID</p>
                  <code className="text-sm">{selectedLog.payment_id || "N/A"}</code>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at), "dd MMM yyyy HH:mm:ss", { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Signature</p>
                  <Badge className={selectedLog.signature_valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {selectedLog.signature_valid ? "Valide" : "Invalide"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Traité</p>
                  <Badge variant={selectedLog.processed ? "default" : "outline"}>
                    {selectedLog.processed ? "Oui" : "Non"}
                  </Badge>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700">Erreur</p>
                  <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Payload JSON</p>
                <ScrollArea className="h-80 border rounded-lg">
                  <pre className="p-4 text-xs font-mono">
                    {JSON.stringify(selectedLog.raw_payload, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
