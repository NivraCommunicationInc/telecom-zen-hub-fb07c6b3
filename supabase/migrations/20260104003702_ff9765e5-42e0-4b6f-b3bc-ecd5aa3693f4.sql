-- Clean up any potential duplicate user_id entries, keeping the most recent one
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id
  AND a.id < b.id;

-- Drop the old composite unique constraint
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add a single unique constraint on user_id (one role per user model)
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);