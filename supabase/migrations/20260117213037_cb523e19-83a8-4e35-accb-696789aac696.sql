-- Add partner terms acceptance tracking to influencers table
ALTER TABLE public.influencers
ADD COLUMN IF NOT EXISTS accepted_partner_terms_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS partner_terms_version VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN public.influencers.accepted_partner_terms_at IS 'Timestamp when partner accepted the partner program terms and conditions';
COMMENT ON COLUMN public.influencers.partner_terms_version IS 'Version of the partner terms that was accepted (e.g., v1.0, v2.0)';