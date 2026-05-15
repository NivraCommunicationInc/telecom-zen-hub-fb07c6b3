-- New tables for FAQ votes, training progress, and certificates
CREATE TABLE IF NOT EXISTS public.hub_faq_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  faq_id UUID NOT NULL REFERENCES public.hub_faq(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('up','down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, faq_id)
);

ALTER TABLE public.hub_faq
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.hub_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.hub_posts(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.hub_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.hub_posts(id) ON DELETE CASCADE,
  certificate_number TEXT UNIQUE NOT NULL DEFAULT ('CERT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_bonus_rules ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.hub_faq_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_certificates ENABLE ROW LEVEL SECURITY;

-- hub_faq_votes
CREATE POLICY "faq_votes_select_own" ON public.hub_faq_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "faq_votes_insert_own" ON public.hub_faq_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "faq_votes_update_own" ON public.hub_faq_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "faq_votes_delete_own" ON public.hub_faq_votes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "faq_votes_admin_all" ON public.hub_faq_votes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- hub_training_progress
CREATE POLICY "training_progress_select_own" ON public.hub_training_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "training_progress_insert_own" ON public.hub_training_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_progress_update_own" ON public.hub_training_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "training_progress_admin_all" ON public.hub_training_progress FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- hub_certificates
CREATE POLICY "certificates_select_own" ON public.hub_certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "certificates_insert_own" ON public.hub_certificates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "certificates_admin_all" ON public.hub_certificates FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to maintain upvotes/downvotes counts on hub_faq
CREATE OR REPLACE FUNCTION public.hub_faq_votes_recalc()
RETURNS TRIGGER AS $$
DECLARE
  target UUID;
BEGIN
  target := COALESCE(NEW.faq_id, OLD.faq_id);
  UPDATE public.hub_faq SET
    upvotes = (SELECT COUNT(*) FROM public.hub_faq_votes WHERE faq_id = target AND vote = 'up'),
    downvotes = (SELECT COUNT(*) FROM public.hub_faq_votes WHERE faq_id = target AND vote = 'down')
  WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS hub_faq_votes_recalc_trg ON public.hub_faq_votes;
CREATE TRIGGER hub_faq_votes_recalc_trg
AFTER INSERT OR UPDATE OR DELETE ON public.hub_faq_votes
FOR EACH ROW EXECUTE FUNCTION public.hub_faq_votes_recalc();