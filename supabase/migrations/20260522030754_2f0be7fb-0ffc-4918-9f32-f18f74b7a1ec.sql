
-- Extend nova_memory allowed types
ALTER TABLE public.nova_memory DROP CONSTRAINT IF EXISTS nova_memory_memory_type_check;
ALTER TABLE public.nova_memory ADD CONSTRAINT nova_memory_memory_type_check
  CHECK (memory_type = ANY (ARRAY['company','personal_oldo','contextual','learned','decision','market','agent_insight','oldo_clone','reasoning_log']));

-- Pinned conversations
ALTER TABLE public.nova_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS nova_conversations_pinned_idx ON public.nova_conversations(pinned, updated_at DESC);

-- Reasoning log
CREATE TABLE IF NOT EXISTS public.nova_reasoning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.nova_conversations(id) ON DELETE CASCADE,
  user_message TEXT,
  reasoning_chain JSONB,
  context_snapshot JSONB,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.nova_reasoning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nova_reasoning_admin_all" ON public.nova_reasoning_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
