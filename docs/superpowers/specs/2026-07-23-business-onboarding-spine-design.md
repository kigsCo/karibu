# Business onboarding spine: intake, claims, admin review, activation

**Date:** 2026-07-23 · **Status:** Approved (scope confirmed interactively:
spine only — intake → pending → admin approve/reject → active + welcome
email; both new registrations and claims of existing listings in one shared
queue; collect-evidence + human review, no OTP/iTax this cycle; `/admin`
route inside the app with `profiles.is_staff`; edge-function intake, not
direct RLS inserts)

## What we're building

The first real path for a business to get onto Karibu, honouring
"verification is a product feature". Two intake doors, one review queue:

- **Register** — a signed-in user submits a new business. It lands as a
  real `businesses` row with `status='pending'`, `tier='free'`,
  `owner_id = auth.uid()`. Existing RLS already hides pending rows from
  the public and shows them to their owner.
- **Claim** — "this is my business" on an existing unowned listing (the 28
  seeded actives). Creates a `business_claims` row.

Both carry evidence (KRA PIN, contact phone, owner-ID scan in a private
bucket, ≥3 listing photos for registrations). A staff-only `/admin` queue
approves or rejects each item; every decision is logged in
`admin_decisions`. Approving a registration sets
`status='active', verified_at=now()` and fires the (currently orphaned)
`send-onboarding-email`; approving a claim sets `businesses.owner_id` to
the claimant. Tier stays `free` — paying for verified/recommended is the
existing M-Pesa flow and its checkout UI is a later cycle.

This is cycle 1 of 3. Cycle 2: merchant dashboard on real data + owner
self-editing. Cycle 3: subscription checkout UI + flipping
`mpesa-stk-push` to `verify_jwt=true`.

## Components

### Migrations (one concern each) + pgTAP

1. `create_business_verifications.sql` — evidence for registrations,
   deliberately **off** `businesses` (the public SELECT policy exposes
   whole active rows; RLS cannot hide columns). Table:
   `business_id uuid PK REFERENCES businesses ON DELETE CASCADE,
   submitted_by uuid NOT NULL REFERENCES auth.users, kra_pin text NOT NULL,
   contact_phone text NOT NULL, id_document_path text NOT NULL,
   applicant_note text, created_at`. CHECK bounds on every text column;
   KRA format `^[AP][0-9]{9}[A-Z]$` re-checked as a CHECK. RLS: business
   owner SELECTs own (`EXISTS … businesses.owner_id = auth.uid()`); **no
   client writes** — the intake function inserts with the service role.
   Revoke-then-grant: SELECT to authenticated, ALL to service_role. FK
   index on `submitted_by`.
2. `create_business_claims.sql` — `id uuid PK, business_id uuid FK,
   claimant_id uuid FK, status text CHECK
   ('pending','approved','rejected') DEFAULT 'pending', role_title text,
   kra_pin text NOT NULL, contact_phone text NOT NULL,
   id_document_path text NOT NULL, note text, created_at, decided_at`.
   Partial unique index `(business_id, claimant_id) WHERE
   status='pending'` (no duplicate open claims). Indexes: both FKs +
   partial `WHERE status='pending'` for the queue. RLS: claimant SELECTs
   own; no client writes. Grants as above.
3. `create_admin_decisions.sql` — the audit log: `id uuid PK,
   subject_type text CHECK ('registration','claim'), subject_id uuid
   NOT NULL, action text CHECK ('approved','rejected'), reason text,
   decided_by uuid NOT NULL REFERENCES auth.users, created_at`. RLS
   enabled with **zero policies** and zero grants to anon/authenticated —
   service-role only. Indexes: `decided_by`, `(subject_type, subject_id)`.
4. `add_profiles_is_staff.sql` — `ALTER TABLE profiles ADD COLUMN
   is_staff boolean NOT NULL DEFAULT false`. Deliberately **not** added to
   the column-scoped `GRANT UPDATE (full_name, avatar_url, home_city_id)`
   from `20260722205636`, so a client can read its own flag (existing
   own-row SELECT) but can never write it. Staff are appointed by hand in
   SQL for now.
5. `create_onboarding_storage.sql` — two buckets + `storage.objects`
   policies. `verification-docs`: **private**, 5 MB limit, images + PDF;
   authenticated INSERT/SELECT only where
   `(storage.foldername(name))[1] = auth.uid()::text` (own folder);
   admins view via signed URLs minted by the service role.
   `business-photos`: **public**, 5 MB, images; same own-folder INSERT
   rule. Photo URLs are written into the existing
   `businesses.hero_image_url` / `gallery_image_urls` columns when the
   pending row is inserted — approval only flips status, never touches
   media.
6. `supabase/tests/onboarding_spine_test.sql` — pgTAP: RLS enabled on all
   three tables; owner/claimant sees own rows, a second user sees
   nothing; authenticated INSERT/UPDATE on all three tables is denied;
   `is_staff` cannot be self-updated; storage: own-folder write enforced,
   `verification-docs` objects unreadable cross-user and by anon.

### Edge functions

