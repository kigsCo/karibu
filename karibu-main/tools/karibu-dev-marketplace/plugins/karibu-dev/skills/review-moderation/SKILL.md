---
name: review-moderation
description: Use when implementing or altering the moderate-reviews pipeline — the hourly cron that classifies pending reviews with Claude and publishes or flags them. Covers the 5-axis JSON classification prompt, the publish-if-all-clean rule, and the anti-abuse signals (per-IP / per-user limits, burst detection, fingerprint, sentiment-rating mismatch). Notes that RLS does not replace moderation.
---

# Review moderation pipeline

Reviews are the heart of ranking, so they must be trustworthy. `moderate-reviews` is an **hourly cron** edge function that takes `reviews` rows in `status = 'pending_moderation'`, classifies each with Claude, and transitions it to `published` or `flagged`/`rejected`. RLS keeps unpublished reviews hidden from the public, but **RLS does not replace moderation** — it only controls who can read a row, not whether the content is acceptable.

## When to use
Implementing/altering `supabase/functions/moderate-reviews`, changing the classification prompt, or adjusting anti-abuse thresholds.

## Where reviews come from
The `submit-review` function (request-path) inserts a review as `pending_moderation`. The `idx_reviews_moderation` partial index (`WHERE status = 'pending_moderation'`) makes the queue cheap to scan. Moderation runs **off the request path** — submission never waits on Claude.

## Hourly cron flow
1. Select a batch of `reviews WHERE status = 'pending_moderation'` (oldest first, bounded batch).
2. **Anti-abuse pre-checks** (below) on each review's metadata — cheap signals first; obvious abuse is flagged without spending a Claude call.
3. For the rest, call Claude with the **5-axis classification prompt** (below). Use the service-role client and read `ANTHROPIC_API_KEY` from `Deno.env` (never the client).
4. **Decision:**
   - All five content axes clean AND no anti-abuse trip => `status = 'published'`, set `published_at = now()`. The `reviews_recompute_rating` trigger then refreshes the business's cached `rating`/`review_count`.
   - Any axis flags (or an abuse signal trips) => `status = 'flagged'` (human review) or `status = 'rejected'` with `rejected_reason`; record `moderation_notes`, set `flagged_at`.
5. It is a cron function: `verify_jwt = false`, scheduled hourly. See the `edge-function` skill.

## The 5-axis classification prompt (exact shape)
Ask Claude to return **only** JSON with these keys (booleans + reasoning):
```json
{
  "authentic":    true,      // genuine first-hand experience, not fabricated/templated
  "off_topic":    false,     // about something other than this business/service
  "hate_speech":  false,     // slurs, harassment, protected-class attacks
  "promotional":  false,     // spam, ads, competitor smear, link-dropping, self-promo
  "coordinated":  false,     // looks like part of a review-bombing / paid campaign
  "reasoning":    "one or two sentences explaining the call"
}
```
**Publish only if** `authentic === true` AND `off_topic === false` AND `hate_speech === false` AND `promotional === false` AND `coordinated === false`. Anything else => flag/reject.

System-prompt guidance to include: judge the review *text* on these five axes for a Kenya business-discovery app; do not penalize negative-but-genuine reviews (a fair 2-star is authentic and on-topic and must publish); be strict on fabricated, promotional, hateful, or coordinated content; return strictly the JSON, no prose. Parse defensively — if Claude returns malformed JSON, flag the review for human review rather than publishing it.

## Anti-abuse signals (check before/alongside the LLM)
Use the row's anti-abuse fields (`reviewer_ip inet`, `reviewer_fingerprint text`, `reviewer_id`, `business_id`, `created_at`, `rating`, `body`):
- **Per-IP rate:** more than **3 reviews per `reviewer_ip` in 24h** => flag the excess.
- **Per-user/business:** more than **1 review by the same `reviewer_id` for the same `business_id` in 30 days** => flag (no repeat-stuffing one listing).
- **Burst detection:** **10+ reviews for a single `business_id` within 4 hours** => flag the burst as possible review-bombing/coordinated; corroborates the LLM `coordinated` axis.
- **Fingerprint:** repeated `reviewer_fingerprint` across many businesses or in a short window => suspicious; flag.
- **Sentiment-rating mismatch:** review text sentiment strongly contradicts the star `rating` (e.g. 5 stars + scathing text, or 1 star + glowing text) => flag for human review (often fake or mis-submitted).

Cheap signals first (SQL counts on indexed columns) so you don't spend an LLM call on obvious abuse.

## Common mistakes
- Doing moderation inline in `submit-review` instead of the hourly cron (blocks the user, costs latency).
- Treating RLS as moderation — RLS hides unpublished rows but never judges content. Both are required.
- Publishing on malformed/blank Claude output — fail closed (flag), never open (publish).
- Auto-rejecting negative reviews — a genuine low rating must still publish (that is what makes ranking honest).
- Forgetting that publishing triggers the rating recompute (don't also hand-write `rating`).
- Putting `ANTHROPIC_API_KEY` anywhere client-side (guardrail 1).

## Checklist
- [ ] Runs as an hourly **cron** edge function (`verify_jwt = false`), off the request path.
- [ ] Reads the `pending_moderation` queue via the partial index, bounded batch.
- [ ] Anti-abuse pre-checks: per-IP 3/24h, per-user 1/business/30d, burst 10+/4h, fingerprint, sentiment-rating mismatch.
- [ ] Claude returns the 5-axis JSON (authentic / off_topic / hate_speech / promotional / coordinated / reasoning).
- [ ] Publish only if all clean; else flag/reject with `moderation_notes` / `rejected_reason`; set `flagged_at`/`published_at`.
- [ ] Fails closed on malformed model output.
- [ ] `ANTHROPIC_API_KEY` read from `Deno.env`, never the client.
