import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Loader2, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { backendClient } from "@/integrations/backend/client";

interface AIImproveButtonProps {
  message: string;
  onApply: (improvedMessage: string) => void;
  context?: "ticket_reply" | "email" | "sms";
  tone?: "professional" | "empathetic" | "urgent";
  disabled?: boolean;
}

export const AIImproveButton: React.FC<AIImproveButtonProps> = ({
  message,
  onApply,
  context = "ticket_reply",
  tone = "professional",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [improvedMessage, setImprovedMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImprove = async () => {
    if (!message.trim() || message.length < 10) {
      toast({
        title: "Message trop court",
        description: "Le message doit contenir au moins 10 caractères.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const { data, error: fnError } = await backendClient.functions.invoke(
        "ai-improve-message",
        {
          body: {
            original_message: message,
            context,
            tone,
          },
        }
      );

      if (fnError) throw fnError;

      if (data?.success && data?.improved) {
        setImprovedMessage(data.improved);
      } else {
        throw new Error(data?.error || "Erreur lors de l'amélioration");
      }
    } catch (err: unknown) {
      console.error("[AIImproveButton] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast({
        title: "Erreur IA",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    onApply(improvedMessage);
    setIsOpen(false);
    setImprovedMessage("");
    toast({
      title: "Message amélioré appliqué",
      description: "Le texte a été remplacé par la version IA.",
    });
  };

  const handleRetry = () => {
    handleImprove();
  };

  const handleClose = () => {
    setIsOpen(false);
    setImprovedMessage("");
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleImprove}
        disabled={disabled || message.length < 10}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Améliorer avec IA
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Assistant IA - Amélioration du message
            </DialogTitle>
            <DialogDescription>
              L'IA a reformulé votre message en style télécom professionnel.
              Vous pouvez modifier la proposition avant de l'appliquer.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Amélioration en cours...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <X className="h-8 w-8 text-destructive" />
              <p className="text-destructive">{error}</p>
              <Button onClick={handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Original</Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border text-sm min-h-[120px] whitespace-pre-wrap">
                  {message}
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Improved */}
              <div className="space-y-2 md:col-span-1 md:-ml-8">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary">Proposition IA</Badge>
                </div>
                <Textarea
                  value={improvedMessage}
                  onChange={(e) => setImprovedMessage(e.target.value)}
                  className="min-h-[120px] text-sm"
                  placeholder="Le message amélioré apparaîtra ici..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button
              onClick={handleApply}
              disabled={!improvedMessage || isLoading}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Remplacer mon message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIImproveButton;
