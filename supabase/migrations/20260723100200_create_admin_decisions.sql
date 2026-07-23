-- 20260723100200_create_admin_decisions.sql
-- The decision log FIX_PLAN task 24 requires: every approve/reject of a
-- registration or claim leaves a row saying who did it, to what, and why.
-- RLS is enabled with ZERO policies and zero client grants — only the
-- service role (admin-review) can read or write. Append-only by convention.

CREATE TABLE admin_decisions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type text NOT NULL CHECK (subject_type IN ('registration','claim')),
  subject_id   uuid NOT NULL,
  action       text NOT NULL CHECK (action IN ('approved','rejected')),
  reason       text CHECK (char_length(reason) <= 2000),
  decided_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_decisions_subject ON admin_decisions(subject_type, subject_id);
CREATE INDEX idx_admin_decisions_decided_by ON admin_decisions(decided_by);

ALTER TABLE admin_decisions ENABLE ROW LEVEL SECURITY;
-- No policies: a table with RLS on and no policies denies everything except
-- the service role, which is exactly the contract.

REVOKE ALL ON admin_decisions FROM anon, authenticated;
GRANT ALL ON admin_decisions TO service_role;
