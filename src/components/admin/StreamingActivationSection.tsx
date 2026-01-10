/**
 * Streaming Activation Section - Admin component for Streaming+ fulfillment
 * Generate/send activation links and promo codes
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  MonitorPlay, Send, RefreshCw, CheckCircle, Clock, 
  AlertCircle, Link2, Loader2, Copy
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createAuditNote } from "@/lib/clientAuditNotes";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StreamingActivationSectionProps {
  orderId: string;
  userId: string;
  clientEmail?: string;
  clientName?: string;
  streamingServices?: string[];
  onUpdate?: () => void;
}

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente", icon: Clock },
  sent: { color: "bg-blue-500/20 text-blue-500", label: "Lien envoyé", icon: Send },
  activated: { color: "bg-emerald-500/20 text-emerald-500", label: "Activé", icon: CheckCircle },
  expired: { color: "bg-red-500/20 text-red-500", label: "Expiré", icon: AlertCircle },
  reissued: { color: "bg-purple-500/20 text-purple-500", label: "Réémis", icon: RefreshCw },
};

export const StreamingActivationSection = ({
  orderId,
  userId,
  clientEmail,
  clientName,
  streamingServices = [],
  onUpdate,
}: StreamingActivationSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [promoCode, setPromoCode] = useState("");
  const [serviceName, setServiceName] = useState(streamingServices[0] || "Streaming+");

  // Fetch activation tokens
  const { data: tokens, refetch } = useQuery({
    queryKey: ["streaming-tokens", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_activation_tokens")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Generate and send activation link
  const sendActivationMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = import.meta.env.VITE_SITE_URL || "https://nivratelecom.ca";
      
      // Insert token record
      const { data: token, error } = await supabase
        .from("streaming_activation_tokens")
        .insert({
          order_id: orderId,
          user_id: userId,
          service_name: serviceName,
          promo_code: promoCode || null,
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user?.id,
          activation_url: `${baseUrl}/activate-streaming`,
        })
        .select()
        .single();

      if (error) throw error;

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'status_changed',
        message: `Lien d'activation Streaming+ envoyé pour ${serviceName}${promoCode ? ` (Code: ${promoCode})` : ''}`,
        metadata: { 
          order_id: orderId, 
          service_name: serviceName, 
          promo_code: promoCode,
          token_id: token.id,
        },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email with activation link
      if (clientEmail) {
        await supabase.functions.invoke("send-streaming-activation-email", {
          body: {
            client_email: clientEmail,
            client_name: clientName,
            service_name: serviceName,
            activation_url: token.activation_url,
            activation_token: token.activation_token,
            promo_code: promoCode,
            expires_at: token.expires_at,
          },
        });
      }

      return token;
    },
    onSuccess: () => {
      toast({ title: "Lien envoyé", description: `Activation ${serviceName} envoyée à ${clientEmail}` });
      setPromoCode("");
      refetch();
      onUpdate?.();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Reissue token
  const reissueMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const baseUrl = import.meta.env.VITE_SITE_URL || "https://nivratelecom.ca";
      
      // Mark old token as reissued
      await supabase
        .from("streaming_activation_tokens")
        .update({ status: "expired" })
        .eq("id", tokenId);

      // Create new token
      const existingToken = tokens?.find(t => t.id === tokenId);
      
      const { data: newToken, error } = await supabase
        .from("streaming_activation_tokens")
        .insert({
          order_id: orderId,
          user_id: userId,
          service_name: existingToken?.service_name || serviceName,
          promo_code: existingToken?.promo_code,
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user?.id,
          reissued_count: (existingToken?.reissued_count || 0) + 1,
          activation_url: `${baseUrl}/activate-streaming`,
        })
        .select()
        .single();

      if (error) throw error;

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'status_changed',
        message: `Lien d'activation Streaming+ réémis pour ${existingToken?.service_name}`,
        metadata: { 
          order_id: orderId, 
          old_token_id: tokenId,
          new_token_id: newToken.id,
        },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send new email
      if (clientEmail) {
        await supabase.functions.invoke("send-streaming-activation-email", {
          body: {
            client_email: clientEmail,
            client_name: clientName,
            service_name: newToken.service_name,
            activation_url: newToken.activation_url,
            activation_token: newToken.activation_token,
            promo_code: newToken.promo_code,
            expires_at: newToken.expires_at,
            is_reissue: true,
          },
        });
      }

      return newToken;
    },
    onSuccess: () => {
      toast({ title: "Lien réémis", description: "Nouveau lien d'activation envoyé" });
      refetch();
      onUpdate?.();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Copié", description: "Token copié dans le presse-papiers" });
  };

  const activeTokens = tokens?.filter(t => t.status === 'sent' || t.status === 'pending') || [];
  const activatedTokens = tokens?.filter(t => t.status === 'activated') || [];

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MonitorPlay className="w-5 h-5 text-purple-500" />
          Volet Streaming+
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active/Sent Tokens */}
        {activeTokens.length > 0 && (
          <div className="space-y-3">
            <Label>Liens actifs</Label>
            {activeTokens.map((token) => {
              const status = statusConfig[token.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              
              return (
                <div key={token.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4" />
                      <span className="font-medium">{token.service_name}</span>
                    </div>
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    {token.promo_code && <p>Code promo: <span className="font-mono">{token.promo_code}</span></p>}
                    <p>Envoyé: {format(new Date(token.sent_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                    <p>Expire: {format(new Date(token.expires_at), "d MMM yyyy", { locale: fr })}</p>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToken(token.activation_token)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier token
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reissueMutation.mutate(token.id)}
                      disabled={reissueMutation.isPending}
                    >
                      {reissueMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Réémettre
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Activated Tokens */}
        {activatedTokens.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              Services activés
            </Label>
            {activatedTokens.map((token) => (
              <div key={token.id} className="p-3 bg-emerald-500/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-600">{token.service_name}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-500">Activé</Badge>
                </div>
                {token.activated_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Activé le {format(new Date(token.activated_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Send New Activation */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Envoyer un lien d'activation
          </Label>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Service</Label>
              <Input
                placeholder="Streaming+ Premium"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Code promo (optionnel)</Label>
              <Input
                placeholder="PROMO2024"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
            </div>
          </div>
          
          <Button
            onClick={() => sendActivationMutation.mutate()}
            disabled={!serviceName || !clientEmail || sendActivationMutation.isPending}
            className="w-full"
          >
            {sendActivationMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Envoyer le lien d'activation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StreamingActivationSection;