- `business-intake` — new, `verify_jwt=true` (signed-in users only; the
  user JWT identifies the applicant, writes go through the service-role
  client). Shared helpers: `handleOptions`, `json`/`errorResponse`,
  `checkIpRateLimit` + a per-user global bucket
  (`business-intake:user:<uid>`, ~3 registrations and 5 claims per day).
  Two actions:
  - `register`: validates name/`about` bounds, category + sub-type and
    city + hood resolve against reference tables, Kenyan phone format,
    `hours_json` shape, lat/lng inside a Kenya bounding box (finer
    location truth stays with the human reviewer), ≥3 photo paths all
    under `business-photos/<uid>/…`, ID doc under
    `verification-docs/<uid>/…`, KRA PIN regex. Inserts the pending
    `businesses` row (slug = slugified name + short random suffix;
    `address`/contact columns as given; hero = first photo, rest to
    `gallery_image_urls`) and its `business_verifications` row; if the
    second insert fails, the function deletes the just-created
    `businesses` row (compensating delete) and returns 500 — no partial
    application survives. Returns `{ id, slug }`.
  - `claim`: target business must exist, be `active`, and have
    `owner_id IS NULL`; rejects an existing pending claim by the same
    user (409). Inserts `business_claims`.
- `admin-review` — new, `verify_jwt=true` **plus** a staff gate: the
  function reads `profiles.is_staff` for `auth.uid()` with the service
  role and returns 403 otherwise (RLS/`is_staff` is the authorization;
  the JWT is only authentication). Three actions:
  - `queue`: pending registrations (business + verification row) and
    pending claims (claim + business + claimant profile), keyset-
    paginated, each with a short-lived (10 min) signed URL for the ID
    document.
  - `approve { kind, id }`: registration →
    `UPDATE businesses SET status='active', verified_at=now() WHERE id=$1
    AND status='pending' RETURNING …` (guard makes double-clicks and
    races no-ops); claim → `UPDATE businesses SET owner_id=<claimant>
    WHERE id=$1 AND owner_id IS NULL` then mark the claim `approved`,
    both guarded. Writes `admin_decisions`, then fire-and-forget POSTs
    `send-onboarding-email` (server-to-server with
    `x-karibu-internal-secret`, recipient = owner's `profiles.email`,
    tier = the business's current tier). Email failure is logged, never
    blocks the 200.
  - `reject { kind, id, reason }`: reason required and bounded.
    Registration → `businesses.status='unlisted'`; claim →
    `status='rejected', decided_at=now()`. Decision logged.
- Both registered in `config.toml` with the standard comment explaining
  the auth model. `send-onboarding-email` itself is unchanged — this
  cycle just gives it its first caller.

### UI (existing visual language; no restyle of existing screens)

- `routes.jsx`: add `/for-business/register` (RegisterBusinessPage),
  `/b/:slug/claim` (ClaimBusinessPage), `/admin` (AdminReviewPage) — all
  under `FullBleedLayout` like `/b/:slug/review` and `/merchant`.
- `ForBusinessPage`: wire the dead CTAs to `/for-business/register`
  (signed-out users bounce through `/welcome` with a return path). Add a
  compact "Your applications" block for signed-in users: their own
  businesses of any status (existing owner-read RLS) + their claims
  (new claimant-read RLS) — plain supabase-js selects, no new endpoint.
- `RegisterBusinessPage`: sectioned form (basics → location → contact &
  hours → photos → verification). Location = "use my current location"
  (browser geolocation) with manual lat/lng fallback — no map library.
  Photos and the ID doc upload from the browser straight to the buckets
  (own-folder paths), then `invoke('business-intake', { action:
  'register', … })`. Ends on an "under review — allow up to 48 h"
  confirmation.
- `ClaimBusinessPage`: short form (role, KRA PIN, phone, ID doc, note) →
  `invoke('business-intake', { action: 'claim', … })`.
- `BusinessPage`: an unobtrusive "Own this business? Claim it" link when
  the loaded row has `owner_id == null`, linking to `/b/:slug/claim`.
- `AdminReviewPage`: renders "Not authorized" unless the user's own
  profile row has `is_staff` (UX gate only; the function is the real
  gate). Queue list with an evidence panel (signed-URL doc preview),
  Approve button, Reject with an inline reason field. All data via
  `invoke('admin-review', …)`.

### Tests

Deno (`supabase/tests/`): `business-intake` — validation matrix (KRA
regex cases, photo count, foreign-folder paths rejected), 401 without a
session, duplicate-claim 409, claim of an owned business 409, rate-limit
429. `admin-review` — 403 for non-staff, queue shape, double-approve is a
no-op, reject requires reason, decision rows written. vitest:
ForBusinessPage CTA navigation + applications block, RegisterBusinessPage
required-field gating and happy-path invoke, ClaimBusinessPage submit,
AdminReviewPage non-staff gate, routes test additions. `npm run lint`,
`npm run build`, existing screens visually unchanged.

## Error handling

Both functions return the shared JSON error shape with specific codes
(validation 400, unauthenticated 401, not-staff 403, duplicate/owned 409,
rate-limited 429). The UI shows inline errors per section and disables
submit while uploading. Client validates file size/type before upload;
the server re-validates paths and formats — the client is never trusted.
Approve/reject are idempotent via guarded UPDATEs. The welcome email is
fire-and-forget. The "Your applications" block renders nothing on error;
it can never blank `/for-business`.

## Out of scope (deliberate)

Merchant dashboard on real data and owner self-editing (cycle 2);
subscription checkout UI and `verify_jwt` flip on `mpesa-stk-push`
(cycle 3); phone OTP (Africa's Talking), iTax cross-check, photo-
authenticity automation (later verification hardening); rejection-notice
emails (only the approval welcome email exists today); admin tooling
beyond the queue (search, suspend, edit); retro-verifying the 28 seeded
active listings (claims give them owners; their `verified_at` backfill is
a separate decision).
