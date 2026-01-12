-- Add UNIQUE constraint on influencers.user_id for proper upsert
ALTER TABLE public.influencers ADD CONSTRAINT influencers_user_id_unique UNIQUE (user_id);