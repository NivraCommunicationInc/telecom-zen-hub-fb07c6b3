
-- Enums
DO $$ BEGIN
  CREATE TYPE public.square_orphan_detection_reason AS ENUM (
    'not_in_billing_payments',
    'cmd_reference_no_order',
    'webhook_missed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.square_orphan_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'ignored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.square_orphan_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  square_payment_id TEXT NOT NULL UNIQUE,
  square_receipt_url TEXT,
  amount_cents BIGINT,
  currency TEXT DEFAULT 'CAD',
  square_created_at TIMESTAMPTZ,
  note TEXT,
  buyer_email_address TEXT,
  buyer_display_name TEXT,
  detection_reason public.square_orphan_detection_reason NOT NULL,
  status public.square_orphan_status NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  linked_payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_square_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_square_orphan_alerts_status ON public.square_orphan_alerts(status);
CREATE INDEX IF NOT EXISTS idx_square_orphan_alerts_square_created_at ON public.square_orphan_alerts(square_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_orphan_alerts_detection_reason ON public.square_orphan_alerts(detection_reason);

-- Grants
GRANT SELECT, UPDATE ON public.square_orphan_alerts TO authenticated;
GRANT ALL ON public.square_orphan_alerts TO service_role;

-- RLS
ALTER TABLE public.square_orphan_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_view_orphan_alerts" ON public.square_orphan_alerts;
CREATE POLICY "staff_view_orphan_alerts" ON public.square_orphan_alerts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

DROP POLICY IF EXISTS "staff_update_orphan_alerts" ON public.square_orphan_alerts;
CREATE POLICY "staff_update_orphan_alerts" ON public.square_orphan_alerts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_touch_square_orphan_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_square_orphan_alerts ON public.square_orphan_alerts;
CREATE TRIGGER trg_touch_square_orphan_alerts
  BEFORE UPDATE ON public.square_orphan_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_touch_square_orphan_alerts();

COMMENT ON TABLE public.square_orphan_alerts IS
  'Paiements Square détectés sans commande/facture/paiement Nivra correspondant. Alimentée par la edge fn square-orphan-reconciliation (cron 15 min).';
