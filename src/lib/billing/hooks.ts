/**
 * Billing System V2 - React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  BillingCustomer, 
  BillingSubscription, 
  BillingInvoice, 
  BillingPayment,
  CreateSubscriptionRequest,
  ConfirmPaymentRequest
} from './types';

// ============ CUSTOMERS ============

export function useBillingCustomers() {
  return useQuery({
    queryKey: ['billing-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BillingCustomer[];
    }
  });
}

export function useBillingCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['billing-customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .eq('id', customerId)
        .single();
      
      if (error) throw error;
      return data as BillingCustomer;
    },
    enabled: !!customerId
  });
}

export function useBillingCustomerByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['billing-customer-by-user', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as BillingCustomer | null;
    },
    enabled: !!userId
  });
}

// ============ SUBSCRIPTIONS ============

export function useBillingSubscriptions(customerId?: string) {
  return useQuery({
    queryKey: ['billing-subscriptions', customerId],
    queryFn: async () => {
      let query = supabase
        .from('billing_subscriptions')
        .select(`
          *,
          customer:billing_customers(*)
        `)
        .order('created_at', { ascending: false });
      
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as BillingSubscription[];
    }
  });
}

export function useBillingSubscription(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ['billing-subscription', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select(`
          *,
          customer:billing_customers(*)
        `)
        .eq('id', subscriptionId)
        .single();
      
      if (error) throw error;
      return data as BillingSubscription;
    },
    enabled: !!subscriptionId
  });
}

// ============ INVOICES ============

export function useBillingInvoices(filters?: {
  customerId?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['billing-invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('billing_invoices')
        .select(`
          *,
          customer:billing_customers(*),
          subscription:billing_subscriptions(*),
          lines:billing_invoice_lines(*),
          payments:billing_payments(*)
        `)
        .order('created_at', { ascending: false });
      
      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status as 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded');
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as BillingInvoice[];
    }
  });
}

export function useBillingInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['billing-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      
      const { data, error } = await supabase
        .from('billing_invoices')
        .select(`
          *,
          customer:billing_customers(*),
          subscription:billing_subscriptions(*),
          lines:billing_invoice_lines(*),
          payments:billing_payments(*)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (error) throw error;
      return data as BillingInvoice;
    },
    enabled: !!invoiceId
  });
}

// ============ PAYMENTS ============

export function useBillingPayments(invoiceId?: string) {
  return useQuery({
    queryKey: ['billing-payments', invoiceId],
    queryFn: async () => {
      let query = supabase
        .from('billing_payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (invoiceId) {
        query = query.eq('invoice_id', invoiceId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as BillingPayment[];
    }
  });
}

// ============ MUTATIONS ============

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: CreateSubscriptionRequest) => {
      const { data, error } = await supabase.functions.invoke('billing-create-subscription', {
        body: request
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-customers'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    }
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: ConfirmPaymentRequest) => {
      const { data, error } = await supabase.functions.invoke('billing-confirm-payment', {
        body: request
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-payments'] });
    }
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' }) => {
      const { error } = await supabase
        .from('billing_invoices')
        .update({ 
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
    }
  });
}

// ============ STATS ============

export function useBillingStats() {
  return useQuery({
    queryKey: ['billing-stats'],
    queryFn: async () => {
      const [customersRes, subsRes, invoicesRes] = await Promise.all([
        supabase.from('billing_customers').select('status', { count: 'exact' }),
        supabase.from('billing_subscriptions').select('status', { count: 'exact' }),
        supabase.from('billing_invoices').select('status, total', { count: 'exact' })
      ]);
      
      const pendingInvoices = invoicesRes.data?.filter(i => i.status === 'pending') || [];
      const paidInvoices = invoicesRes.data?.filter(i => i.status === 'paid') || [];
      
      return {
        totalCustomers: customersRes.count || 0,
        totalSubscriptions: subsRes.count || 0,
        totalInvoices: invoicesRes.count || 0,
        pendingAmount: pendingInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        paidAmount: paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0)
      };
    }
  });
}
