/**
 * Shared hook: fetches a single quote with all related data.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useQuoteDetail(quoteId: string | undefined) {
  const quoteQuery = useQuery({
    queryKey: ["quote-detail", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes" as any)
        .select("*")
        .eq("id", quoteId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const linesQuery = useQuery({
    queryKey: ["quote-lines", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_lines" as any)
        .select("*")
        .eq("quote_id", quoteId!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["quote-adjustments", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_adjustments" as any)
        .select("*")
        .eq("quote_id", quoteId!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["quote-events", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_events" as any)
        .select("*")
        .eq("quote_id", quoteId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const approvalsQuery = useQuery({
    queryKey: ["quote-approvals", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_approvals" as any)
        .select("*")
        .eq("quote_id", quoteId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch customer profile
  const customerQuery = useQuery({
    queryKey: ["quote-customer", quoteQuery.data?.customer_user_id],
    enabled: !!quoteQuery.data?.customer_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .eq("user_id", quoteQuery.data.customer_user_id)
        .maybeSingle();
      return data;
    },
  });

  const refetchAll = () => {
    quoteQuery.refetch();
    linesQuery.refetch();
    adjustmentsQuery.refetch();
    eventsQuery.refetch();
    approvalsQuery.refetch();
  };

  return {
    quote: quoteQuery.data,
    lines: linesQuery.data || [],
    adjustments: adjustmentsQuery.data || [],
    events: eventsQuery.data || [],
    approvals: approvalsQuery.data || [],
    customer: customerQuery.data,
    isLoading: quoteQuery.isLoading,
    error: quoteQuery.error,
    refetchAll,
  };
}
