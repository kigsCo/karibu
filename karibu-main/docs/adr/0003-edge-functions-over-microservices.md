# ADR-0003 — Edge functions over microservices

## Status

Accepted.

## Context

Karibu needs server-side logic for a handful of concerns: proxying Ask Karibu to Anthropic (to keep the key off the client), validating and staging reviews, classifying reviews for moderation, recomputing rankings, handling M-Pesa payments and callbacks, and sending onboarding email. A common instinct is to model each of these as its own deployable service with its own scaling, deploy pipeline, and network boundary.

For a system this size, that instinct is a trap. The concerns above are small, mostly event- or cron-driven, and share one database. Splitting them into independently deployed microservices would add network hops, inter-service auth, distributed-failure modes, and a multiplied deploy/observability burden — all to coordinate work that comfortably fits in one Postgres and a few functions. The team is one developer; operational simplicity is a feature.

## Decision

Implement all server-side logic as **Supabase Edge Functions** (Deno), deployed within the single Supabase project (ADR-0001). The core set is small and well-bounded:

| Function | Trigger | Role |
|---|---|---|
| `ask-karibu` | user request | proxy to Anthropic, grounded in the directory |
| `submit-review` | user request | validate + stage a review for moderation |
| `moderate-reviews` | cron (hourly) | classify pending reviews via Claude |
| `calculate-rankings` | cron (nightly) | recompute `ranking_score` for active businesses |
| `mpesa-stk-push` / `mpesa-callback` | user request / webhook | subscription payments |
| `send-onboarding-email` | event / cron | Resend transactional email |

Shared concerns — CORS, the service-role client, rate limiting, pagination, JSON error shapes — live in `functions/_shared/` and are imported, not re-implemented. Request-path functions stay thin; heavy or bursty work runs as cron functions off the request path.

## Consequences

**Positive.** One runtime, one deploy step (`supabase functions deploy ...` in CI), one place to read logs. Functions share the database directly with no inter-service network calls. The boundary that actually matters — secrets server-side, key off the client — is enforced naturally because functions are the only place secrets live. Adding a new concern is adding a file, not standing up a service.

**Negative / accepted trade-offs.** We forgo independent per-service scaling and independent deploy cadence; all functions deploy together and share the platform's execution limits. We are coupled to the Deno edge runtime (cold starts, runtime constraints, Deno-flavoured imports). Both are acceptable at our scale and load profile, and none of these functions has a scaling need that would justify its own service. If one function ever genuinely outgrows this model, it can be peeled out individually — the same deliberate-not-preemptive stance taken throughout [`ARCHITECTURE.md`](../ARCHITECTURE.md)'s "what we deliberately don't have."
