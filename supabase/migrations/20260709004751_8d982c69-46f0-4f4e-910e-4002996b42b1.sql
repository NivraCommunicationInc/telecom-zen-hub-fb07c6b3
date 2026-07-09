-- Link kyc_requests to identity_verification_sessions so account-level
-- KYC requests (no order_id) can mirror uploaded documents into the
-- canonical identity_verification_sessions row that Client 360 reads.
ALTER TABLE public.kyc_requests
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES public.identity_verification_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_requests_session_id
  ON public.kyc_requests(session_id);