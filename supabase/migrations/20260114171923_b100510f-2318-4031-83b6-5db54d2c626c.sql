-- Function to increment campaign stats atomically
CREATE OR REPLACE FUNCTION public.increment_campaign_stat(
  p_campaign_id UUID,
  p_field TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.email_campaigns SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    p_field, p_field
  ) USING p_increment, p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to increment automation stats
CREATE OR REPLACE FUNCTION public.increment_automation_stats(
  rule_id UUID,
  triggered_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.email_automation_rules
  SET 
    total_triggered = COALESCE(total_triggered, 0) + triggered_count,
    total_sent = COALESCE(total_sent, 0) + sent_count
  WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;