import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { deduplicatedClients, type ClientToImport } from "@/data/squareClientsToImport";

interface ImportResult {
  success: boolean;
  name: string;
  email: string | null;
  phone: string;
  user_id?: string;
  error?: string;
}

interface BulkImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Use deduplicated clients from Square CSV export (limited to 600 for safety)
const clientsToImport: ClientToImport[] = deduplicatedClients.slice(0, 600);

export function BulkImportClientsDialog({ open, onOpenChange }: BulkImportClientsDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(clientsToImport.length / BATCH_SIZE);

  const handleImport = async () => {
    setIsImporting(true);
    setResults([]);
    setProgress(0);
    setCurrentBatch(0);

    const allResults: ImportResult[] = [];

    for (let i = 0; i < clientsToImport.length; i += BATCH_SIZE) {
      const batch = clientsToImport.slice(i, i + BATCH_SIZE);
      setCurrentBatch(Math.floor(i / BATCH_SIZE) + 1);

      try {
        const { data, error } = await supabase.functions.invoke('admin-bulk-import-clients', {
          body: { clients: batch }
        });

        if (error) {
          console.error('Batch import error:', error);
          batch.forEach(client => {
            allResults.push({
              success: false,
              name: client.name,
              email: client.email,
              phone: client.phone,
              error: error.message || 'Erreur de lot'
            });
          });
        } else if (data?.results) {
          allResults.push(...data.results);
        }
      } catch (err: any) {
        console.error('Batch error:', err);
        batch.forEach(client => {
          allResults.push({
            success: false,
            name: client.name,
            email: client.email,
            phone: client.phone,
            error: err.message || 'Erreur inconnue'
          });
        });
      }

      setResults([...allResults]);
      setProgress(((i + BATCH_SIZE) / clientsToImport.length) * 100);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < clientsToImport.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    
    const successCount = allResults.filter(r => r.success).length;
    const errorCount = allResults.filter(r => !r.success).length;

    toast({
      title: "Import terminé",
      description: `${successCount} clients importés, ${errorCount} erreurs`,
      variant: errorCount > 0 ? "destructive" : "default"
    });
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse des clients Square
          </DialogTitle>
          <DialogDescription>
            Cette opération va importer {clientsToImport.length} clients depuis le fichier CSV Square exporté.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isImporting && results.length === 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Résumé de l'import:</strong>
              </p>
              <ul className="text-sm space-y-1">
                <li>• {clientsToImport.length} clients à importer</li>
                <li>• Les clients avec téléphone en double ont été dédupliqués</li>
                <li>• Les emails valides sont prioritaires</li>
                <li>• Import par lots de {BATCH_SIZE} clients</li>
              </ul>
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Lot {currentBatch} / {totalBatches}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Import en cours...
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {successCount} succès
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} erreurs
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-2">
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`text-xs p-2 rounded flex items-start gap-2 ${
                        result.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{result.name}</span>
                        <span className="text-muted-foreground ml-2">({result.phone})</span>
                        {result.error && (
                          <p className="text-red-600 dark:text-red-400 truncate">{result.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            {results.length > 0 ? 'Fermer' : 'Annuler'}
          </Button>
          {results.length === 0 && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Lancer l'import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
