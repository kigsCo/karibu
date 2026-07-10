-- 20260710150000_harden_payments_and_review_abuse.sql
-- Schema support for the mpesa-callback and submit-review security fixes.
--
-- Companion to the edge-function changes in the same commit. Nothing here
-- changes existing rows or RLS; it adds one column, one uniqueness guarantee,
-- and one index.

-- ---------------------------------------------------------------------------
-- 1. Record the M-Pesa receipt that settled a subscription.
-- ---------------------------------------------------------------------------
-- mpesa_transaction_id holds the CheckoutRequestID (assigned when the STK push
-- is *initiated*, and knowable by anyone who can trigger a push). The receipt
-- number is issued by Safaricom only when money actually moves, so it is what
-- reconciliation should key on.
--
-- The UNIQUE constraint is a second replay guard behind the callback's
-- pending_payment status check: one receipt can settle at most one
-- subscription, even if a callback is delivered twice or forged. NULLs are not
-- compared in Postgres, so the many not-yet-paid subscriptions coexist fine.
ALTER TABLE subscriptions
  ADD COLUMN mpesa_receipt_number text;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_mpesa_receipt_number_key UNIQUE (mpesa_receipt_number);

COMMENT ON COLUMN subscriptions.mpesa_receipt_number IS
  'Safaricom receipt from the settling callback. Proof money moved; unique per payment.';

-- ---------------------------------------------------------------------------
-- 2. Index the per-user review rate limits.
-- ---------------------------------------------------------------------------
-- submit-review now counts a reviewer''s own recent reviews on every submission,
-- twice: once across all businesses (24h window) and once for the target
-- business (30d window). Both are served by this index -- the second and third
-- columns narrow the per-business query, and reviewer_id alone leads the
-- per-user one. Without it each submission would sequentially scan `reviews`.
CREATE INDEX idx_reviews_reviewer_business_time
  ON reviews (reviewer_id, business_id, created_at DESC);
