import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CryptoPayment {
  id: string;
  order_id: string | null;
  billing_id: string | null;
  client_id: string;
  provider: string;
  payment_id: string | null;
  payment_status: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number | null;
  pay_currency: string;
  pay_address: string | null;
  invoice_url: string | null;
  actually_paid: number | null;
  outcome_amount: number | null;
  outcome_currency: string | null;
  txid: string | null;
  raw_ipn: Record<string, unknown> | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CryptoGatewaySettings {
  id: string;
  provider: string;
  mode: "sandbox" | "production";
  enabled_currencies: string[];
  min_confirmations: number;
  payout_wallet_btc: string | null;
  payout_wallet_eth: string | null;
  payout_wallet_xrp: string | null;
  payout_wallet_sol: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CryptoIPNLog {
  id: string;
  payment_id: string | null;
  crypto_payment_id: string | null;
  event_type: string | null;
  raw_payload: Record<string, unknown>;
  signature_valid: boolean;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}

export function useCryptoGatewaySettings() {
  return useQuery({
    queryKey: ["crypto-gateway-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("provider", "nowpayments")
        .single();

      if (error) throw error;
      return data as CryptoGatewaySettings;
    },
  });
}

export function useUpdateCryptoSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<CryptoGatewaySettings>) => {
      const { data, error } = await supabase
        .from("payment_gateway_settings")
        .update(settings)
        .eq("provider", "nowpayments")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crypto-gateway-settings"] });
      toast({
        title: "Paramètres mis à jour",
        description: "Les paramètres crypto ont été enregistrés.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCryptoPayments() {
  return useQuery({
    queryKey: ["crypto-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CryptoPayment[];
    },
  });
}

export function useCryptoIPNLogs() {
  return useQuery({
    queryKey: ["crypto-ipn-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_ipn_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CryptoIPNLog[];
    },
  });
}

export function useTestCryptoConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-nowpayments-connection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connexion réussie",
          description: data.message,
        });
      } else {
        toast({
          title: "Échec de la connexion",
          description: data.error || "Impossible de se connecter à NOWPayments",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateCryptoPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      orderId?: string;
      billingId?: string;
      clientId: string;
      amountCAD: number;
      currency: string;
      description?: string;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-crypto-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Échec de création du paiement");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crypto-payments"] });
      toast({
        title: "Paiement créé",
        description: "Le paiement crypto a été initialisé.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useReconcileCryptoPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ paymentId, notes }: { paymentId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("crypto_payments")
        .update({
          reconciled_at: new Date().toISOString(),
          reconciled_by: user?.id,
          notes,
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crypto-payments"] });
      toast({
        title: "Paiement réconcilié",
        description: "Le paiement a été marqué comme réconcilié.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
