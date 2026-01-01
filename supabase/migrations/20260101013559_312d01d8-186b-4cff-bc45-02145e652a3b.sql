-- Add columns for enhanced order management
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS id_verification_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS id_verification_notes text,
ADD COLUMN IF NOT EXISTS id_verified_by uuid,
ADD COLUMN IF NOT EXISTS id_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS risk_flags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS audit_timeline jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS equipment_details jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS terminal_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS router_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS terminal_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_type text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS processed_by uuid,
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;