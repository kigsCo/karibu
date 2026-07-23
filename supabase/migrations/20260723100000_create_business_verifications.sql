-- 20260723100000_create_business_verifications.sql
-- Registration evidence, deliberately OFF the businesses table: the public
-- SELECT policy exposes whole active rows and RLS cannot hide columns, so a
-- KRA PIN on businesses would leak. 1:1 with the pending listing; written only
-- by the business-intake edge function (service role). The business owner may
-- read their own evidence; nobody else can see or touch it from a client.

CREATE TABLE business_verifications (
  business_id      uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  submitted_by     uuid NOT NULL REFERENCES auth.users(id),
  kra_pin          text NOT NULL CHECK (kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  contact_phone    text NOT NULL CHECK (char_length(contact_phone) <= 20),
  id_document_path text NOT NULL CHECK (char_length(id_document_path) <= 1024),
  applicant_note   text CHECK (char_length(applicant_note) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Every FK gets an index (business_id is the PK already).
CREATE INDEX idx_business_verifications_submitted_by
  ON business_verifications(submitted_by);

ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own verification"
  ON business_verifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies: writes are service-role only.

-- Deterministic grants, local vs cloud (see 20260710160000).
REVOKE ALL ON business_verifications FROM anon, authenticated;
GRANT SELECT ON business_verifications TO authenticated;
GRANT ALL ON business_verifications TO service_role;
