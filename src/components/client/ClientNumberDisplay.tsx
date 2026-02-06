/**
 * ClientNumberDisplay - Prominent client number display
 * Shows both account number (for billing) and client number (for support)
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hash, Copy, CheckCircle2, Phone, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ClientNumberDisplayProps {
  clientNumber: string | null | undefined;
  accountNumber?: string | null;
  clientName?: string;
}

const ClientNumberDisplay = ({ clientNumber, accountNumber, clientName }: ClientNumberDisplayProps) => {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedClient, setCopiedClient] = useState(false);

  const handleCopyAccount = () => {
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(true);
      toast.success("Numéro de compte copié");
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleCopyClient = () => {
    if (clientNumber) {
      navigator.clipboard.writeText(clientNumber);
      setCopiedClient(true);
      toast.success("Numéro client copié");
      setTimeout(() => setCopiedClient(false), 2000);
    }
  };

  if (!clientNumber && !accountNumber) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/20">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Account Number - Primary (for billing) */}
          {accountNumber && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Numéro de compte</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                    {accountNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">Pour la facturation</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAccount}
                className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
              >
                {copiedAccount ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copier
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Divider if both exist */}
          {accountNumber && clientNumber && (
            <div className="border-t border-border/50" />
          )}

          {/* Client Number - Secondary (for support) */}
          {clientNumber && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Hash className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Numéro client</p>
                  <p className="text-xl font-mono font-bold text-cyan-400 tracking-wider">
                    {clientNumber}
                  </p>
                  {clientName && (
                    <p className="text-sm text-muted-foreground">{clientName}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClient}
                className="border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10"
              >
                {copiedClient ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copier
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-cyan-500/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>Mentionnez ces numéros lors de vos appels au support</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientNumberDisplay;
