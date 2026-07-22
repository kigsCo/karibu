-- 20260722231313_add_reviews_owner_read_policy.sql
-- Let a signed-in reviewer see their OWN reviews in every status. The public
-- SELECT policy exposes published rows only, which meant a user could never
-- see their pending_moderation / rejected reviews — the "Your reviews"
-- profile section needs exactly that. Policies OR together, so this widens
-- visibility only for the review's author; the public still sees published
-- rows and nothing else. SELECT is already granted to authenticated
-- (20260710160000), so a policy is the only missing piece.

CREATE POLICY "Reviewer reads own reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());

-- The profile lists a user's reviews newest-first; without this, that read
-- is a seq scan over all reviews at scale.
CREATE INDEX idx_reviews_reviewer_recent
  ON reviews(reviewer_id, created_at DESC)
  WHERE reviewer_id IS NOT NULL;
