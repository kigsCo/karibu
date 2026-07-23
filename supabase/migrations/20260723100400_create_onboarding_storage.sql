-- 20260723100400_create_onboarding_storage.sql
-- Two buckets for onboarding evidence and listing media.
--
--   verification-docs  PRIVATE. Owner-ID scans. A user may write and read only
--                      their own <uid>/ folder; staff view via short-lived
--                      signed URLs minted by admin-review (service role).
--   business-photos    PUBLIC (listing photos are public content by nature).
--                      Writes still restricted to the uploader's own folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('verification-docs', 'verification-docs', false, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('business-photos', 'business-photos', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- storage.objects already has RLS enabled by the storage extension.

CREATE POLICY "Own folder writes to verification-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Own folder reads of verification-docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Own folder writes to business-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- business-photos needs no SELECT policy: it is a public bucket, reads go
-- through the public object URL.
