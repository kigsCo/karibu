-- 20260601000002_rls_policies.sql
-- Row-level security. RLS is the last line of defense, NOT the only one:
-- edge functions still validate input, rate-limit, and run business logic.
-- Minimum viable policy set — start here, tighten as needed.

-- Enable RLS on every table -------------------------------------------------
ALTER TABLE cities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides            ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations  ENABLE ROW LEVEL SECURITY;

-- Reference data: world-readable (active rows), no client writes ------------
CREATE POLICY "Public reads active cities"    ON cities     FOR SELECT USING (is_active = true);
CREATE POLICY "Public reads active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public reads sub_types"         ON sub_types  FOR SELECT USING (true);

-- Businesses ----------------------------------------------------------------
CREATE POLICY "Public reads active businesses"
  ON businesses FOR SELECT
  USING (status = 'active');

CREATE POLICY "Owner reads own business including pending"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owner updates own business"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Reviews -------------------------------------------------------------------
CREATE POLICY "Public reads published reviews"
  ON reviews FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authenticated users can insert reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND rating BETWEEN 1 AND 5
    AND length(body) >= 40
  );

-- Guides --------------------------------------------------------------------
CREATE POLICY "Public reads published guides"
  ON guides FOR SELECT
  USING (is_published = true);

-- Saved places: only owner sees / manages their own -------------------------
CREATE POLICY "Users manage their saved places"
  ON saved_places FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Subscriptions: only the business owner sees their subscription ------------
CREATE POLICY "Owner reads own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- ai_conversations: no anon/authenticated access. Only the service role
-- (used inside edge functions, which bypasses RLS) writes/reads these.
-- No policies => no client access, which is the intent.
