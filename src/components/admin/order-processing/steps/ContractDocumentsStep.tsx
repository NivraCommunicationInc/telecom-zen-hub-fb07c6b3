/**
 * ContractDocumentsStep — Step 8: Contract & Documents
 */
import { Button } from "@/components/ui/button";
import { FileText, Send, RefreshCw, PenTool, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props { proc: any; }

export function ContractDocumentsStep({ proc }: Props) {
  const { order, contracts, invoice } = proc;

  const documents = [
    { type: "Contrat", available: contracts.length > 0, data: contracts[0] },
    { type: "Facture", available: !!invoice, data: invoice },
    { type: "Sommaire de commande", available: true, data: order },
    { type: "Reçu", available: !!invoice?.paid_at, data: invoice },
    { type: "Conditions de service", available: true, data: null },
  ];

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Contrat & Documents</h3>

      <div className="space-y-3">
        {documents.map((doc, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.type}</p>
                {doc.available && doc.data?.created_at && (
                  <p className="text-xs text-gray-500">
                    {format(new Date(doc.data.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {doc.available ? (
                <>
                  <span className="text-xs text-emerald-600 font-medium mr-2">Disponible</span>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-gray-300 text-gray-700">
                    <Eye className="w-3 h-3 mr-1" /> Voir
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-gray-300 text-gray-700">
                    <Send className="w-3 h-3 mr-1" /> Envoyer
                  </Button>
                </>
              ) : (
                <span className="text-xs text-gray-400">Non généré</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contract details */}
      {contracts.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Dernier contrat</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Statut:</span> <span className="font-medium text-gray-900">{contracts[0].status || "—"}</span></div>
            <div><span className="text-gray-500">Version:</span> <span className="font-medium text-gray-900">v{contracts[0].version || 1}</span></div>
            <div><span className="text-gray-500">Signé client:</span> <span className="font-medium text-gray-900">{contracts[0].signed_by_client ? "Oui" : "Non"}</span></div>
            <div><span className="text-gray-500">Signé admin:</span> <span className="font-medium text-gray-900">{contracts[0].signed_by_admin ? "Oui" : "Non"}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button size="sm" variant="outline" className="text-xs h-8 border-gray-300 text-gray-700">
          <RefreshCw className="w-3 h-3 mr-1" /> Régénérer documents
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8 border-gray-300 text-gray-700">
          <PenTool className="w-3 h-3 mr-1" /> Signer contrat
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8 border-gray-300 text-gray-700">
          <Send className="w-3 h-3 mr-1" /> Envoyer tous au client
        </Button>
      </div>
    </div>
  );
}
