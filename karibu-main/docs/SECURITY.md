# Security

> How Karibu keeps secrets out of the browser, keeps the database honest, and keeps fraudulent businesses and fake reviews off the platform. Security here is layered: each control assumes the one in front of it might fail. The non-negotiable guardrails are in the root [`CLAUDE.md`](../CLAUDE.md); this document is the detail behind them.

## The Anthropic API key boundary

This is the security decision that matters most, because getting it wrong is both cheap to do and expensive to suffer: a leaked Anthropic key can burn $50 of credits over a weekend and violates Anthropic's terms of service.

**The rule:** the Anthropic API key never touches the frontend. The data flow is exactly:

```
browser  ──►  ask-karibu edge function  ──►  Supabase secret store  ──►  Anthropic
  (no key)        (reads ANTHROPIC_API_KEY            (encrypted)           (claude-sonnet-4-6)
                   from Deno.env, calls upstream)
```

The browser invokes `supabase.functions.invoke('ask-karibu', ...)` with only the public anon key. The edge function — running server-side on Deno — reads `ANTHROPIC_API_KEY` from Supabase's encrypted secret store via `Deno.env`, queries the grounding directory, calls Anthropic, and returns only the answer. The key is never serialised into the response, never logged, and never placed in a `VITE_*` variable.

### The prototype currently violates this

The static prototype calls Anthropic **directly from the browser** at `src/KaribuApp.jsx` (~line 2097):

```js
const response = await fetch("https://api.anthropic.com/v1/messages", { ... });
```

A browser cannot call the Anthropic API without an API key in the request, so any *working* version of that call necessarily ships the key to the client — exactly the boundary violation above. Fixing it is a **priority, not optional**: replace the direct `fetch` with `supabase.functions.invoke('ask-karibu', ...)`, which moves the key server-side. This is step 5 of the frontend migration sequence in [`src/CLAUDE.md`](../src/CLAUDE.md) and is called out there to be done early. Until it is done, treat the prototype's key as compromised — do not point it at a funded production Anthropic account.

## Secrets inventory

There are two classes of configuration, and the line between them is bright.

**Public — safe in the browser bundle (`VITE_*`).** Only these two belong client-side:

| Variable | What it is |
|---|---|
| `VITE_SUPABASE_URL` | The project URL — public by design. |
| `VITE_SUPABASE_ANON_KEY` | The anon key — public by design; all access through it is gated by RLS. |
| `VITE_PLAUSIBLE_DOMAIN` | Optional, for client-side analytics. |

A `VITE_` prefix means "this is compiled into the JS that every visitor downloads." Anything secret with that prefix is, by definition, leaked.

**Secret — Supabase Edge Function secrets only.** Set in the Supabase dashboard (**Settings → Edge Functions → Secrets**), read via `Deno.env`, **never** as `VITE_*`:

| Secret | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `ask-karibu`, `moderate-reviews` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | `mpesa-stk-push`, `mpesa-callback` |
| `RESEND_API_KEY` | `send-onboarding-email` |
| `SENTRY_DSN` | observability (server side) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only DB access inside edge functions — **bypasses RLS**, so it must never reach the client |

The service-role key deserves emphasis: it is the master key that ignores row-level security. It exists only inside the Deno runtime. The browser only ever holds the anon key.

## Row-level security: the last line of defence

RLS is enabled on **every** table (`20260601000002_rls_policies.sql`). It is the *last* line of defence, not the only one — edge functions still validate input, rate-limit, and run business logic in front of it. But if every other control were bypassed and a query reached Postgres directly with the anon key, RLS is what still refuses to leak data. The per-table policies:

| Table | Read | Write |
|---|---|---|
| `cities`, `categories` | public, `is_active = true` | none from client |
| `sub_types` | public, all rows | none from client |
| `businesses` | public where `status='active'`; owner sees own (incl. `pending`) | owner may `UPDATE` own (`owner_id = auth.uid()`) |
| `reviews` | public where `status='published'` | authenticated `INSERT` only own (`reviewer_id = auth.uid()`), `rating 1–5`, `length(body) >= 40` |
| `guides` | public where `is_published = true` | none from client |
| `saved_places` | owner only (`user_id = auth.uid()`) | owner only (same) |
| `subscriptions` | owner only (business belongs to `auth.uid()`) | server-side only (M-Pesa functions) |
| `ai_conversations` | **none** | **none** — no policies, so no client access; service role only |

