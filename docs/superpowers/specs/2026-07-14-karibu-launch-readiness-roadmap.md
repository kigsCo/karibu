# Karibu launch-readiness roadmap

Date: 2026-07-14
Owner: Kigs Apex Solutions
Status: approved (roadmap + sequence), Bundle ID pending

## Goal

Take Karibu from a live but one-sided web directory to a store-shippable,
A-tier product that we can actively market to two audiences in Nairobi:
travellers who discover services, and businesses who want to be listed.
"Ready to market" is defined per audience in the decisions below, and the
whole program is scoped to the *minimum* that clears both bars honestly.

## Verified starting state (2026-07-14)

- Live at `karibu-brown.vercel.app`, backed by the Supabase `karibu` project
  (`jwiptjcpczamewmyaost`, `eu-central-1`, free plan). The data layer is fully
  migrated: cities, categories, listings, business detail, guides, and Ask
  Karibu all read from the cloud, with prototype constants only as fallbacks.
- All 7 edge functions are deployed to cloud (recorded 2026-07-12), the Vercel
  build points at the cloud project, and internal-only functions fail closed
  on a missing secret.
- Backend test suite is green: 66 passed, 0 failed (`deno test` in
  `supabase/functions`, with `--node-modules-dir=auto` to install npm deps).
- The `CLAUDE.md` "Where we are right now" section is stale: it still says edge
  functions are not deployed. Correcting it is an early task in Sub-project 1.

### What blocks marketing today

1. The app is a read-only, one-sided directory. There is no real auth flow
   anywhere (the only `supabase.auth` call is a `getSession()` check), so a
   traveller cannot leave a persisted review and cannot save a place.
2. Businesses cannot sign up or pay. The "For Businesses" screen is a pricing
   page whose plan CTAs have no `onClick`. M-Pesa is off by default.
3. The directory content is prototype sample data, not a real Nairobi dataset.
4. The "For Businesses" screen shows fabricated trust stats (28k+ visitors,
   2.4k businesses, 41% uplift). For a trust-first brand these must go.

## Decisions (locked)

| Area | Decision |
|---|---|
| Merchant onboarding + billing | Concierge / lead-capture. Businesses apply through a form, our Nairobi team verifies and onboards them, payment is collected offline or by manual M-Pesa. No merchant auth, no self-serve billing, no dashboard at launch. |
| Traveller reviews | Discovery-first. Launch on browse plus Ask Karibu plus editorially seeded real reviews. No consumer sign-in and no user-generated reviews at launch. |
| Launch content | Depth-first Nairobi. Go deep on three categories (salons/beauty, restaurants, rides) rather than broad and thin. |
| Store packaging | Capacitor. One React codebase wraps to native iOS and Android, with the native plugins needed to clear Apple Guideline 4.2. |
| Architecture | Full incremental split of the monolith into pages, components, and hooks, plus real routing and a frontend test pass. |
| Bundle ID | Pending. User will confirm `co.ke` vs `com`. Not needed until Sub-project 4, so it blocks nothing before then. |
| Domain cutover | Last, after all dev work. |

## Trust guardrails (constrain every sub-project)

These are not style choices. Violating them damages the one thing the product
sells.

1. Cold-sourced businesses (found via public listings) are seeded as **listed**:
   `tier = free`, `status = active`. They are never marked "Karibu Recommended"
   and never get invented reviews. "Recommended" is earned only through the
   team's manual verification.
2. Seeded reviews come only from real feedback the team gathers. We do not
   fabricate reviews to make a listing look alive.
3. The fabricated marketing stats are removed before any business sees the app.
4. Any UI that implies a capability we do not have at launch (persisted "Save",
   a user "write a review" flow) is hidden or clearly de-scoped.

## Sub-projects

Each sub-project gets its own spec and implementation plan. This roadmap is the
decomposition and the sequencing contract.

### Sub-project 1 — A-tier architecture refactor (foundation)
Retire the ~3,200-line `KaribuApp.jsx` into a proper structure: real
`react-router` routes (deep-link ready for native), one page module per screen
extracted incrementally with a render check after each step, shared UI in
`components/`, data in `hooks/`. Route params plus existing data hooks replace
in-memory navigation payloads, which is what makes deep links work cold. Add a
frontend test pass. The visual layer stays byte-identical: this sub-project
changes structure, not design or copy.
Spec: `2026-07-14-karibu-architecture-refactor-design.md`.
Rough effort: ~1 week.

### Sub-project 2 — Launch features and trust/UX integrity
- Apply-to-get-listed: a real form (name, business, city, category, contact,
  desired tier) writing to a rate-limited `business_applications` table and
  firing `send-onboarding-email` to the team. Wires the dead CTAs. No merchant
  auth or billing.
- Trust fixes: remove the fabricated stats; hide "Save" and any UGC review CTA.
- Store-grade UX: proper empty, loading, and error states; safe-area insets;
  touch targets; offline guide reading. Add lightweight analytics for honest
  traffic numbers.
Rough effort: ~3 to 4 days.

### Sub-project 3 — Nairobi content (parallel)
Source real Nairobi businesses from public listings across salons/beauty,
restaurants, and rides (roughly 10 to 15 each), build a real `seed.sql`, and
load to cloud. Cold-sourced listings follow guardrail 1. The team then verifies
and seeds real reviews for a curated top handful per category so the rated tier
looks alive without faking anything. Independent of the code work, so it runs
in parallel from day one; verification pace sets the launch date.

### Sub-project 4 — Capacitor wrap and store readiness
Add Capacitor with iOS and Android platforms, native config (icons, splash,
status bar, safe areas), and the minimal native plugins to clear Apple 4.2
(geolocation, share). Produce store assets (screenshots, feature graphic,
descriptions, content rating) and the required privacy policy plus data-safety
and App-Privacy disclosures. We prepare signed builds; account signup,
submission, and reviewer responses are the client's (Apple $99/yr, Google $25).
Rough effort: ~1 week plus review iteration.

### Sub-project 5 — Domain cutover
Point `karibu.co.ke` at Vercel, wire `.well-known/assetlinks.json` (Android) and
`apple-app-site-association` (iOS) for verified deep links, update OG, manifest,
and Supabase allowed origins, and run a final end-to-end verification on the
domain and both native builds.

## Sequencing

```
Sub-project 1  ->  Sub-project 2  ->  Sub-project 4  ->  Sub-project 5
                    (Sub-project 3 runs in parallel throughout)
```

Content (3) is the long pole and is gated by the team's verification pace, not
by code. Realistically this is a multi-week program.

## Explicitly out of scope for launch (deferred to a later phase)

Merchant authentication, self-serve billing, in-app M-Pesa subscription
payments, the merchant dashboard, consumer authentication, and user-generated
reviews. Revisit once businesses are asking for a login or self-serve payment.

## Open items

- Bundle ID: `co.ke.karibu` vs a `.com` form (user to confirm).
- Apple Developer and Google Play accounts (client to create).
- Domain readiness and DNS control for `karibu.co.ke`.
- How many real businesses the team can verify per week (sets launch date).

## Risks

- Apple Guideline 4.2 rejection of a thin wrapper. Mitigated by Capacitor plus
  genuine native touches and the app's real functionality (Ask Karibu,
  discovery, offline guides).
- An empty-feeling directory. Mitigated by depth-first sourcing plus a curated,
  genuinely reviewed top tier per category.
- Content-verification pace slipping the launch. Mitigated by decoupling
  content (Sub-project 3) from code and starting it immediately.
