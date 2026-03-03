
-- Drop the blanket deny policy for anon that blocks the public view
DROP POLICY IF EXISTS "Deny anonymous access to streaming_catalog" ON public.streaming_catalog;

-- Allow anonymous users to read only active streaming catalog items (for public site)
CREATE POLICY "Anon can view active streaming catalog"
ON public.streaming_catalog
FOR SELECT
TO anon
USING (status = 'active'::text);
