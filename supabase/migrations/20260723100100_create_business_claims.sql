-- 20260723100100_create_business_claims.sql
-- "This is my business" on an existing listing. Carries its own evidence
-- (a claim's target already has public listing data; what we need is proof
-- the claimant runs it). Written only by business-intake (service role);
-- decided only by admin-review. The claimant may read their own claims.

CREATE TABLE business_claims (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimant_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  role_title       text CHECK (char_length(role_title) <= 80),
  kra_pin          text NOT NULL CHECK (kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  contact_phone    text NOT NULL CHECK (char_length(contact_phone) <= 20),
  id_document_path text NOT NULL CHECK (char_length(id_document_path) <= 1024),
  note             text CHECK (char_length(note) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  decided_at       timestamptz
);

-- One open claim per (business, claimant); re-claiming after a rejection is
-- allowed, so the uniqueness is scoped to pending only.
CREATE UNIQUE INDEX idx_business_claims_one_pending
  ON business_claims(business_id, claimant_id) WHERE status = 'pending';
CREATE INDEX idx_business_claims_business ON business_claims(business_id);
CREATE INDEX idx_business_claims_claimant ON business_claims(claimant_id);
-- The admin queue reads pending claims oldest-first.
CREATE INDEX idx_business_claims_pending
  ON business_claims(created_at) WHERE status = 'pending';

ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Claimant reads own claims"
  ON business_claims FOR SELECT
  TO authenticated
  USING (claimant_id = auth.uid());

-- No client writes; business-intake and admin-review use the service role.

REVOKE ALL ON business_claims FROM anon, authenticated;
GRANT SELECT ON business_claims TO authenticated;
GRANT ALL ON business_claims TO service_role;
