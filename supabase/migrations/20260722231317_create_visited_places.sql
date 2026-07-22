-- 20260722231317_create_visited_places.sql
-- Visit history for signed-in users: one row per (user, business), with
-- visited_at refreshed on each revisit (last-visit-wins). History is
-- therefore "distinct places by recency" and a user's row count is bounded
-- by the number of places that exist, not by how often they browse.
--
-- Owner-only in every direction: users write their own history from the
-- client (no edge function — it is their data, RLS pins each row to
-- auth.uid()), read it on the profile, and Clear History deletes it.
-- Future use: this table is the natural source for the ranking formula's
-- engagement term (profile_views), currently hardcoded 0.

-- 1. Table ------------------------------------------------------------------
CREATE TABLE visited_places (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  visited_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- 2. Indexes ----------------------------------------------------------------
-- The profile list: WHERE user_id = ? ORDER BY visited_at DESC LIMIT n.
CREATE INDEX idx_visited_places_user_recent ON visited_places(user_id, visited_at DESC);
-- FK rule: business_id needs its own index (PK leads with user_id).
CREATE INDEX idx_visited_places_business ON visited_places(business_id);

-- 3. RLS — owner-only, all verbs (saved_places pattern) ---------------------
ALTER TABLE visited_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their visit history"
  ON visited_places FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Grants — deterministic local vs cloud (see 20260710160000) -------------
REVOKE ALL ON visited_places FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON visited_places TO authenticated;
GRANT ALL ON visited_places TO service_role;
