-- 20260601000004_rate_limits.sql
-- Abuse-mitigation table in front of RLS (used by _shared/ratelimit.ts).
-- Only the service role (edge functions) touches this table.

CREATE TABLE rate_limits (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip          inet NOT NULL,
  key         text NOT NULL,            -- the action being limited, e.g. 'submit-review'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot-path lookup: count recent hits for (ip, key).
CREATE INDEX idx_rate_limits_ip_key_time ON rate_limits(ip, key, created_at DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies => no anon/authenticated access. The service-role client used
-- inside edge functions bypasses RLS, which is the intent.

-- Prune helper for a nightly cron (keeps the table small):
CREATE OR REPLACE FUNCTION prune_rate_limits() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM rate_limits WHERE created_at < now() - interval '7 days';
$$;
