/**
 * Hook for e-Transfer payment proofs
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";

export interface PaymentProof {
  id: string;
  payment_id: string;
  client_id: string;
  proof_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  sender_name: string | null;
  sender_bank: string | null;
  transfer_date: string | null;
  transfer_amount: number | null;
  transfer_reference: string | null;
  notes: string | null;
  verification_status: string;
  verified_at: string | null;
  verified_by_id: string | null;
  verified_by_name: string | null;
  verification_notes: string | null;
  auto_matched: boolean;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitProofData {
  paymentId: string;
  senderName?: string;
  senderBank?: string;
  transferDate?: string;
  transferAmount?: number;
  transferReference?: string;
  notes?: string;
  file?: File;
}

/**
 * Hook to fetch proofs for a specific payment
 */
export function usePaymentProofs(paymentId: string | undefined) {
  return useQuery({
    queryKey: ["payment-proofs", paymentId],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from('payment_proofs')
        .select('*')
        .eq('payment_id', paymentId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PaymentProof[];
    },
    enabled: !!paymentId,
  });
}

/**
 * Hook to fetch all pending proofs (for Admin)
 */
export function usePendingProofs() {
  return useQuery({
    queryKey: ["pending-payment-proofs"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from('payment_proofs')
        .select(`
          *,
          billing:payment_id (
            id,
            invoice_number,
            amount,
            user_id,
            client_email,
            status,
            etransfer_reference
          )
        `)
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to submit a payment proof (Client)
 */
export function useSubmitProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubmitProofData) => {
      // Get current user
      const { data: { user } } = await backendClient.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;

      // Upload file if provided
      if (data.file) {
        const ext = data.file.name.split('.').pop();
        const path = `${user.id}/${data.paymentId}-${Date.now()}.${ext}`;
        
        const { error: uploadError } = await backendClient.storage
          .from('payment-proofs')
          .upload(path, data.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = backendClient.storage
          .from('payment-proofs')
          .getPublicUrl(path);

        fileUrl = urlData.publicUrl;
        fileName = data.file.name;
        fileSize = data.file.size;
      }

      // Insert proof record
      const { data: proof, error } = await backendClient
        .from('payment_proofs')
        .insert({
          payment_id: data.paymentId,
          client_id: user.id,
          proof_type: 'etransfer',
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          sender_name: data.senderName || null,
          sender_bank: data.senderBank || null,
          transfer_date: data.transferDate || null,
          transfer_amount: data.transferAmount || null,
          transfer_reference: data.transferReference || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return proof;
    },
    onSuccess: (_, variables) => {
      toast.success("Preuve de paiement soumise");
      queryClient.invalidateQueries({ queryKey: ["payment-proofs", variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ["pending-payment-proofs"] });
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la soumission: " + error.message);
    },
  });
}

/**
 * Hook to verify a proof (Admin/Employee)
 */
export function useVerifyProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proofId,
      paymentId,
      status,
      notes,
      verifierName,
    }: {
      proofId: string;
      paymentId: string;
      status: 'verified' | 'rejected' | 'fraud';
      notes?: string;
      verifierName?: string;
    }) => {
      const { data: { user } } = await backendClient.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Update proof
      const { error: proofError } = await backendClient
        .from('payment_proofs')
        .update({
          verification_status: status,
          verified_at: new Date().toISOString(),
          verified_by_id: user.id,
          verified_by_name: verifierName || user.email,
          verification_notes: notes,
        })
        .eq('id', proofId);

      if (proofError) throw proofError;

      // ============================================================
      // LEGACY BILLING UPDATE - Source of truth: billing table
      // TODO: Migrate to billing_invoices V2 + billing_payments
      // Date: 2026-01-24 - Backlog migration complète
      // ============================================================
      if (status === 'verified') {
        const { error: billingError } = await backendClient
          .from('billing')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            captured_at: new Date().toISOString(),
            etransfer_status: 'complete',
          })
          .eq('id', paymentId);

        if (billingError) throw billingError;
      } else if (status === 'rejected' || status === 'fraud') {
        const { error: billingError } = await backendClient
          .from('billing')
          .update({
            etransfer_status: status === 'fraud' ? 'fraud' : 'declined',
          })
          .eq('id', paymentId);

        if (billingError) throw billingError;
      }

      return { proofId, status };
    },
    onSuccess: (data) => {
      const statusLabel = {
        verified: 'Paiement vérifié et complété',
        rejected: 'Preuve rejetée',
        fraud: 'Signalé comme fraude',
      }[data.status];
      
      toast.success(statusLabel);
      queryClient.invalidateQueries({ queryKey: ["payment-proofs"] });
      queryClient.invalidateQueries({ queryKey: ["pending-payment-proofs"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
      queryClient.invalidateQueries({ queryKey: ["client-billing-unpaid"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export default usePaymentProofs;
