-- ==============================================================================
-- NOVA Digital Brain — extended reasoning log columns
-- ==============================================================================
-- The new nova-brain function (Sonnet 4.7 + tool use + caching) writes richer
-- log entries than the original schema supported. We ADD columns (never rename
-- or drop) so existing consumers continue to work.
-- ==============================================================================

ALTER TABLE public.nova_reasoning_log
  ADD COLUMN IF NOT EXISTS model         text,                    -- e.g. "claude-sonnet-4-7"
  ADD COLUMN IF NOT EXISTS input_messages jsonb,                  -- full message array sent to Claude
  ADD COLUMN IF NOT EXISTS output_text   text,                    -- final assistant text
  ADD COLUMN IF NOT EXISTS tools_called  jsonb,                   -- [{name, input, output, ok}, ...]
  ADD COLUMN IF NOT EXISTS usage         jsonb,                   -- {input_tokens, output_tokens, cache_*}
  ADD COLUMN IF NOT EXISTS duration_ms   int;

-- Index for the obvious dashboard queries (most recent + by conversation)
CREATE INDEX IF NOT EXISTS idx_nova_reasoning_log_created_at
  ON public.nova_reasoning_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nova_reasoning_log_conversation
  ON public.nova_reasoning_log (conversation_id, created_at DESC);

-- Record the migration
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'NOVA_REASONING_LOG_EXTENDED',
  'info',
  jsonb_build_object(
    'description', 'Added model/input_messages/output_text/tools_called/usage/duration_ms columns for richer NOVA audit',
    'applied_at', now()
  )
);
