-- Add total lockdown settings to site_settings
-- The lockdown password will be stored as a bcrypt hash for security

-- Insert lockdown mode setting (disabled by default)
INSERT INTO public.site_settings (key, value_json)
VALUES (
  'total_lockdown',
  '{"enabled": false, "activated_at": null, "activated_by": null, "message_fr": "Site temporairement verrouillé pour maintenance de sécurité.", "message_en": "Site temporarily locked for security maintenance."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Insert lockdown password hash setting
-- Default password: "NivraSecure2024!" (will be hashed in edge function)
INSERT INTO public.site_settings (key, value_json)
VALUES (
  'lockdown_password_hash',
  '{"hash": null, "last_changed_at": null, "last_changed_by": null}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Create a function to verify lockdown password (to be called from edge function)
CREATE OR REPLACE FUNCTION public.check_lockdown_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value_json FROM public.site_settings WHERE key = 'total_lockdown'),
    '{"enabled": false}'::jsonb
  )
$$;