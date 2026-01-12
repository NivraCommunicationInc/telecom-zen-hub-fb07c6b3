-- Add 'pending' value to influencer_status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'influencer_status')
  ) THEN
    ALTER TYPE public.influencer_status ADD VALUE 'pending';
  END IF;
END $$;