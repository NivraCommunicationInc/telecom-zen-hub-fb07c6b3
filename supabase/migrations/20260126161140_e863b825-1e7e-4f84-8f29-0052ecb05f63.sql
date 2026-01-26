-- ============================================
-- CLIENT PROFILE IMPROVEMENTS - Phase 2
-- 1. Create avatars storage bucket
-- 2. Add avatar_url to profiles
-- 3. Enable RLS for avatar storage
-- ============================================

-- 1. Create avatars storage bucket (public for display)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Add avatar_url to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  
  -- Add last_login_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. RLS policies for avatar storage
-- Allow anyone to view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Create client profile change log table for transparency
CREATE TABLE IF NOT EXISTS public.client_profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by_id UUID NOT NULL,
  changed_by_role TEXT NOT NULL DEFAULT 'client', -- 'client', 'admin', 'staff'
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on profile changes
ALTER TABLE public.client_profile_changes ENABLE ROW LEVEL SECURITY;

-- Clients can view their own profile change history
CREATE POLICY "Clients can view own profile changes"
ON public.client_profile_changes
FOR SELECT
USING (auth.uid() = client_id);

-- Clients can insert their own profile changes
CREATE POLICY "Clients can log own profile changes"
ON public.client_profile_changes
FOR INSERT
WITH CHECK (auth.uid() = client_id AND changed_by_id = auth.uid());

-- Admins can view all profile changes
CREATE POLICY "Admins can view all profile changes"
ON public.client_profile_changes
FOR SELECT
USING (public.is_admin());

-- Admins can insert profile changes for any client
CREATE POLICY "Admins can log profile changes"
ON public.client_profile_changes
FOR INSERT
WITH CHECK (public.is_admin());

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_client_profile_changes_client_id 
ON public.client_profile_changes(client_id);

CREATE INDEX IF NOT EXISTS idx_client_profile_changes_created_at 
ON public.client_profile_changes(created_at DESC);