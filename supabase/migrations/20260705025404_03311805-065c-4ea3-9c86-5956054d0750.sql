
-- =====================================================================
-- BLOC 4 — Déduplication email_queue
-- =====================================================================
-- Audit préalable (confirmé côté agent):
--   • 9007 lignes total, 0 event_key NULL (colonne NOT NULL)
--   • 0 doublon exact sur event_key → UNIQUE peut être appliquée sans purge
--   • 215 lignes avec clé fallback random (q_<email>_<ts>_<rand>) —
--     conservées telles quelles, elles n'entrent pas en conflit entre elles.
--
-- Choix de forme:
--   • UNIQUE (event_key) sur toute la table (pas partiel) — safe car 0 dup
--     et couvre TOUS les inserts (queued/pending/sent/dlq) → un même
--     événement ne peut jamais réapparaître, même après un send raté.
--   • Trigger BEFORE INSERT qui renvoie NULL (skip silencieux) si la clé
--     existe déjà → aucun caller (helper OU insert direct) ne casse.
--   • Le UNIQUE reste comme filet en cas de race concurrente entre le
--     check trigger et le commit.
-- =====================================================================

-- 1) Index UNIQUE sur event_key (0 doublons existants → aucune purge)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='email_queue_event_key_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX email_queue_event_key_unique_idx
      ON public.email_queue(event_key);
  END IF;
END$$;

-- 2) Trigger BEFORE INSERT: silence les tentatives de doublon
CREATE OR REPLACE FUNCTION public._email_queue_skip_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- event_key doit exister (colonne NOT NULL) mais on garde le NULL-check
  IF NEW.event_key IS NULL OR length(NEW.event_key) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.email_queue WHERE event_key = NEW.event_key) THEN
    -- Doublon détecté → skip silencieux, aucune erreur remontée
    RAISE NOTICE '[email_queue] duplicate event_key skipped: %', NEW.event_key;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_queue_dedup ON public.email_queue;
CREATE TRIGGER trg_email_queue_dedup
BEFORE INSERT ON public.email_queue
FOR EACH ROW EXECUTE FUNCTION public._email_queue_skip_duplicate();

-- 3) Index secondaire sur (template_key, entity_id) pour audits/analytics
CREATE INDEX IF NOT EXISTS email_queue_template_entity_idx
  ON public.email_queue(template_key, entity_id)
  WHERE entity_id IS NOT NULL;
