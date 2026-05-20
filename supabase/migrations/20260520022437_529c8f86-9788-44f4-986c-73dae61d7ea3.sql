
ALTER TABLE public.interview_answers
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_lang text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-videos', 'interview-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Admins & supervisors can read
DROP POLICY IF EXISTS "interview_videos_admin_read" ON storage.objects;
CREATE POLICY "interview_videos_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'interview-videos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);

-- Public anonymous upload only when path starts with a valid, not-yet-completed interview token.
-- Path convention: "<interview_token>/<question_id>.webm"
DROP POLICY IF EXISTS "interview_videos_public_upload" ON storage.objects;
CREATE POLICY "interview_videos_public_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'interview-videos'
  AND EXISTS (
    SELECT 1 FROM public.job_applicants ja
    WHERE ja.interview_token::text = split_part(name, '/', 1)
      AND ja.interview_completed_at IS NULL
  )
);
