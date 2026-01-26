/**
 * ClientNumberDisplay - Prominent client number display
 * Makes client number easily accessible for support calls
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hash, Copy, CheckCircle2, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ClientNumberDisplayProps {
  clientNumber: string | null | undefined;
  clientName?: string;
}

const ClientNumberDisplay = ({ clientNumber, clientName }: ClientNumberDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (clientNumber) {
      navigator.clipboard.writeText(clientNumber);
      setCopied(true);
      toast.success("Numéro client copié");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!clientNumber) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Hash className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Numéro client</p>
              <p className="text-2xl font-mono font-bold text-cyan-400 tracking-wider">
                {clientNumber}
              </p>
              {clientName && (
                <p className="text-sm text-muted-foreground">{clientName}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10"
            >
              {copied ? (
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
        </div>
        <div className="mt-3 pt-3 border-t border-cyan-500/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>Mentionnez ce numéro lors de vos appels au support</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientNumberDisplay;
