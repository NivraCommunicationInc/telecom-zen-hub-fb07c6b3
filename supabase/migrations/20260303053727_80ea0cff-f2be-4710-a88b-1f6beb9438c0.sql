
-- Create billing_subscription_services table for multi-line services per subscription
CREATE TABLE public.billing_subscription_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'recurring', -- recurring, one_time, add_on
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_subscription_services ENABLE ROW LEVEL SECURITY;

-- Admin/employee can manage
CREATE POLICY "Staff can manage subscription services"
ON public.billing_subscription_services
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Clients can view their own (via subscription -> customer -> user_id)
CREATE POLICY "Clients can view own subscription services"
ON public.billing_subscription_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM billing_subscriptions bs
    JOIN billing_customers bc ON bc.id = bs.customer_id
    WHERE bs.id = subscription_id AND bc.user_id = auth.uid()
  )
);

-- Index for fast lookups
CREATE INDEX idx_billing_sub_services_sub_id ON public.billing_subscription_services(subscription_id);
CREATE INDEX idx_billing_sub_services_active ON public.billing_subscription_services(subscription_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_billing_subscription_services_updated_at
BEFORE UPDATE ON public.billing_subscription_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