Two design points are worth calling out. First, the review insert policy **re-asserts the rating range and minimum length** even though the table already `CHECK`s them — defence in depth, so the rule holds whether a write arrives through the policy path or another. Second, `ai_conversations` has **no policies at all on purpose**: with RLS on and no policy granting access, the client can neither read nor write it, and only the service role (inside the edge function) can.

## Input validation and rate limiting in edge functions

RLS guards the database; edge functions guard the door. Every function follows the same shape (see [`supabase/CLAUDE.md`](../supabase/CLAUDE.md)): handle `OPTIONS`/CORS, **validate input** before doing anything, read secrets from `Deno.env`, return the shared JSON error shape on failure, and log fire-and-forget. Validation is not optional politeness — it is where malformed, oversized, or malicious payloads are rejected before they reach Postgres or Anthropic.

Rate limiting lives here too, in the shared helpers under `functions/_shared/`. It protects two things in particular: the Anthropic spend (an unthrottled `ask-karibu` is a direct line to the credit balance) and the review pipeline (covered next). The principle is that a single client, authenticated or not, cannot consume unbounded server resources by hammering a function.

## Review anti-abuse signals

Reviews are the heart of ranking, which makes them the obvious target for manipulation — a competitor review-bombing a rival, a business astroturfing itself. The `reviews` table carries `reviewer_ip` (`inet`) and `reviewer_fingerprint` (`text`) precisely so the pipeline can reason about abuse. The signals:

| Signal | Threshold | Action |
|---|---|---|
| Per-IP rate | max **3 reviews / 24h** from one IP | block / throttle at submission |
| Per-user rate | max **1 review / business / 30 days** | block duplicate |
| Burst detection | a business getting **10+ reviews in 4h** | pause *all* of that business's reviews for human review |
| Fingerprint check | **5+ reviews** from one browser fingerprint | flag |
| Sentiment–rating mismatch | a 5★ review whose text reads negative (or vice versa) | flag for moderation |

A new review enters as `status='pending_moderation'`. The hourly `moderate-reviews` cron classifies each pending review with Claude across five axes (authentic, off-topic, hate speech, promotional, coordinated). Clean reviews become `published` (and `published_at` is set, which triggers the cached-rating recompute); anything flagged becomes `status='flagged'` and is routed to the team via Slack for a human decision. Automated classification handles volume; humans handle the edge cases. Neither rate limiting nor moderation alone is sufficient — together they make manipulation expensive and slow, which is the goal.

## Business verification — a product feature

Karibu's entire value proposition is trust: visitors believe a listed business is real because it has been verified. The day the platform lists its first fraudulent salon, that trust starts to erode. So verification is treated as a **product feature, not a compliance checkbox** — it is core, not overhead.

A business enters as `status='pending'` with `verified_at = NULL` and progresses through a pipeline before it ever goes `active`:

1. **KRA PIN format check** — server-side regex on the Kenyan tax PIN.
2. **KRA PIN cross-check** — against KRA's iTax API where available, otherwise manual.
3. **Phone OTP** — SMS verification of the contact number (via Africa's Talking).
4. **Location pin** — the owner drops a pin on the map; it must match the listed neighbourhood.
5. **Photo authenticity** — reverse image search of the submitted photos against stock libraries, to catch listings padded with generic imagery.
6. **Human review** — the Nairobi team reviews all of the above and makes the call.

Only on approval does the business move to `status='active'` with `verified_at = now()`, after which the welcome email and (for paid tiers) M-Pesa setup fire. First listings are required to carry a legal name, KRA PIN, category/sub-type, exact location, structured hours, at least one contact method, at least three quality photos, and owner identity (National ID or passport). The pipeline is deliberately more work than a self-serve form — that friction is the feature.
