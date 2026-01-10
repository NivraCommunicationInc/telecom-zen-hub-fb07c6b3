-- =====================================================
-- MIGRATION: Service Instances + Multi-Service Fulfillment + Realtime
-- =====================================================

-- 1) SERVICE INSTANCES TABLE - Central source of truth for active services
CREATE TABLE IF NOT EXISTS public.service_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  order_id UUID REFERENCES public.orders(id),
  service_type TEXT NOT NULL, -- 'internet', 'tv', 'mobile', 'streaming'
  plan_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, paused, suspended, cancelled, technical_issue
  status_reason TEXT, -- Reason for status change
  status_changed_at TIMESTAMP WITH TIME ZONE,
  status_changed_by UUID,
  monthly_price NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  equipment_details JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_instances ENABLE ROW LEVEL SECURITY;

-- Policies for service_instances
CREATE POLICY "Admins can manage service instances" ON public.service_instances
  FOR ALL USING (true);

CREATE POLICY "Clients can view own service instances" ON public.service_instances
  FOR SELECT USING (auth.uid() = user_id);

-- 2) MOBILE FULFILLMENT TABLE - Port-in, number assignment, SIM shipping
CREATE TABLE IF NOT EXISTS public.mobile_fulfillment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  user_id UUID NOT NULL,
  
  -- Port-in details
  port_in_requested BOOLEAN DEFAULT false,
  port_in_number TEXT,
  port_in_carrier TEXT,
  port_in_account_number TEXT,
  port_in_status TEXT DEFAULT 'pending', -- pending, submitted, in_progress, completed, failed
  port_in_submitted_at TIMESTAMP WITH TIME ZONE,
  port_in_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Number assignment
  assigned_number TEXT,
  number_assigned_at TIMESTAMP WITH TIME ZONE,
  number_assigned_by UUID,
  
  -- SIM shipping
  sim_type TEXT DEFAULT 'physical', -- physical, esim
  sim_iccid TEXT,
  sim_shipped_at TIMESTAMP WITH TIME ZONE,
  sim_carrier TEXT,
  sim_tracking_number TEXT,
  sim_tracking_url TEXT,
  
  -- Activation
  activation_status TEXT DEFAULT 'pending', -- pending, ready, activated, failed
  activated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_fulfillment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage mobile fulfillment" ON public.mobile_fulfillment FOR ALL USING (true);
CREATE POLICY "Clients can view own mobile fulfillment" ON public.mobile_fulfillment FOR SELECT USING (auth.uid() = user_id);

-- 3) STREAMING ACTIVATION TOKENS - For Streaming+ activation links
CREATE TABLE IF NOT EXISTS public.streaming_activation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id),
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  promo_code TEXT,
  activation_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  activation_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, sent, activated, expired, reissued
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID,
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
  reissued_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.streaming_activation_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage streaming tokens" ON public.streaming_activation_tokens FOR ALL USING (true);
CREATE POLICY "Clients can view own streaming tokens" ON public.streaming_activation_tokens FOR SELECT USING (auth.uid() = user_id);

-- 4) Enable REALTIME for orders table (for client portal real-time updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_instances;

-- 5) Function to auto-create service_instance when order is activated/completed
CREATE OR REPLACE FUNCTION public.auto_create_service_instance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create service instance when order reaches installation_completed or completed
  IF (NEW.status IN ('installation_completed', 'completed', 'delivered', 'activated') 
      AND (OLD.status IS NULL OR OLD.status NOT IN ('installation_completed', 'completed', 'delivered', 'activated'))) THEN
    
    -- Check if service instance already exists for this order
    IF NOT EXISTS (SELECT 1 FROM public.service_instances WHERE order_id = NEW.id) THEN
      INSERT INTO public.service_instances (
        user_id,
        account_id,
        order_id,
        service_type,
        plan_name,
        status,
        monthly_price,
        start_date,
        equipment_details
      ) VALUES (
        NEW.user_id,
        NEW.account_id,
        NEW.id,
        COALESCE(NEW.service_type, NEW.category, 'service'),
        NEW.service_type,
        'active',
        COALESCE(NEW.subtotal, NEW.total_amount),
        CURRENT_DATE,
        COALESCE(NEW.equipment_details, '{}'::jsonb)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_create_service_instance ON public.orders;
CREATE TRIGGER trigger_auto_create_service_instance
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_service_instance();

-- 6) Index for performance
CREATE INDEX IF NOT EXISTS idx_service_instances_user_id ON public.service_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_service_instances_status ON public.service_instances(status);
CREATE INDEX IF NOT EXISTS idx_mobile_fulfillment_order_id ON public.mobile_fulfillment(order_id);
CREATE INDEX IF NOT EXISTS idx_streaming_tokens_user_id ON public.streaming_activation_tokens(user_id);