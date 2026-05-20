
-- Add public token for anonymous complaint tracking
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS complaints_public_token_idx
  ON public.complaints(public_token);

-- Public read RPC: returns sanitized complaint + non-internal responses by public token
CREATE OR REPLACE FUNCTION public.get_complaint_by_public_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_complaint public.complaints%ROWTYPE;
  v_responses jsonb;
BEGIN
  SELECT * INTO v_complaint FROM public.complaints WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'author_name', r.author_name,
    'response_text', r.response_text,
    'created_at', r.created_at
  ) ORDER BY r.created_at ASC), '[]'::jsonb)
  INTO v_responses
  FROM public.complaint_responses r
  WHERE r.complaint_id = v_complaint.id AND r.is_internal = false;

  RETURN jsonb_build_object(
    'id', v_complaint.id,
    'ticket_number', v_complaint.ticket_number,
    'status', v_complaint.status,
    'category', v_complaint.category,
    'priority', v_complaint.priority,
    'subject', v_complaint.subject,
    'description', v_complaint.description,
    'submitted_by_name', v_complaint.submitted_by_name,
    'created_at', v_complaint.created_at,
    'updated_at', v_complaint.updated_at,
    'resolved_at', v_complaint.resolved_at,
    'closed_at', v_complaint.closed_at,
    'responses', v_responses
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complaint_by_public_token(uuid) TO anon, authenticated;
