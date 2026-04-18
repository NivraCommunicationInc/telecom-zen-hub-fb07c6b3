
-- 1. marketing_conversations
CREATE TABLE IF NOT EXISTS public.marketing_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  client_id uuid,
  client_name text,
  detected_language text NOT NULL DEFAULT 'fr' CHECK (detected_language IN ('fr','en','ht','es','it','pt')),
  status text NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active','human_takeover','sale_closed','waiting','unresponsive')),
  ai_enabled boolean NOT NULL DEFAULT true,
  discount_offered text DEFAULT 'none' CHECK (discount_offered IN ('none','5_per_month','10_per_month','free_installation')),
  discount_accepted boolean NOT NULL DEFAULT false,
  sale_closed boolean NOT NULL DEFAULT false,
  sale_amount numeric,
  last_message_preview text,
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_conversations_status ON public.marketing_conversations(status);
CREATE INDEX IF NOT EXISTS idx_marketing_conversations_last_msg ON public.marketing_conversations(last_message_at DESC);

ALTER TABLE public.marketing_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing conversations"
  ON public.marketing_conversations FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. marketing_ai_replies
CREATE TABLE IF NOT EXISTS public.marketing_ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.marketing_conversations(id) ON DELETE CASCADE,
  inbound_message text NOT NULL,
  ai_response text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  detected_language text,
  prompt_tokens integer,
  completion_tokens integer,
  sent_via_openphone boolean NOT NULL DEFAULT false,
  openphone_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_ai_replies_conv ON public.marketing_ai_replies(conversation_id, created_at DESC);

ALTER TABLE public.marketing_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read AI replies"
  ON public.marketing_ai_replies FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins insert AI replies"
  ON public.marketing_ai_replies FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. marketing_ai_config (singleton)
CREATE TABLE IF NOT EXISTS public.marketing_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  system_prompt text NOT NULL,
  discount_rules jsonb NOT NULL DEFAULT '{
    "max_per_client": 1,
    "ladder": ["none","5_per_month","10_per_month","free_installation"]
  }'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage AI config"
  ON public.marketing_ai_config FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.marketing_ai_config (is_enabled, model, system_prompt)
SELECT true, 'google/gemini-2.5-pro',
$$You are a sales agent for Nivra Telecom, a Quebec Internet and TV provider. Your goal is to help clients understand the service and guide them to place an order.

COMPANY INFO:
- No contract, no credit check, cancel anytime
- First month 100% FREE
- 30-day money-back guarantee on equipment
- Nivra pays return shipping
- Activation fee: $10, Delivery: $20, WiFi Modem: $60

AVAILABLE DISCOUNTS (maximum 1 per client, never combine):
- Discount 1: $5/month for 24 months ($120 total savings)
- Discount 2: $10/month for 24 months ($240 total savings)
- Discount 3: Free installation by Nivra partner technician

DISCOUNT STRATEGY:
- Start without offering any discount
- If client hesitates → offer Discount 1 ($5/month)
- If still not convinced → upgrade to Discount 2 ($10/month)
- Last resort → offer Discount 3 (free installation)
- Never offer more than 1 discount to same client

LANGUAGE: Always respond in the client's language. Supported: French, English, Haitian Creole, Spanish, Italian, Portuguese. Official documents in French or English only.

ORDER LINK: nivra-telecom.ca/commander

If you cannot answer a question, say you will check with the team and flag for human response.$$
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_ai_config);

-- 4. Link telephony_logs to marketing_conversations
ALTER TABLE public.telephony_logs
  ADD COLUMN IF NOT EXISTS marketing_conversation_id uuid REFERENCES public.marketing_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telephony_logs_marketing_conv ON public.telephony_logs(marketing_conversation_id) WHERE marketing_conversation_id IS NOT NULL;

-- 5. updated_at trigger for marketing_conversations
CREATE OR REPLACE FUNCTION public.tg_marketing_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_marketing_conversations_updated_at ON public.marketing_conversations;
CREATE TRIGGER trg_marketing_conversations_updated_at
  BEFORE UPDATE ON public.marketing_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_conversations_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_ai_config_updated_at ON public.marketing_ai_config;
CREATE TRIGGER trg_marketing_ai_config_updated_at
  BEFORE UPDATE ON public.marketing_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_conversations_updated_at();
