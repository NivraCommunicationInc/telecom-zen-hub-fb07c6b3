-- =====================================================================
-- SECURITY HARDENING: live_chat, realtime broadcasts, public buckets,
-- and SECURITY DEFINER helper functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) live_chat_messages — remove public SELECT, staff-only reads
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone reads chat messages" ON public.live_chat_messages;

CREATE POLICY "Staff can read chat messages"
ON public.live_chat_messages
FOR SELECT
TO authenticated
USING (public.is_marketing_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- 2) realtime.messages — require auth, allow anon for chat topics only
-- ---------------------------------------------------------------------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "anon_can_receive_chat_broadcasts" ON realtime.messages;

-- Authenticated users can subscribe/receive any broadcast (table-level RLS
-- on the source tables still gates what Postgres will publish to them).
CREATE POLICY "authenticated_can_receive_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Anonymous visitors can ONLY subscribe to live-chat channels
-- (NivraChat uses topic 'admin-replies-{sessionId}').
CREATE POLICY "anon_can_receive_chat_broadcasts"
ON realtime.messages
FOR SELECT
TO anon
USING (
  realtime.topic() LIKE 'admin-replies-%'
);

-- ---------------------------------------------------------------------
-- 3) Public buckets — disallow listing, allow only direct path access
-- ---------------------------------------------------------------------
-- installation-guides: replace broad SELECT with a no-op (objects remain
-- accessible via the public CDN URL because the bucket is marked public,
-- but the REST list endpoint will return nothing).
DROP POLICY IF EXISTS "Public read installation-guides" ON storage.objects;

-- phone-photos: same treatment
DROP POLICY IF EXISTS "phone_photos_public_read" ON storage.objects;

-- avatars: scope SELECT to the owner's folder; public CDN URLs still work.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Avatar owners can list their folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- ---------------------------------------------------------------------
-- 4) SECURITY DEFINER helpers — revoke from anon / authenticated
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public._build_doc_client_payload(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._invoke_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._supplier_get_key() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._build_doc_client_payload(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._invoke_edge_function(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._supplier_get_key() TO service_role;