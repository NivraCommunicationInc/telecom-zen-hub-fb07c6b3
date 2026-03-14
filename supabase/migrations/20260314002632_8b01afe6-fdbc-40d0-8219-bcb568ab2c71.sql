
-- Transaction events log for full telecom-grade traceability
CREATE TABLE public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'checkout',
  status TEXT NOT NULL DEFAULT 'info',
  order_number TEXT,
  order_id TEXT,
  invoice_number TEXT,
  payment_number TEXT,
  payment_reference TEXT,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'CAD',
  error_message TEXT,
  error_code TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'client',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast operational queries
CREATE INDEX idx_transaction_events_user_id ON public.transaction_events(user_id);
CREATE INDEX idx_transaction_events_event_type ON public.transaction_events(event_type);
CREATE INDEX idx_transaction_events_order_number ON public.transaction_events(order_number);
CREATE INDEX idx_transaction_events_created_at ON public.transaction_events(created_at DESC);
CREATE INDEX idx_transaction_events_session ON public.transaction_events(session_id);
CREATE INDEX idx_transaction_events_status ON public.transaction_events(status);

-- RLS
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own events
CREATE POLICY "Users can insert own events"
  ON public.transaction_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Clients can read their own events (for in-progress visibility)
CREATE POLICY "Users can read own events"
  ON public.transaction_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all events
CREATE POLICY "Admins can read all events"
  ON public.transaction_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Employees can read all events
CREATE POLICY "Employees can read all events"
  ON public.transaction_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

-- Service role (edge functions) can insert any event
CREATE POLICY "Service role can insert events"
  ON public.transaction_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Enable realtime for admin dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_events;
