# Business Onboarding Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A business can register or claim a listing on Karibu; evidence lands in a staff-only review queue; approval activates the listing (or assigns the owner) and fires the welcome email.

**Architecture:** Two new JWT-authenticated edge functions (`business-intake`, `admin-review`) do all writes with the service role; three new RLS-locked tables (`business_verifications`, `business_claims`, `admin_decisions`) plus `profiles.is_staff` and two storage buckets; four frontend touches (ForBusinessPage CTAs + applications block, RegisterBusinessPage, ClaimBusinessPage + BusinessPage link, AdminReviewPage).

**Tech Stack:** Supabase (Postgres 15 migrations, RLS, Storage, Deno edge functions), React 18 + react-router 6 + Tailwind, vitest + @testing-library, Deno test, pgTAP.

**Spec:** `docs/superpowers/specs/2026-07-23-business-onboarding-spine-design.md` (approved).

## Global Constraints

- Never restyle or restructure existing screens; new screens reuse the existing visual idiom (Tailwind classes seen in neighboring pages).
- Every new table: `ENABLE ROW LEVEL SECURITY` + explicit `REVOKE ALL ... FROM anon, authenticated` then re-grant, in the same migration (cloud vs local default-privilege divergence).
- One concern per migration; migrations are immutable once merged.
- Edge functions: reuse `_shared/` helpers (`handleOptions`, `json`/`errorResponse`, `createUserClient`/`createServiceClient`, `checkIpRateLimit`/`checkGlobalRateLimit`, `clientIpFromXff`). Errors always return `{ error: string }`.
- `verify_jwt = true` is authentication only, never authorization — `admin-review` authorizes via `profiles.is_staff` internally.
- Secrets only via `Deno.env`; nothing new in `VITE_*`.
- KRA PIN format everywhere: `^[AP][0-9]{9}[A-Z]$`.
- Commit messages: conventional (`feat:`/`test:`/`docs:`), **no Co-Authored-By lines**.
- Commands: frontend tests `npx vitest run`, lint `npm run lint`, build `npm run build`; Deno tests `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`; DB `supabase db reset`, pgTAP `supabase test db` (needs `supabase start` first; if Docker/local stack is unavailable, note it in the task result and continue — final task re-verifies).
- Branch: work on `feat/business-onboarding-spine` (already created; spec committed).

---

### Task 1: Migration — `business_verifications`

**Files:**
- Create: `supabase/migrations/20260723100000_create_business_verifications.sql`

**Interfaces:**
- Produces: table `business_verifications(business_id PK→businesses, submitted_by, kra_pin, contact_phone, id_document_path, applicant_note, created_at)`; owner-read RLS; service-role-only writes. Consumed by `business-intake` (insert) and `admin-review` (queue join).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723100000_create_business_verifications.sql
-- Registration evidence, deliberately OFF the businesses table: the public
-- SELECT policy exposes whole active rows and RLS cannot hide columns, so a
-- KRA PIN on businesses would leak. 1:1 with the pending listing; written only
-- by the business-intake edge function (service role). The business owner may
-- read their own evidence; nobody else can see or touch it from a client.

CREATE TABLE business_verifications (
  business_id      uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  submitted_by     uuid NOT NULL REFERENCES auth.users(id),
  kra_pin          text NOT NULL CHECK (kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  contact_phone    text NOT NULL CHECK (char_length(contact_phone) <= 20),
  id_document_path text NOT NULL CHECK (char_length(id_document_path) <= 1024),
  applicant_note   text CHECK (char_length(applicant_note) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Every FK gets an index (business_id is the PK already).
CREATE INDEX idx_business_verifications_submitted_by
  ON business_verifications(submitted_by);

ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own verification"
  ON business_verifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies: writes are service-role only.

-- Deterministic grants, local vs cloud (see 20260710160000).
REVOKE ALL ON business_verifications FROM anon, authenticated;
GRANT SELECT ON business_verifications TO authenticated;
GRANT ALL ON business_verifications TO service_role;
```

- [ ] **Step 2: Apply**

Run: `supabase db reset`
Expected: all migrations apply cleanly, ending with `20260723100000`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723100000_create_business_verifications.sql
git commit -m "feat(db): business_verifications table for registration evidence"
```

---

### Task 2: Migration — `business_claims`

**Files:**
- Create: `supabase/migrations/20260723100100_create_business_claims.sql`

**Interfaces:**
- Produces: table `business_claims(id, business_id, claimant_id, status pending|approved|rejected, role_title, kra_pin, contact_phone, id_document_path, note, created_at, decided_at)`; partial unique `(business_id, claimant_id) WHERE status='pending'`; claimant-read RLS. Consumed by `business-intake` (insert), `admin-review` (queue/approve/reject), ForBusinessPage applications block (own-claims select).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723100100_create_business_claims.sql
-- "This is my business" on an existing listing. Carries its own evidence
-- (a claim's target already has public listing data; what we need is proof
-- the claimant runs it). Written only by business-intake (service role);
-- decided only by admin-review. The claimant may read their own claims.

CREATE TABLE business_claims (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimant_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  role_title       text CHECK (char_length(role_title) <= 80),
  kra_pin          text NOT NULL CHECK (kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  contact_phone    text NOT NULL CHECK (char_length(contact_phone) <= 20),
  id_document_path text NOT NULL CHECK (char_length(id_document_path) <= 1024),
  note             text CHECK (char_length(note) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  decided_at       timestamptz
);

-- One open claim per (business, claimant); re-claiming after a rejection is
-- allowed, so the uniqueness is scoped to pending only.
CREATE UNIQUE INDEX idx_business_claims_one_pending
  ON business_claims(business_id, claimant_id) WHERE status = 'pending';
CREATE INDEX idx_business_claims_business ON business_claims(business_id);
CREATE INDEX idx_business_claims_claimant ON business_claims(claimant_id);
-- The admin queue reads pending claims oldest-first.
CREATE INDEX idx_business_claims_pending
  ON business_claims(created_at) WHERE status = 'pending';

ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Claimant reads own claims"
  ON business_claims FOR SELECT
  TO authenticated
  USING (claimant_id = auth.uid());

-- No client writes; business-intake and admin-review use the service role.

REVOKE ALL ON business_claims FROM anon, authenticated;
GRANT SELECT ON business_claims TO authenticated;
GRANT ALL ON business_claims TO service_role;
```

- [ ] **Step 2: Apply**

Run: `supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723100100_create_business_claims.sql
git commit -m "feat(db): business_claims table for listing ownership claims"
```

---

### Task 3: Migration — `admin_decisions`

**Files:**
- Create: `supabase/migrations/20260723100200_create_admin_decisions.sql`

**Interfaces:**
- Produces: append-only audit log `admin_decisions(id, subject_type registration|claim, subject_id, action approved|rejected, reason, decided_by, created_at)`. Service-role only (zero policies, zero client grants). Consumed by `admin-review` (insert on every decision).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723100200_create_admin_decisions.sql
-- The decision log FIX_PLAN task 24 requires: every approve/reject of a
-- registration or claim leaves a row saying who did it, to what, and why.
-- RLS is enabled with ZERO policies and zero client grants — only the
-- service role (admin-review) can read or write. Append-only by convention.

CREATE TABLE admin_decisions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type text NOT NULL CHECK (subject_type IN ('registration','claim')),
  subject_id   uuid NOT NULL,
  action       text NOT NULL CHECK (action IN ('approved','rejected')),
  reason       text CHECK (char_length(reason) <= 2000),
  decided_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_decisions_subject ON admin_decisions(subject_type, subject_id);
CREATE INDEX idx_admin_decisions_decided_by ON admin_decisions(decided_by);

ALTER TABLE admin_decisions ENABLE ROW LEVEL SECURITY;
-- No policies: a table with RLS on and no policies denies everything except
-- the service role, which is exactly the contract.

REVOKE ALL ON admin_decisions FROM anon, authenticated;
GRANT ALL ON admin_decisions TO service_role;
```

- [ ] **Step 2: Apply**

Run: `supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723100200_create_admin_decisions.sql
git commit -m "feat(db): admin_decisions audit log"
```

---

### Task 4: Migration — `profiles.is_staff`

**Files:**
- Create: `supabase/migrations/20260723100300_add_profiles_is_staff.sql`

**Interfaces:**
- Produces: `profiles.is_staff boolean NOT NULL DEFAULT false`, readable by its owner (existing own-row SELECT policy + SELECT grant), never client-writable. Consumed by `admin-review` (authorization check) and AdminReviewPage (UX gate).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723100300_add_profiles_is_staff.sql
-- Staff flag for the onboarding review queue. Authorization lives server-side:
-- admin-review reads this with the service role and 403s non-staff.
--
-- The client-writable surface of profiles is a COLUMN-scoped grant
-- (20260722205636: GRANT UPDATE (full_name, avatar_url, home_city_id)).
-- is_staff is deliberately NOT added to that list, so a user can read their
-- own flag (existing own-row SELECT + table SELECT grant) but any client
-- UPDATE touching is_staff fails with 42501. Staff are appointed by hand:
--   UPDATE profiles SET is_staff = true WHERE email = '...';  -- as postgres

ALTER TABLE public.profiles
  ADD COLUMN is_staff boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Apply**

Run: `supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723100300_add_profiles_is_staff.sql
git commit -m "feat(db): profiles.is_staff flag for the review queue"
```

---

### Task 5: Migration — storage buckets + policies

**Files:**
- Create: `supabase/migrations/20260723100400_create_onboarding_storage.sql`

**Interfaces:**
- Produces: private bucket `verification-docs` (images+PDF, 5 MB) and public bucket `business-photos` (images, 5 MB); own-folder (`<uid>/...`) INSERT policies for both, own-folder SELECT on `verification-docs`. Consumed by RegisterBusinessPage/ClaimBusinessPage (browser uploads), `business-intake` (path validation), `admin-review` (signed URLs via service role).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723100400_create_onboarding_storage.sql
-- Two buckets for onboarding evidence and listing media.
--
--   verification-docs  PRIVATE. Owner-ID scans. A user may write and read only
--                      their own <uid>/ folder; staff view via short-lived
--                      signed URLs minted by admin-review (service role).
--   business-photos    PUBLIC (listing photos are public content by nature).
--                      Writes still restricted to the uploader's own folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('verification-docs', 'verification-docs', false, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('business-photos', 'business-photos', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- storage.objects already has RLS enabled by the storage extension.

CREATE POLICY "Own folder writes to verification-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Own folder reads of verification-docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Own folder writes to business-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- business-photos needs no SELECT policy: it is a public bucket, reads go
-- through the public object URL.
```

- [ ] **Step 2: Apply**

Run: `supabase db reset`
Expected: applies cleanly (policy names are new; `ON CONFLICT DO NOTHING` makes bucket rows idempotent).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723100400_create_onboarding_storage.sql
git commit -m "feat(db): verification-docs and business-photos buckets with own-folder policies"
```

---

### Task 6: pgTAP — `onboarding_spine_test.sql`

**Files:**
- Create: `supabase/tests/onboarding_spine_test.sql`

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 1: Write the pgTAP file**

```sql
-- onboarding_spine_test.sql
-- The five onboarding-spine migrations (20260723100000..100400).
-- Run with: supabase test db
--
-- Proves: the three new tables are RLS-locked (owner/claimant read own rows,
-- strangers read nothing, clients cannot write at all); admin_decisions is
-- invisible to clients; is_staff cannot be self-granted; storage buckets exist
-- and only own-folder writes are accepted. pgTAP rolls everything back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(18);

-- Fixtures ---------------------------------------------------------------
INSERT INTO cities (slug, name, is_active, hoods)
VALUES ('obcity', 'OB City', true, ARRAY['CBD','Uptown'])
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('obcat', 'OB Cat', 'Store', 996) ON CONFLICT (slug) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'ob-u1@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'ob-u2@example.com')
ON CONFLICT (id) DO NOTHING;

-- ob-pending: a registration by u1 (owner) with its verification row.
INSERT INTO businesses (slug, name, category_id, city_id, hood, status, owner_id)
VALUES ('ob-pending', 'OB Pending Co',
        (SELECT id FROM categories WHERE slug = 'obcat'),
        (SELECT id FROM cities WHERE slug = 'obcity'),
        'CBD', 'pending', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO business_verifications
  (business_id, submitted_by, kra_pin, contact_phone, id_document_path)
VALUES ((SELECT id FROM businesses WHERE slug = 'ob-pending'),
        '00000000-0000-0000-0000-0000000000c1',
        'A123456789Z', '254712345678',
        '00000000-0000-0000-0000-0000000000c1/id.jpg');

-- ob-unowned: an active listing u1 has a pending claim on.
INSERT INTO businesses (slug, name, category_id, city_id, hood, status)
VALUES ('ob-unowned', 'OB Unowned Co',
        (SELECT id FROM categories WHERE slug = 'obcat'),
        (SELECT id FROM cities WHERE slug = 'obcity'),
        'CBD', 'active');
INSERT INTO business_claims
  (business_id, claimant_id, kra_pin, contact_phone, id_document_path)
VALUES ((SELECT id FROM businesses WHERE slug = 'ob-unowned'),
        '00000000-0000-0000-0000-0000000000c1',
        'A123456789Z', '254712345678',
        '00000000-0000-0000-0000-0000000000c1/id.jpg');

INSERT INTO admin_decisions (subject_type, subject_id, action, decided_by)
VALUES ('claim', uuid_generate_v4(), 'approved',
        '00000000-0000-0000-0000-0000000000c1');

-- Structure ---------------------------------------------------------------
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'business_verifications'),
          'RLS enabled on business_verifications');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'business_claims'),
          'RLS enabled on business_claims');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_decisions'),
          'RLS enabled on admin_decisions');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_verifications'
                  AND policyname = 'Owner reads own verification'),
          'owner-read policy exists on business_verifications');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_claims'
                  AND policyname = 'Claimant reads own claims'),
          'claimant-read policy exists on business_claims');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE tablename = 'admin_decisions'),
          0, 'admin_decisions has zero policies (service-role only)');

-- As u1 (the applicant) -----------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is((SELECT count(*)::int FROM business_verifications), 1,
          'the owner sees their own verification evidence');
SELECT is((SELECT count(*)::int FROM business_claims), 1,
          'the claimant sees their own claim');
SELECT throws_ok(
  $$ INSERT INTO business_verifications
       (business_id, submitted_by, kra_pin, contact_phone, id_document_path)
     VALUES ((SELECT id FROM businesses WHERE slug = 'ob-unowned'),
             '00000000-0000-0000-0000-0000000000c1',
             'A123456789Z', '254712345678', 'x/id.jpg') $$,
  '42501', NULL, 'clients cannot insert verification evidence');
SELECT throws_ok(
  $$ INSERT INTO business_claims
       (business_id, claimant_id, kra_pin, contact_phone, id_document_path)
     VALUES ((SELECT id FROM businesses WHERE slug = 'ob-pending'),
             '00000000-0000-0000-0000-0000000000c1',
             'A123456789Z', '254712345678', 'x/id.jpg') $$,
  '42501', NULL, 'clients cannot insert claims directly');
SELECT throws_ok(
  $$ SELECT count(*) FROM admin_decisions $$,
  '42501', NULL, 'clients cannot read the decision log');
SELECT throws_ok(
  $$ UPDATE profiles SET is_staff = true
     WHERE id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', NULL, 'a user cannot appoint themselves staff');

-- Storage: own-folder discipline ---------------------------------------------
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('verification-docs',
             '00000000-0000-0000-0000-0000000000c1/own.jpg',
             '00000000-0000-0000-0000-0000000000c1') $$,
  'a user can write into their own verification-docs folder');
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('verification-docs',
             '00000000-0000-0000-0000-0000000000c2/theirs.jpg',
             '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', NULL, 'a user cannot write into another user''s folder');

-- As u2 (a stranger) ----------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated"}', true);

SELECT is((SELECT count(*)::int FROM business_verifications), 0,
          'a stranger sees no verification evidence');
SELECT is((SELECT count(*)::int FROM business_claims), 0,
          'a stranger sees no claims');
SELECT is((SELECT count(*)::int FROM storage.objects
           WHERE bucket_id = 'verification-docs'), 0,
          'a stranger sees no verification-docs objects');

RESET ROLE;
SELECT is((SELECT count(*)::int FROM storage.buckets
           WHERE id IN ('verification-docs','business-photos')), 2,
          'both onboarding buckets exist');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run pgTAP**

Run: `supabase test db`
Expected: `onboarding_spine_test.sql .. ok` (18/18) plus the existing test files still passing. If a storage assertion fails on local grants, fix the test to match reality (e.g. adjust the expected error code), never by weakening a table policy.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/onboarding_spine_test.sql
git commit -m "test(db): pgTAP coverage for the onboarding spine tables and buckets"
```

---

### Task 7: `_shared/onboarding.ts` — pure validation helpers (TDD)

**Files:**
- Create: `supabase/functions/_shared/onboarding.ts`
- Create: `supabase/functions/_shared/onboarding.test.ts`

**Interfaces:**
- Produces (exact exports consumed by Tasks 8–9):
  - `KRA_PIN_RE: RegExp`
  - `isValidKraPin(v: unknown): boolean`
  - `isValidKenyanPhone(v: unknown): boolean`
  - `isInKenya(lat: number, lng: number): boolean`
  - `ownsPath(path: unknown, uid: string): boolean`
  - `slugifyName(name: string): string` (lowercase, hyphens, no random part)
  - `newBusinessSlug(name: string): string` (slugified + `-` + 6 random hex chars)

- [ ] **Step 1: Write the failing tests**

```ts
// _shared/onboarding.test.ts
// Run: deno test --allow-env --node-modules-dir=none supabase/functions/_shared/onboarding.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  isInKenya,
  isValidKenyanPhone,
  isValidKraPin,
  newBusinessSlug,
  ownsPath,
  slugifyName,
} from "./onboarding.ts";

const UID = "11111111-2222-4333-8444-555555555555";

Deno.test("isValidKraPin accepts the KRA format and nothing else", () => {
  assert(isValidKraPin("A123456789Z"));
  assert(isValidKraPin("P000000001B"));
  assertFalse(isValidKraPin("a123456789z"), "lowercase is not valid");
  assertFalse(isValidKraPin("B123456789Z"), "must start with A or P");
  assertFalse(isValidKraPin("A12345678Z"), "nine digits required");
  assertFalse(isValidKraPin("A1234567890Z"), "not ten digits");
  assertFalse(isValidKraPin("A123456789"), "must end with a letter");
  assertFalse(isValidKraPin(""));
  assertFalse(isValidKraPin(null));
  assertFalse(isValidKraPin(123));
});

Deno.test("isValidKenyanPhone accepts local and international mobile forms", () => {
  for (const good of ["254712345678", "+254712345678", "0712345678",
                      "254110123456", "0110123456"]) {
    assert(isValidKenyanPhone(good), `should accept ${good}`);
  }
  for (const bad of ["12345", "255712345678", "07123456789", "+2547123",
                     "phone", "", null, undefined]) {
    assertFalse(isValidKenyanPhone(bad as unknown), `should reject ${bad}`);
  }
});

Deno.test("isInKenya bounds the coordinates", () => {
  assert(isInKenya(-1.286389, 36.817223), "Nairobi");
  assert(isInKenya(-4.0435, 39.6682), "Mombasa");
  assertFalse(isInKenya(51.5, -0.12), "London");
  assertFalse(isInKenya(0, 0), "null island");
});

Deno.test("ownsPath accepts only the caller's own folder, no tricks", () => {
  assert(ownsPath(`${UID}/photo.jpg`, UID));
  assert(ownsPath(`${UID}/deep/er/file.pdf`, UID));
  assertFalse(ownsPath("other-user/photo.jpg", UID));
  assertFalse(ownsPath(`${UID}`, UID), "a bare folder is not a file path");
  assertFalse(ownsPath(`${UID}/../other/file.jpg`, UID), "no traversal");
  assertFalse(ownsPath(`/${UID}/photo.jpg`, UID), "no leading slash");
  assertFalse(ownsPath("", UID));
  assertFalse(ownsPath(null, UID));
});

Deno.test("slugifyName produces url-safe hyphenated slugs", () => {
  assertEquals(slugifyName("Posh Palace Salon & Spa"), "posh-palace-salon-spa");
  assertEquals(slugifyName("  Café -- Nairobi!  "), "caf-nairobi");
});

Deno.test("newBusinessSlug appends a 6-char suffix", () => {
  const slug = newBusinessSlug("Posh Palace");
  assert(/^posh-palace-[0-9a-f]{6}$/.test(slug), slug);
  assert(newBusinessSlug("Posh Palace") !== newBusinessSlug("Posh Palace"));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --allow-env --node-modules-dir=none supabase/functions/_shared/onboarding.test.ts`
Expected: FAIL — module `./onboarding.ts` not found.

- [ ] **Step 3: Implement**

```ts
// _shared/onboarding.ts
// Pure validation for the business-intake pipeline. Dependency-free so the
// whole decision table is unit-testable without a network or database.

/** KRA PIN: A or P, nine digits, one trailing capital letter. */
export const KRA_PIN_RE = /^[AP][0-9]{9}[A-Z]$/;

export function isValidKraPin(v: unknown): boolean {
  return typeof v === "string" && KRA_PIN_RE.test(v);
}

/** Kenyan mobile: 07XX/01XX local, or 254/+254 international, 9 subscriber digits. */
const KE_PHONE_RE = /^(?:\+?254|0)(7\d{8}|1\d{8})$/;

export function isValidKenyanPhone(v: unknown): boolean {
  return typeof v === "string" && KE_PHONE_RE.test(v.replace(/[\s-]/g, ""));
}

/**
 * Loose Kenya bounding box. This is a sanity check that the pin is on the
 * right continent — hood-level truth is the human reviewer's job.
 */
export function isInKenya(lat: number, lng: number): boolean {
  return lat >= -4.9 && lat <= 5.5 && lng >= 33.5 && lng <= 42.0;
}

/**
 * True when `path` is a storage object path inside the caller's own folder:
 * `<uid>/<something>`, no traversal, no absolute paths. The storage RLS
 * policies enforce the same rule at write time; this re-checks it at intake
 * so a submitted path can never point at another user's evidence.
 */
export function ownsPath(path: unknown, uid: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 1024) return false;
  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments[0] !== uid) return false;
  return segments.slice(1).every((s) => s.length > 0 && s !== "." && s !== "..");
}

/** Lowercase, ascii-ish, hyphen-separated. */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Slug for a new listing: name + 6 random hex chars (uniqueness margin). */
export function newBusinessSlug(name: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const base = slugifyName(name) || "business";
  return `${base}-${suffix}`;
}
```

- [ ] **Step 4: Run tests**

Run: `deno test --allow-env --node-modules-dir=none supabase/functions/_shared/onboarding.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/onboarding.ts supabase/functions/_shared/onboarding.test.ts
git commit -m "feat(fn): pure validation helpers for business intake"
```

---

### Task 8: `business-intake` edge function (TDD)

**Files:**
- Create: `supabase/functions/business-intake/index.ts`
- Create: `supabase/functions/business-intake/index.test.ts`
- Modify: `supabase/config.toml` (append after the `[functions.send-onboarding-email]` block)

**Interfaces:**
- Consumes: Task 7 helpers; `_shared` cors/response/client/ratelimit/security; tables from Tasks 1–2.
- Produces: POST body `{ action: "register", name, category_slug, sub_type_slug?, city_slug, hood, address?, about, price_range?, phone, whatsapp?, email?, website?, hours_display, lat?, lng?, photo_paths: string[], id_document_path, kra_pin, applicant_note? }` → `200 { id, slug }`; or `{ action: "claim", business_id, role_title?, kra_pin, contact_phone, id_document_path, note? }` → `200 { id, status: "pending" }`. Errors: 400/401/404/405/409/429/500 as `{ error }`. Frontend (Tasks 12–13) invokes with these exact payloads.

- [ ] **Step 1: Write the failing tests**

```ts
// business-intake/index.test.ts
//
// Drives the real handler with a stubbed Supabase REST layer (same harness as
// mpesa-stk-push/index.test.ts). The question every test answers: can a caller
// create a listing/claim they shouldn't, or skip evidence they must provide?
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/business-intake/index.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";

const UID = "11111111-2222-4333-8444-555555555555";
const CITY_ID = "22222222-2222-4222-8222-222222222222";
const CAT_ID = "33333333-3333-4333-8333-333333333333";
const BIZ_ID = "44444444-4444-4444-8444-444444444444";

interface Call { url: string; method: string; body: unknown }
let calls: Call[];
let hits: Map<string, number>;
let state: {
  authed: boolean;
  cityRow: Record<string, unknown> | null;
  catRow: Record<string, unknown> | null;
  bizRow: Record<string, unknown> | null;      // claim target lookup
  pendingClaims: number;                        // duplicate-claim count
  verificationInsertFails: boolean;
};

const bucketOf = (ip: string, key: string) => `${ip}|${key}`;
const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  hits = new Map();
  state = {
    authed: true,
    cityRow: { id: CITY_ID, hoods: ["Kilimani", "CBD"] },
    catRow: { id: CAT_ID },
    bizRow: { id: BIZ_ID, status: "active", owner_id: null, name: "Unowned Co", tier: "free" },
    pendingClaims: 0,
    verificationInsertFails: false,
  };

  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const rawUrl = typeof input === "string" ? input : input.url;
    const url = decodeURIComponent(rawUrl);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    const jsonRes = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });

    if (url.includes("/auth/v1/user")) {
      return state.authed
        ? jsonRes({ id: UID, email: "owner@example.com" })
        : jsonRes({ message: "invalid token" }, 401);
    }
    if (url.includes("/rest/v1/rate_limits") && method === "HEAD") {
      const params = new URL(rawUrl).searchParams;
      const ip = (params.get("ip") ?? "").replace(/^eq\./, "");
      const key = (params.get("key") ?? "").replace(/^eq\./, "");
      const count = hits.get(bucketOf(ip, key)) ?? 0;
      return new Response(null, { status: 200, headers: { "content-range": `*/${count}` } });
    }
    if (url.includes("/rest/v1/rate_limits") && method === "POST") {
      const { ip, key } = body as { ip: string; key: string };
      hits.set(bucketOf(ip, key), (hits.get(bucketOf(ip, key)) ?? 0) + 1);
      return jsonRes([], 201);
    }
    if (url.includes("/rest/v1/cities") && method === "GET") {
      return jsonRes(state.cityRow ? [state.cityRow] : []);
    }
    if (url.includes("/rest/v1/categories") && method === "GET") {
      return jsonRes(state.catRow ? [state.catRow] : []);
    }
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes(state.bizRow ? [state.bizRow] : []);
    }
    if (url.includes("/rest/v1/businesses") && method === "POST") {
      return jsonRes([{ id: BIZ_ID, slug: (body as { slug: string }).slug }], 201);
    }
    if (url.includes("/rest/v1/businesses") && method === "DELETE") {
      return jsonRes([], 200);
    }
    if (url.includes("/rest/v1/business_verifications") && method === "POST") {
      return state.verificationInsertFails
        ? jsonRes({ message: "boom" }, 500)
        : jsonRes([], 201);
    }
    if (url.includes("/rest/v1/business_claims") && method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${state.pendingClaims}` },
      });
    }
    if (url.includes("/rest/v1/business_claims") && method === "POST") {
      return jsonRes([{ id: "55555555-5555-4555-8555-555555555555", status: "pending" }], 201);
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://karibu-test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
}

type Handler = (req: Request) => Response | Promise<Response>;
let cachedHandler: Handler | null = null;

async function loadHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler;
  const realServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: any) => {
    cachedHandler = typeof h === "function" ? h : h?.handler;
    return { finished: Promise.resolve(), shutdown() {}, ref() {}, unref() {} };
  };
  setEnv();
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

const REGISTER_BODY = {
  action: "register",
  name: "Posh Palace",
  category_slug: "beauty",
  city_slug: "nairobi",
  hood: "Kilimani",
  about: "A calm, spotless salon with senior stylists and fair prices.",
  phone: "0712345678",
  hours_display: "Mon-Sat 9am-7pm",
  photo_paths: [`${UID}/a.jpg`, `${UID}/b.jpg`, `${UID}/c.jpg`],
  id_document_path: `${UID}/id.jpg`,
  kra_pin: "A123456789Z",
};

const CLAIM_BODY = {
  action: "claim",
  business_id: BIZ_ID,
  kra_pin: "A123456789Z",
  contact_phone: "0712345678",
  id_document_path: `${UID}/id.jpg`,
};

function post(body: unknown, ip = "41.90.64.1"): Request {
  return new Request("https://karibu.test/functions/v1/business-intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      authorization: "Bearer user-jwt",
    },
    body: JSON.stringify(body),
  });
}

async function withStubs(fn: (handler: Handler) => Promise<void>) {
  const handler = await loadHandler();
  installFetchStub();
  try {
    await fn(handler);
  } finally {
    restoreFetch();
  }
}

const businessInserted = () =>
  calls.some((c) => c.url.includes("/rest/v1/businesses") && c.method === "POST");
const claimInserted = () =>
  calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "POST");

Deno.test("rejects an unauthenticated caller with 401 and writes nothing", async () => {
  await withStubs(async (handler) => {
    state.authed = false;
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 401);
    assert(!businessInserted());
  });
});

Deno.test("register: happy path inserts business + verification and returns the slug", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 200);
    const out = await res.json();
    assertEquals(out.id, BIZ_ID);
    assert(String(out.slug).startsWith("posh-palace-"));
    const bizCall = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "POST");
    const inserted = bizCall?.body as Record<string, unknown>;
    assertEquals(inserted.status, "pending");
    assertEquals(inserted.tier, "free");
    assertEquals(inserted.owner_id, UID);
    assert(calls.some((c) => c.url.includes("/rest/v1/business_verifications") && c.method === "POST"));
  });
});

Deno.test("register: a bad KRA PIN is a 400 before any write", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, kra_pin: "B123456789Z" }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: fewer than 3 photos is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, photo_paths: [`${UID}/a.jpg`] }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: a photo path in someone else's folder is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({
      ...REGISTER_BODY,
      photo_paths: [`${UID}/a.jpg`, `${UID}/b.jpg`, "other-user/c.jpg"],
    }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: an unknown hood for the city is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, hood: "Atlantis" }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: verification-insert failure compensates by deleting the business", async () => {
  await withStubs(async (handler) => {
    state.verificationInsertFails = true;
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 500);
    assert(
      calls.some((c) => c.url.includes("/rest/v1/businesses") && c.method === "DELETE"),
      "expected a compensating DELETE of the orphaned business row",
    );
  });
});

Deno.test("register: the 4th registration in a day is a 429", async () => {
  await withStubs(async (handler) => {
    for (let i = 0; i < 3; i++) {
      assertEquals((await handler(post(REGISTER_BODY))).status, 200);
    }
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 429);
  });
});

Deno.test("claim: happy path inserts a pending claim", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).status, "pending");
    assert(claimInserted());
  });
});

Deno.test("claim: an already-owned business is a 409", async () => {
  await withStubs(async (handler) => {
    state.bizRow = { ...state.bizRow!, owner_id: "99999999-9999-4999-8999-999999999999" };
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 409);
    assert(!claimInserted());
  });
});

Deno.test("claim: a duplicate pending claim is a 409", async () => {
  await withStubs(async (handler) => {
    state.pendingClaims = 1;
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 409);
    assert(!claimInserted());
  });
});

Deno.test("claim: a missing business is a 404", async () => {
  await withStubs(async (handler) => {
    state.bizRow = null;
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 404);
    assert(!claimInserted());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/business-intake/index.test.ts`
Expected: FAIL — `./index.ts` not found.

- [ ] **Step 3: Implement the handler**

```ts
// business-intake — a signed-in user registers a new business or claims an
// existing listing. This is the only door into `status='pending'` rows and
// `business_claims`; there are no client INSERT policies on either table.
//
// verify_jwt = true (the platform guarantees a valid JWT; we read the uid via
// the user client). All writes use the service role — validation here IS the
// gate, so validate everything and trust nothing from the payload.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { checkGlobalRateLimit, checkIpRateLimit } from "../_shared/ratelimit.ts";
import { clientIpFromXff } from "../_shared/security.ts";
import {
  isInKenya,
  isValidKenyanPhone,
  isValidKraPin,
  newBusinessSlug,
  ownsPath,
} from "../_shared/onboarding.ts";

const DAY_SECONDS = 24 * 60 * 60;
const IP_MAX_PER_DAY = 10;          // both actions share the per-IP bucket
const REGISTER_MAX_PER_DAY = 3;     // per authenticated user
const CLAIM_MAX_PER_DAY = 5;        // per authenticated user
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const optStr = (v: unknown, max: number): string | null => {
  const s = str(v);
  return s && s.length <= max ? s : null;
};

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const action = body.action;
  if (action !== "register" && action !== "claim") {
    return errorResponse("`action` must be register|claim", 400);
  }

  // --- Who is asking (verified JWT) --------------------------------------
  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);
  const uid = userData.user.id;

  const service = createServiceClient();
  const ip = clientIpFromXff(req.headers.get("x-forwarded-for"));

  // --- Rate limits (record-first helpers; RLS-independent) ----------------
  if (!(await checkIpRateLimit(service, ip, "business-intake", IP_MAX_PER_DAY, DAY_SECONDS))) {
    return errorResponse("Rate limit", 429);
  }
  const userKey = `business-intake:${action}:${uid}`;
  const userMax = action === "register" ? REGISTER_MAX_PER_DAY : CLAIM_MAX_PER_DAY;
  if (!(await checkGlobalRateLimit(service, userKey, userMax, DAY_SECONDS))) {
    return errorResponse("Rate limit", 429);
  }

  return action === "register"
    ? await register(service, uid, body)
    : await claim(service, uid, body);
});

// deno-lint-ignore no-explicit-any
async function register(service: any, uid: string, body: Record<string, unknown>) {
  // --- Validate every field before any write ------------------------------
  const name = optStr(body.name, 120);
  if (!name || name.length < 2) return errorResponse("`name` is required (2-120 chars)", 400);

  const about = optStr(body.about, 2000);
  if (!about || about.length < 20) {
    return errorResponse("`about` is required (20-2000 chars)", 400);
  }

  const categorySlug = str(body.category_slug);
  const citySlug = str(body.city_slug);
  const hood = optStr(body.hood, 80);
  if (!categorySlug || !citySlug || !hood) {
    return errorResponse("`category_slug`, `city_slug` and `hood` are required", 400);
  }

  const phone = str(body.phone);
  if (!isValidKenyanPhone(phone)) return errorResponse("`phone` must be a Kenyan number", 400);

  const hoursDisplay = optStr(body.hours_display, 200);
  if (!hoursDisplay) return errorResponse("`hours_display` is required", 400);

  if (!isValidKraPin(body.kra_pin)) {
    return errorResponse("`kra_pin` must match the KRA PIN format (e.g. A123456789Z)", 400);
  }

  const photoPaths = body.photo_paths;
  if (
    !Array.isArray(photoPaths) ||
    photoPaths.length < MIN_PHOTOS ||
    photoPaths.length > MAX_PHOTOS ||
    !photoPaths.every((p) => ownsPath(p, uid))
  ) {
    return errorResponse(
      `\`photo_paths\` must be ${MIN_PHOTOS}-${MAX_PHOTOS} uploads in your own folder`,
      400,
    );
  }
  if (!ownsPath(body.id_document_path, uid)) {
    return errorResponse("`id_document_path` must be an upload in your own folder", 400);
  }

  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  if ((lat === null) !== (lng === null)) {
    return errorResponse("`lat` and `lng` must be provided together", 400);
  }
  if (lat !== null && lng !== null && !isInKenya(lat, lng)) {
    return errorResponse("Location pin must be inside Kenya", 400);
  }

  // --- Resolve reference slugs (service role; anon could read these anyway)
  const { data: city } = await service
    .from("cities").select("id, hoods").eq("slug", citySlug).eq("is_active", true)
    .maybeSingle();
  if (!city) return errorResponse("Unknown city", 400);
  if (!Array.isArray(city.hoods) || !city.hoods.includes(hood)) {
    return errorResponse("Unknown hood for that city", 400);
  }

  const { data: category } = await service
    .from("categories").select("id").eq("slug", categorySlug).maybeSingle();
  if (!category) return errorResponse("Unknown category", 400);

  let subTypeId: string | null = null;
  const subTypeSlug = str(body.sub_type_slug);
  if (subTypeSlug) {
    const { data: subType } = await service
      .from("sub_types").select("id").eq("slug", subTypeSlug)
      .eq("category_id", category.id).maybeSingle();
    if (!subType) return errorResponse("Unknown sub-type for that category", 400);
    subTypeId = subType.id;
  }

  // --- Insert the pending listing -----------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publicPhotoUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/business-photos/${path}`;
  const photos = (photoPaths as string[]).map(publicPhotoUrl);

  // NOTE: .select() without .single() — PostgREST returns an array for
  // insert-with-representation, and the test stubs mirror that shape.
  const { data: createdRows, error: bizError } = await service
    .from("businesses")
    .insert({
      slug: newBusinessSlug(name),
      name,
      category_id: category.id,
      sub_type_id: subTypeId,
      city_id: city.id,
      hood,
      address: optStr(body.address, 200),
      about,
      price_range: optStr(body.price_range, 60),
      phone,
      whatsapp: isValidKenyanPhone(body.whatsapp) ? str(body.whatsapp) : null,
      email: optStr(body.email, 200),
      website: optStr(body.website, 300),
      // A plain string value: jsonb stores it as a JSON string, and
      // useBusinessDetail already accepts that shape. Do NOT JSON.stringify
      // here — supabase-js serializes the body; stringifying would double-encode.
      hours_json: hoursDisplay,
      hero_image_url: photos[0],
      gallery_image_urls: photos.slice(1),
      location: lat !== null ? `SRID=4326;POINT(${lng} ${lat})` : null,
      status: "pending",
      tier: "free",
      owner_id: uid,
    })
    .select("id, slug");

  const created = createdRows?.[0];
  if (bizError || !created) {
    console.error("business-intake: business insert failed:", bizError?.message);
    return errorResponse("Could not save your application", 500);
  }

  // --- Evidence row; compensate if it fails so no partial application lives
  const { error: verError } = await service.from("business_verifications").insert({
    business_id: created.id,
    submitted_by: uid,
    kra_pin: body.kra_pin,
    contact_phone: phone,
    id_document_path: body.id_document_path,
    applicant_note: optStr(body.applicant_note, 2000),
  });

  if (verError) {
    console.error("business-intake: verification insert failed:", verError.message);
    await service.from("businesses").delete().eq("id", created.id);
    return errorResponse("Could not save your application", 500);
  }

  return json({ id: created.id, slug: created.slug });
}

// deno-lint-ignore no-explicit-any
async function claim(service: any, uid: string, body: Record<string, unknown>) {
  const businessId = str(body.business_id);
  if (!businessId) return errorResponse("`business_id` is required", 400);
  if (!isValidKraPin(body.kra_pin)) {
    return errorResponse("`kra_pin` must match the KRA PIN format (e.g. A123456789Z)", 400);
  }
  const contactPhone = str(body.contact_phone);
  if (!isValidKenyanPhone(contactPhone)) {
    return errorResponse("`contact_phone` must be a Kenyan number", 400);
  }
  if (!ownsPath(body.id_document_path, uid)) {
    return errorResponse("`id_document_path` must be an upload in your own folder", 400);
  }

  const { data: biz } = await service
    .from("businesses").select("id, status, owner_id").eq("id", businessId).maybeSingle();
  if (!biz) return errorResponse("Business not found", 404);
  if (biz.status !== "active") return errorResponse("This listing cannot be claimed", 409);
  if (biz.owner_id) return errorResponse("This listing is already managed", 409);

  const { count: openClaims } = await service
    .from("business_claims")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("claimant_id", uid)
    .eq("status", "pending");
  if ((openClaims ?? 0) > 0) {
    return errorResponse("You already have a claim under review for this listing", 409);
  }

  const { data: createdRows, error: insertError } = await service
    .from("business_claims")
    .insert({
      business_id: businessId,
      claimant_id: uid,
      role_title: optStr(body.role_title, 80),
      kra_pin: body.kra_pin,
      contact_phone: contactPhone,
      id_document_path: body.id_document_path,
      note: optStr(body.note, 2000),
    })
    .select("id, status");

  const created = createdRows?.[0];
  if (insertError || !created) {
    // 23505 = the partial unique index caught a race on the pending claim.
    const conflict = insertError?.code === "23505";
    if (!conflict) console.error("business-intake: claim insert failed:", insertError?.message);
    return conflict
      ? errorResponse("You already have a claim under review for this listing", 409)
      : errorResponse("Could not save your claim", 500);
  }

  return json({ id: created.id, status: created.status });
}
```

- [ ] **Step 4: Run tests**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/business-intake/index.test.ts`
Expected: PASS (13 tests). If `.single()`/`.maybeSingle()` response shapes trip a stub, fix the stub to mirror real PostgREST (arrays for GET/POST-with-representation), never the handler's contract.

- [ ] **Step 5: Register in config.toml**

Append after the `[functions.send-onboarding-email]` block:

```toml
# User-acting: a signed-in user registers a new business or claims an existing
# listing. JWT required for identity; the function validates all evidence
# server-side (KRA format, own-folder storage paths, reference slugs) and
# writes with the service role — there are no client INSERT policies on
# businesses/business_claims/business_verifications by design.
[functions.business-intake]
verify_jwt = true
```

- [ ] **Step 6: Run all Deno tests**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`
Expected: all pass (existing 66+ plus the new ones).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/business-intake/ supabase/config.toml
git commit -m "feat(fn): business-intake edge function (register + claim)"
```

---

### Task 9: `admin-review` edge function (TDD)

**Files:**
- Create: `supabase/functions/admin-review/index.ts`
- Create: `supabase/functions/admin-review/index.test.ts`
- Modify: `supabase/config.toml` (append after the new `[functions.business-intake]` block)

**Interfaces:**
- Consumes: tables from Tasks 1–4; `send-onboarding-email` (existing, internal-secret header `x-karibu-internal-secret`); `_shared` helpers.
- Produces: POST bodies →
  - `{ action: "queue", cursor? }` → `200 { registrations: [...], claims: [...] }`, each item carrying `id_document_url` (10-min signed URL);
  - `{ action: "approve", kind: "registration"|"claim", id }` → `200 { ok: true }`;
  - `{ action: "reject", kind, id, reason }` → `200 { ok: true }`.
  - Errors: 400/401/403/405/409/500 as `{ error }`. AdminReviewPage (Task 14) invokes these exact shapes.

- [ ] **Step 1: Write the failing tests**

```ts
// admin-review/index.test.ts
//
// The staff gate is the whole point: verify_jwt=true only proves "some user".
// Every test asks: can a non-staff caller decide anything, and is every
// decision guarded + logged?
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/admin-review/index.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

const STAFF_UID = "aaaaaaaa-1111-4111-8111-111111111111";
const OWNER_UID = "bbbbbbbb-2222-4222-8222-222222222222";
const BIZ_ID = "44444444-4444-4444-8444-444444444444";
const CLAIM_ID = "55555555-5555-4555-8555-555555555555";

interface Call { url: string; method: string; body: unknown }
let calls: Call[];
let state: {
  isStaff: boolean;
  bizPatchRows: Record<string, unknown>[]; // what PATCH /businesses returns
  claimRow: Record<string, unknown> | null;
  claimPatchRows: Record<string, unknown>[];
};

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  state = {
    isStaff: true,
    bizPatchRows: [{ id: BIZ_ID, name: "Posh Palace", tier: "free", owner_id: OWNER_UID }],
    claimRow: {
      id: CLAIM_ID, business_id: BIZ_ID, claimant_id: OWNER_UID, status: "pending",
      business: { id: BIZ_ID, name: "Unowned Co", tier: "free" },
    },
    claimPatchRows: [{ id: CLAIM_ID, status: "approved" }],
  };

  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const rawUrl = typeof input === "string" ? input : input.url;
    const url = decodeURIComponent(rawUrl);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    const jsonRes = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });

    if (url.includes("/auth/v1/user")) {
      return jsonRes({ id: STAFF_UID, email: "staff@karibu.co.ke" });
    }
    if (url.includes("/rest/v1/profiles") && method === "GET") {
      // is_staff lookup, and the owner-email lookup for the welcome mail.
      const params = new URL(rawUrl).searchParams;
      const idFilter = (params.get("id") ?? "").replace(/^eq\./, "");
      if (idFilter === STAFF_UID) return jsonRes([{ is_staff: state.isStaff }]);
      return jsonRes([{ email: "owner@example.com" }]);
    }
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes([]); // queue: no pending registrations in these tests
    }
    if (url.includes("/rest/v1/businesses") && method === "PATCH") {
      return jsonRes(state.bizPatchRows);
    }
    if (url.includes("/rest/v1/business_claims") && method === "GET") {
      return jsonRes(state.claimRow ? [state.claimRow] : []);
    }
    if (url.includes("/rest/v1/business_claims") && method === "PATCH") {
      return jsonRes(state.claimPatchRows);
    }
    if (url.includes("/rest/v1/admin_decisions") && method === "POST") {
      return jsonRes([], 201);
    }
    if (url.includes("/storage/v1/object/sign/")) {
      return jsonRes({ signedURL: "/object/sign/verification-docs/x?token=t" });
    }
    if (url.includes("/functions/v1/send-onboarding-email")) {
      return jsonRes({ ok: true });
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

type Handler = (req: Request) => Response | Promise<Response>;
let cachedHandler: Handler | null = null;

async function loadHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler;
  const realServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: any) => {
    cachedHandler = typeof h === "function" ? h : h?.handler;
    return { finished: Promise.resolve(), shutdown() {}, ref() {}, unref() {} };
  };
  Deno.env.set("SUPABASE_URL", "https://karibu-test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  Deno.env.set("INTERNAL_FUNCTION_SECRET", "internal-secret");
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

function post(body: unknown): Request {
  return new Request("https://karibu.test/functions/v1/admin-review", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer staff-jwt" },
    body: JSON.stringify(body),
  });
}

async function withStubs(fn: (handler: Handler) => Promise<void>) {
  const handler = await loadHandler();
  installFetchStub();
  try {
    await fn(handler);
  } finally {
    restoreFetch();
  }
}

const decisionLogged = () =>
  calls.some((c) => c.url.includes("/rest/v1/admin_decisions") && c.method === "POST");
const emailFired = () =>
  calls.some((c) => c.url.includes("/functions/v1/send-onboarding-email"));

Deno.test("a non-staff user is 403 for every action and decides nothing", async () => {
  await withStubs(async (handler) => {
    state.isStaff = false;
    for (const body of [
      { action: "queue" },
      { action: "approve", kind: "registration", id: BIZ_ID },
      { action: "reject", kind: "claim", id: CLAIM_ID, reason: "no evidence" },
    ]) {
      const res = await handler(post(body));
      assertEquals(res.status, 403, JSON.stringify(body));
    }
    assertFalse(decisionLogged());
  });
});

Deno.test("queue returns registrations and claims", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "queue" }));
    assertEquals(res.status, 200);
    const out = await res.json();
    assert(Array.isArray(out.registrations));
    assert(Array.isArray(out.claims));
  });
});

Deno.test("approve registration: activates, logs, and fires the welcome email", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 200);
    const patch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assert(patch, "expected a guarded UPDATE on businesses");
    assertEquals((patch!.body as Record<string, unknown>).status, "active");
    assert(String(patch!.url).includes("status=eq.pending"), "guard: WHERE status='pending'");
    assert(decisionLogged());
    const mail = calls.find((c) => c.url.includes("/functions/v1/send-onboarding-email"));
    assert(mail, "welcome email fired");
  });
});

Deno.test("approve registration twice: the second is a 409 no-op with no email", async () => {
  await withStubs(async (handler) => {
    state.bizPatchRows = []; // the guard matched no row
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 409);
    assertFalse(decisionLogged());
    assertFalse(emailFired());
  });
});

Deno.test("approve registration still succeeds when the email endpoint fails", async () => {
  await withStubs(async (handler) => {
    // Re-stub the email endpoint to blow up.
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/functions/v1/send-onboarding-email")) {
        return new Response("boom", { status: 500 });
      }
      // deno-lint-ignore no-explicit-any
      return inner(input as any, init as any);
    }) as typeof fetch;
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 200, "email failure never blocks the approval");
  });
});

Deno.test("approve claim: assigns the owner (guarded) and marks the claim", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "approve", kind: "claim", id: CLAIM_ID }));
    assertEquals(res.status, 200);
    const bizPatch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assert(bizPatch);
    assert(String(bizPatch!.url).includes("owner_id=is.null"), "guard: WHERE owner_id IS NULL");
    assert(calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "PATCH"));
    assert(decisionLogged());
  });
});

Deno.test("approve claim on a now-owned business is a 409, claim left pending", async () => {
  await withStubs(async (handler) => {
    state.bizPatchRows = [];
    const res = await handler(post({ action: "approve", kind: "claim", id: CLAIM_ID }));
    assertEquals(res.status, 409);
    assertFalse(
      calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "PATCH"),
      "the claim row is untouched for a manual decision",
    );
  });
});

Deno.test("reject requires a reason", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "reject", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 400);
    assertFalse(decisionLogged());
  });
});

Deno.test("reject registration unlists the business and logs the reason", async () => {
  await withStubs(async (handler) => {
    const res = await handler(
      post({ action: "reject", kind: "registration", id: BIZ_ID, reason: "photos are stock images" }),
    );
    assertEquals(res.status, 200);
    const patch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assertEquals((patch!.body as Record<string, unknown>).status, "unlisted");
    const log = calls.find((c) => c.url.includes("/rest/v1/admin_decisions"));
    assertEquals((log!.body as Record<string, unknown>).reason, "photos are stock images");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/admin-review/index.test.ts`
Expected: FAIL — `./index.ts` not found.

- [ ] **Step 3: Implement the handler**

```ts
// admin-review — the staff-only onboarding queue: list pending registrations
// and claims, approve or reject each, log every decision, and fire the
// welcome email on approval.
//
// verify_jwt = true authenticates "some user"; AUTHORIZATION is the
// profiles.is_staff flag read here with the service role. A valid JWT without
// the flag buys exactly a 403.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { INTERNAL_SECRET_HEADER } from "../_shared/internal-auth.ts";

const SIGNED_URL_SECONDS = 600; // 10 minutes: long enough to review, not to share
const QUEUE_PAGE = 20;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);
  const staffId = userData.user.id;

  const service = createServiceClient();
  const { data: me } = await service
    .from("profiles").select("is_staff").eq("id", staffId).maybeSingle();
  if (!me?.is_staff) return errorResponse("Staff only", 403);

  switch (body.action) {
    case "queue":
      return await queue(service, body);
    case "approve":
      return await decide(service, staffId, body, "approved");
    case "reject":
      return await decide(service, staffId, body, "rejected");
    default:
      return errorResponse("`action` must be queue|approve|reject", 400);
  }
});

// deno-lint-ignore no-explicit-any
async function signDoc(service: any, path: string): Promise<string | null> {
  const { data } = await service.storage
    .from("verification-docs")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

// deno-lint-ignore no-explicit-any
async function queue(service: any, body: Record<string, unknown>) {
  const cursor = typeof body.cursor === "string" ? body.cursor : null;

  let regQuery = service
    .from("businesses")
    .select(
      "id, slug, name, hood, created_at, city:cities(name), category:categories(label), " +
        "verification:business_verifications(kra_pin, contact_phone, id_document_path, applicant_note)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_PAGE);
  if (cursor) regQuery = regQuery.gt("created_at", cursor);
  const { data: registrations, error: regError } = await regQuery;
  if (regError) {
    console.error("admin-review queue (registrations):", regError.message);
    return errorResponse("Could not load the queue", 500);
  }

  let claimQuery = service
    .from("business_claims")
    .select(
      "id, business_id, claimant_id, role_title, kra_pin, contact_phone, " +
        "id_document_path, note, created_at, business:businesses(name, slug)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_PAGE);
  if (cursor) claimQuery = claimQuery.gt("created_at", cursor);
  const { data: claims, error: claimError } = await claimQuery;
  if (claimError) {
    console.error("admin-review queue (claims):", claimError.message);
    return errorResponse("Could not load the queue", 500);
  }

  // Attach short-lived signed URLs so staff can view private ID docs.
  // deno-lint-ignore no-explicit-any
  const withDocUrl = async (row: any, path: string | undefined) => ({
    ...row,
    id_document_url: path ? await signDoc(service, path) : null,
  });
  const regsOut = await Promise.all(
    (registrations ?? []).map((r: Record<string, unknown>) =>
      // deno-lint-ignore no-explicit-any
      withDocUrl(r, (r.verification as any)?.id_document_path)
    ),
  );
  const claimsOut = await Promise.all(
    (claims ?? []).map((c: Record<string, unknown>) =>
      withDocUrl(c, c.id_document_path as string)
    ),
  );

  return json({ registrations: regsOut, claims: claimsOut });
}

// deno-lint-ignore no-explicit-any
async function decide(
  service: any,
  staffId: string,
  body: Record<string, unknown>,
  action: "approved" | "rejected",
) {
  const kind = body.kind;
  const id = typeof body.id === "string" ? body.id : null;
  if ((kind !== "registration" && kind !== "claim") || !id) {
    return errorResponse("`kind` (registration|claim) and `id` are required", 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (action === "rejected" && (reason.length < 3 || reason.length > 2000)) {
    return errorResponse("`reason` is required to reject (3-2000 chars)", 400);
  }

  let emailTo: string | null = null;
  let emailBusinessName = "";
  let emailTier = "free";

  if (kind === "registration") {
    if (action === "approved") {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ status: "active", verified_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id, name, tier, owner_id");
      if (error) return errorResponse("Could not approve", 500);
      const biz = rows?.[0];
      if (!biz) return errorResponse("Already decided or not found", 409);
      emailBusinessName = biz.name;
      emailTier = biz.tier;
      emailTo = await ownerEmail(service, biz.owner_id);
    } else {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ status: "unlisted" })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) return errorResponse("Could not reject", 500);
      if (!rows?.[0]) return errorResponse("Already decided or not found", 409);
    }
  } else {
    // Claims: read the pending claim first so we know business + claimant.
    const { data: claimRows } = await service
      .from("business_claims")
      .select("id, business_id, claimant_id, status, business:businesses(name, tier)")
      .eq("id", id)
      .eq("status", "pending");
    const claimRow = claimRows?.[0];
    if (!claimRow) return errorResponse("Already decided or not found", 409);

    if (action === "approved") {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ owner_id: claimRow.claimant_id })
        .eq("id", claimRow.business_id)
        .is("owner_id", null)
        .select("id, name, tier");
      if (error) return errorResponse("Could not approve", 500);
      if (!rows?.[0]) {
        // Owner appeared since (another claim won the race). Leave this claim
        // pending so a human rejects it with a real reason.
        return errorResponse("This listing already has an owner", 409);
      }
      emailBusinessName = rows[0].name;
      emailTier = rows[0].tier;
      emailTo = await ownerEmail(service, claimRow.claimant_id);
    }

    const { error: claimUpdateError } = await service
      .from("business_claims")
      .update({ status: action, decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (claimUpdateError) return errorResponse("Could not record the decision", 500);
  }

  const { error: logError } = await service.from("admin_decisions").insert({
    subject_type: kind,
    subject_id: id,
    action,
    reason: reason || null,
    decided_by: staffId,
  });
  if (logError) console.error("admin-review: decision log failed:", logError.message);

  // Welcome email on approval — fire-and-forget: a mail failure is logged,
  // never surfaced, and never rolls back the decision.
  if (action === "approved" && emailTo) {
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-onboarding-email`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [INTERNAL_SECRET_HEADER]: Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
          },
          body: JSON.stringify({ to: emailTo, businessName: emailBusinessName, tier: emailTier }),
        },
      );
      if (!res.ok) console.error("admin-review: welcome email failed:", res.status);
    } catch (e) {
      console.error("admin-review: welcome email failed:", e);
    }
  }

  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function ownerEmail(service: any, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await service
    .from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/admin-review/index.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Register in config.toml**

Append after the `[functions.business-intake]` block:

```toml
# Staff-only: the onboarding review queue. JWT authenticates the caller; the
# real authorization is profiles.is_staff, checked inside with the service
# role (verify_jwt=true alone would admit any visitor — the anon key is a
# valid JWT). Approvals fire send-onboarding-email server-to-server with the
# x-karibu-internal-secret header.
[functions.admin-review]
verify_jwt = true
```

- [ ] **Step 6: Run all Deno tests**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/admin-review/ supabase/config.toml
git commit -m "feat(fn): admin-review edge function (queue, approve, reject, decision log, welcome email)"
```

---

### Task 10: WelcomePage return path

**Files:**
- Modify: `src/pages/WelcomePage.jsx` (the signed-in redirect effect near line 62)
- Create: `src/pages/WelcomePage.next.test.jsx`

**Interfaces:**
- Produces: `navigate("/welcome", { state: { next: "/some/path" } })` returns the user to `next` after sign-in (password/instant flows; OAuth/magic-link redirects lose router state and fall back to `/profile` — acceptable). Consumed by Tasks 11–13.

- [ ] **Step 1: Write the failing test**

```jsx
// WelcomePage.next.test.jsx — a signed-in visit to /welcome honours
// location.state.next so auth-gated flows can bounce through sign-in.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import WelcomePage from "./WelcomePage.jsx";

const { authState } = vi.hoisted(() => ({
  authState: { current: { session: { user: { id: "u1" } }, loading: false } },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));

function mount(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/profile" element={<div>PROFILE ROUTE</div>} />
        <Route path="/for-business/register" element={<div>REGISTER ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("already signed in with a next state: lands on next", async () => {
  mount({ pathname: "/welcome", state: { next: "/for-business/register" } });
  expect(await screen.findByText("REGISTER ROUTE")).toBeInTheDocument();
});

test("already signed in without next: lands on /profile as before", async () => {
  mount({ pathname: "/welcome" });
  expect(await screen.findByText("PROFILE ROUTE")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/WelcomePage.next.test.jsx`
Expected: first test FAILS (lands on PROFILE ROUTE), second passes.

- [ ] **Step 3: Implement**

In `src/pages/WelcomePage.jsx`: import `useLocation` from react-router-dom (extend the existing import), then change the redirect effect (currently `if (!loading && session) navigate("/profile", { replace: true });`) to:

```jsx
  const location = useLocation();
  // Auth-gated flows pass state.next to come back here after sign-in. OAuth
  // and magic-link redirects lose router state and fall back to /profile.
  const next = location.state?.next || "/profile";
  useEffect(() => {
    if (!loading && session) navigate(next, { replace: true });
  }, [loading, session, navigate, next]);
```

(Keep the surrounding comment about the OAuth redirect landing back here.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/WelcomePage.next.test.jsx src/pages/WelcomePage.test.jsx`
Expected: PASS (new tests + existing WelcomePage tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/pages/WelcomePage.jsx src/pages/WelcomePage.next.test.jsx
git commit -m "feat(auth): WelcomePage honours a return path after sign-in"
```

---

### Task 11: ForBusinessPage — live CTAs + "Your applications" block

**Files:**
- Create: `src/components/business/ApplicationsBlock.jsx`
- Modify: `src/pages/ForBusinessPage.jsx` (tier CTA button ~line 140; insert block after the hero section)
- Create: `src/pages/ForBusinessPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` (`{ session, user }`), `supabase` client, owner-read RLS on `businesses`, claimant-read RLS on `business_claims` (Task 2), `/for-business/register` route (Task 12), WelcomePage `next` (Task 10).
- Produces: every tier CTA navigates signed-in users to `/for-business/register`, signed-out users to `/welcome` with `state.next`; a signed-in user with applications sees their statuses.

- [ ] **Step 1: Write the failing tests**

```jsx
// ForBusinessPage.test.jsx — the CTAs are alive: signed-out goes to sign-in
// (with a return path), signed-in goes to the intake form. The applications
// block renders own listings/claims with status chips and renders nothing on
// error or when empty.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ForBusinessPage from "./ForBusinessPage.jsx";

const { authState, dbState } = vi.hoisted(() => ({
  authState: { current: { session: null, user: null } },
  dbState: { current: { businesses: [], claims: [], fail: false } },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../lib/supabase", () => {
  const table = (rows) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () =>
        Promise.resolve(
          dbState.current.fail
            ? { data: null, error: { message: "boom" } }
            : { data: rows(), error: null },
        ),
    };
    return chain;
  };
  return {
    supabase: {
      from: (name) =>
        name === "businesses"
          ? table(() => dbState.current.businesses)
          : table(() => dbState.current.claims),
    },
  };
});

function WelcomeProbe() {
  const location = useLocation();
  return <div>WELCOME next={location.state?.next}</div>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/for-business"]}>
      <Routes>
        <Route path="/for-business" element={<ForBusinessPage />} />
        <Route path="/for-business/register" element={<div>REGISTER ROUTE</div>} />
        <Route path="/welcome" element={<WelcomeProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("signed out: a tier CTA bounces through /welcome with a return path", async () => {
  authState.current = { session: null, user: null };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "List for free" }));
  expect(
    await screen.findByText("WELCOME next=/for-business/register"),
  ).toBeInTheDocument();
});

test("signed in: a tier CTA goes straight to the intake form", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "Get Verified" }));
  expect(await screen.findByText("REGISTER ROUTE")).toBeInTheDocument();
});

test("signed in with applications: statuses are shown", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  dbState.current = {
    fail: false,
    businesses: [{ id: "b1", slug: "posh-palace-abc123", name: "Posh Palace", status: "pending" }],
    claims: [{ id: "c1", status: "rejected", business: { name: "Unowned Co", slug: "unowned" } }],
  };
  mount();
  expect(await screen.findByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getByText("Under review")).toBeInTheDocument();
  expect(screen.getByText("Unowned Co")).toBeInTheDocument();
  expect(screen.getByText("Not approved")).toBeInTheDocument();
});

test("fetch error: the block renders nothing and the page survives", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  dbState.current = { fail: true, businesses: [], claims: [] };
  mount();
  expect(await screen.findByRole("button", { name: "List for free" })).toBeInTheDocument();
  expect(screen.queryByText("Your applications")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/ForBusinessPage.test.jsx`
Expected: FAIL (CTAs have no onClick; ApplicationsBlock doesn't exist).

- [ ] **Step 3: Create ApplicationsBlock**

```jsx
// src/components/business/ApplicationsBlock.jsx
// "Your applications" on /for-business: the signed-in user's own listings
// (any status — owner-read RLS) and claims (claimant-read RLS), with status
// chips. Degrades to nothing on any error or when there is nothing to show —
// it must never blank the marketing page.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext.jsx";

const BUSINESS_STATUS = {
  pending: { label: "Under review", cls: "bg-amber-100 text-amber-800" },
  active: { label: "Live", cls: "bg-green-100 text-green-800" },
  unlisted: { label: "Not approved", cls: "bg-stone-200 text-stone-600" },
  suspended: { label: "Suspended", cls: "bg-red-100 text-red-700" },
};
const CLAIM_STATUS = {
  pending: { label: "Under review", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Not approved", cls: "bg-stone-200 text-stone-600" },
};

function StatusChip({ map, status }) {
  const meta = map[status] || { label: status, cls: "bg-stone-200 text-stone-600" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export default function ApplicationsBlock() {
  const { user } = useAuth();
  const [apps, setApps] = useState(null);

  useEffect(() => {
    if (!user) {
      setApps(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const [biz, claims] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, slug, name, status")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("business_claims")
          .select("id, status, business:businesses(name, slug)")
          .eq("claimant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled || biz.error || claims.error) return;
      setApps({ businesses: biz.data ?? [], claims: claims.data ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !apps) return null;
  if (apps.businesses.length === 0 && apps.claims.length === 0) return null;

  return (
    <div className="px-5 md:px-8 pt-6">
      <h2 className="font-serif text-xl text-ink mb-3">Your applications</h2>
      <div className="space-y-2">
        {apps.businesses.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-sm">{b.name}</p>
              <p className="text-xs text-stone-500">New listing</p>
            </div>
            <StatusChip map={BUSINESS_STATUS} status={b.status} />
          </div>
        ))}
        {apps.claims.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-sm">{c.business?.name || "Listing"}</p>
              <p className="text-xs text-stone-500">Ownership claim</p>
            </div>
            <StatusChip map={CLAIM_STATUS} status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire ForBusinessPage**

In `src/pages/ForBusinessPage.jsx`:
1. Add imports at the top: `import { useAuth } from "../context/AuthContext.jsx";` and `import ApplicationsBlock from "../components/business/ApplicationsBlock.jsx";`
2. Inside `BusinessSignupScreen`, add `const navigate = useNavigate();` and `const { session } = useAuth();` (a `useNavigate` import already exists at the top of the file) and a helper:

```jsx
  const startApplication = () => {
    if (session) navigate("/for-business/register");
    else navigate("/welcome", { state: { next: "/for-business/register" } });
  };
```

3. On the tier CTA button (the one rendering `{t.cta}` near line 140), add `onClick={startApplication}`.
4. Insert `<ApplicationsBlock />` immediately after the hero `</div>` (the closing tag of the `relative bg-forest ...` section), before the tier cards section.
5. If `BusinessSignupScreen` receives navigation via a `back` prop only, do not change its props; use the local `useNavigate` result.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/ForBusinessPage.test.jsx`
Expected: PASS (4 tests). Note: the route `/for-business/register` is only registered in Task 12's routes change; these tests provide their own stub route so they pass now.

- [ ] **Step 6: Commit**

```bash
git add src/components/business/ApplicationsBlock.jsx src/pages/ForBusinessPage.jsx src/pages/ForBusinessPage.test.jsx
git commit -m "feat(ui): live for-business CTAs and the applications status block"
```

---

### Task 12: RegisterBusinessPage + route

**Files:**
- Create: `src/pages/RegisterBusinessPage.jsx`
- Modify: `src/routes.jsx` (add import + route under `FullBleedLayout`)
- Create: `src/pages/RegisterBusinessPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()`, `useReferenceData()` (`cities: [{ key, label, hoods }]`, `categories: [{ key, label, subTypes: [{ key, label }] }]`), `supabase.storage.from(bucket).upload(path, file)`, `supabase.functions.invoke("business-intake", { body })` with the Task 8 register payload.
- Produces: route `/for-business/register`; on success an "under review" confirmation.

- [ ] **Step 1: Write the failing tests**

```jsx
// RegisterBusinessPage.test.jsx — signed-out visitors get a sign-in prompt
// (never a dead form); signed-in submission calls business-intake with the
// intake payload and ends on the under-review confirmation.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RegisterBusinessPage from "./RegisterBusinessPage.jsx";

const { authState, invokeSpy, uploadSpy } = vi.hoisted(() => ({
  authState: { current: { session: null, user: null } },
  invokeSpy: vi.fn(() => Promise.resolve({ data: { id: "b1", slug: "s" }, error: null })),
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../context/ReferenceDataContext.jsx", () => ({
  useReferenceData: () => ({
    cities: [{ key: "nairobi", label: "Nairobi", hoods: ["Kilimani", "CBD"] }],
    categories: [
      { key: "beauty", label: "Beauty", subTypes: [{ key: "hair", label: "Hair" }] },
    ],
  }),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadSpy }) },
    functions: { invoke: invokeSpy },
  },
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/for-business/register"]}>
      <Routes>
        <Route path="/for-business/register" element={<RegisterBusinessPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeFile(name) {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  invokeSpy.mockClear();
  uploadSpy.mockClear();
});

test("signed out: prompts sign-in instead of a form", async () => {
  authState.current = { session: null, user: null };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});

test("signed in: a complete form submits the register payload and confirms", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  const user = userEvent.setup();
  mount();

  await user.type(screen.getByLabelText(/business name/i), "Posh Palace");
  await user.selectOptions(screen.getByLabelText(/category/i), "beauty");
  await user.selectOptions(screen.getByLabelText(/^city/i), "nairobi");
  await user.selectOptions(screen.getByLabelText(/neighbourhood/i), "Kilimani");
  await user.type(
    screen.getByLabelText(/about/i),
    "A calm, spotless salon with senior stylists and fair prices.",
  );
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.type(screen.getByLabelText(/opening hours/i), "Mon-Sat 9am-7pm");
  await user.type(screen.getByLabelText(/kra pin/i), "A123456789Z");
  await user.upload(
    screen.getByLabelText(/photos/i),
    [makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")],
  );
  await user.upload(screen.getByLabelText(/id document/i), makeFile("id.jpg"));

  await user.click(screen.getByRole("button", { name: /submit application/i }));

  await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
  const [name, { body }] = invokeSpy.mock.calls[0];
  expect(name).toBe("business-intake");
  expect(body.action).toBe("register");
  expect(body.kra_pin).toBe("A123456789Z");
  expect(body.photo_paths).toHaveLength(3);
  expect(uploadSpy).toHaveBeenCalledTimes(4); // 3 photos + 1 ID doc
  expect(await screen.findByText(/under review/i)).toBeInTheDocument();
});

test("missing photos: submit is blocked with an inline error, nothing invoked", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  const user = userEvent.setup();
  mount();
  // Fill everything EXCEPT photos so the photo check is the one that fires
  // (validation reports the first missing field).
  await user.type(screen.getByLabelText(/business name/i), "Posh Palace");
  await user.selectOptions(screen.getByLabelText(/category/i), "beauty");
  await user.selectOptions(screen.getByLabelText(/^city/i), "nairobi");
  await user.selectOptions(screen.getByLabelText(/neighbourhood/i), "Kilimani");
  await user.type(
    screen.getByLabelText(/about/i),
    "A calm, spotless salon with senior stylists and fair prices.",
  );
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.type(screen.getByLabelText(/opening hours/i), "Mon-Sat 9am-7pm");
  await user.type(screen.getByLabelText(/kra pin/i), "A123456789Z");
  await user.click(screen.getByRole("button", { name: /submit application/i }));
  expect(await screen.findByText(/at least 3 photos/i)).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/RegisterBusinessPage.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```jsx
// src/pages/RegisterBusinessPage.jsx
// The intake form for a NEW listing (spec: onboarding spine). Uploads go
// straight to storage from the browser (own-folder paths, enforced by
// storage RLS); the business-intake edge function is the only writer of the
// pending row. The server re-validates everything — this form's checks are
// UX, not security.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [...PHOTO_TYPES, "application/pdf"];

function fileProblem(file, types) {
  if (!types.includes(file.type)) return `${file.name}: unsupported file type`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: larger than 5 MB`;
  return null;
}

const field =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-sm font-semibold text-ink mb-1.5";

export default function RegisterBusinessPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { cities, categories } = useReferenceData();

  const [form, setForm] = useState({
    name: "",
    category_slug: "",
    sub_type_slug: "",
    city_slug: "",
    hood: "",
    address: "",
    about: "",
    phone: "",
    hours_display: "",
    kra_pin: "",
    applicant_note: "",
    lat: null,
    lng: null,
  });
  const [photos, setPhotos] = useState([]); // File[]
  const [idDoc, setIdDoc] = useState(null); // File | null
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const city = useMemo(
    () => cities.find((c) => c.key === form.city_slug) || null,
    [cities, form.city_slug],
  );
  const category = useMemo(
    () => categories.find((c) => c.key === form.category_slug) || null,
    [categories, form.category_slug],
  );

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">List your business</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Sign in first so we know who to talk to about your application.
        </p>
        <button
          type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() =>
            navigate("/welcome", { state: { next: "/for-business/register" } })
          }
        >
          Sign in to continue
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Application received</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Your listing is under review. Our Nairobi team checks every
          application by hand — allow up to 48 hours. You can follow its status
          on the For Business page.
        </p>
        <button
          type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/for-business")}
        >
          Back to For Business
        </button>
      </div>
    );
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        })),
      () => setError("Couldn't read your location — you can leave the pin empty."),
    );
  };

  const onPhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    for (const f of files) {
      const problem = fileProblem(f, PHOTO_TYPES);
      if (problem) return setError(problem);
    }
    setError(null);
    setPhotos(files);
  };

  const onIdDoc = (e) => {
    const f = (e.target.files || [])[0] || null;
    if (f) {
      const problem = fileProblem(f, DOC_TYPES);
      if (problem) return setError(problem);
    }
    setError(null);
    setIdDoc(f);
  };

  async function uploadTo(bucket, file) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upError } = await supabase.storage.from(bucket).upload(path, file);
    if (upError) throw new Error(upError.message);
    return path;
  }

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError("Business name is required.");
    if (!form.category_slug) return setError("Pick a category.");
    if (!form.city_slug || !form.hood) return setError("Pick your city and neighbourhood.");
    if (form.about.trim().length < 20) {
      return setError("Tell visitors a little more — at least 20 characters.");
    }
    if (!form.phone.trim()) return setError("A phone number is required.");
    if (!form.hours_display.trim()) return setError("Opening hours are required.");
    if (!/^[AP][0-9]{9}[A-Z]$/.test(form.kra_pin.trim().toUpperCase())) {
      return setError("KRA PIN must look like A123456789Z.");
    }
    if (photos.length < 3) return setError("Add at least 3 photos of your business.");
    if (!idDoc) return setError("Upload an ID document so we can verify you.");

    setSubmitting(true);
    try {
      const photoPaths = [];
      for (const f of photos) photoPaths.push(await uploadTo("business-photos", f));
      const idPath = await uploadTo("verification-docs", idDoc);

      const { data, error: fnError } = await supabase.functions.invoke("business-intake", {
        body: {
          action: "register",
          name: form.name.trim(),
          category_slug: form.category_slug,
          sub_type_slug: form.sub_type_slug || undefined,
          city_slug: form.city_slug,
          hood: form.hood,
          address: form.address.trim() || undefined,
          about: form.about.trim(),
          phone: form.phone.trim(),
          hours_display: form.hours_display.trim(),
          kra_pin: form.kra_pin.trim().toUpperCase(),
          applicant_note: form.applicant_note.trim() || undefined,
          lat: form.lat ?? undefined,
          lng: form.lng ?? undefined,
          photo_paths: photoPaths,
          id_document_path: idPath,
        },
      });
      if (fnError) throw new Error(fnError.message || "Submission failed");
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] pb-16">
      <div className="px-5 md:px-8 pt-5 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/for-business")}
          className="flex items-center gap-1 text-sm text-stone-500 mb-4"
        >
          <ChevronLeft size={16} /> For Business
        </button>
        <h1 className="font-serif text-2xl text-ink mb-1">List your business</h1>
        <p className="text-sm text-stone-500 mb-6">
          Every listing is verified by our Nairobi team before it goes live.
        </p>

        <div className="space-y-5">
          <div>
            <label className={label} htmlFor="rb-name">Business name</label>
            <input id="rb-name" className={field} value={form.name} onChange={set("name")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-category">Category</label>
              <select id="rb-category" className={field}
                value={form.category_slug}
                onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value, sub_type_slug: "" }))}>
                <option value="">Choose...</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="rb-subtype">Sub-type (optional)</label>
              <select id="rb-subtype" className={field}
                value={form.sub_type_slug} onChange={set("sub_type_slug")}
                disabled={!category || !(category.subTypes || []).length}>
                <option value="">Choose...</option>
                {(category?.subTypes || []).map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-city">City</label>
              <select id="rb-city" className={field}
                value={form.city_slug}
                onChange={(e) => setForm((f) => ({ ...f, city_slug: e.target.value, hood: "" }))}>
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="rb-hood">Neighbourhood</label>
              <select id="rb-hood" className={field}
                value={form.hood} onChange={set("hood")} disabled={!city}>
                <option value="">Choose...</option>
                {(city?.hoods || []).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="rb-address">Street address (optional)</label>
            <input id="rb-address" className={field} value={form.address} onChange={set("address")} />
          </div>

          <div>
            <label className={label} htmlFor="rb-about">About your business</label>
            <textarea id="rb-about" rows={4} className={field}
              value={form.about} onChange={set("about")}
              placeholder="What do you do, and what should a newcomer know?" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-phone">Phone</label>
              <input id="rb-phone" className={field} value={form.phone}
                onChange={set("phone")} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className={label} htmlFor="rb-hours">Opening hours</label>
              <input id="rb-hours" className={field} value={form.hours_display}
                onChange={set("hours_display")} placeholder="Mon-Sat 9am-7pm" />
            </div>
          </div>

          <div>
            <span className={label}>Location pin (optional)</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={useMyLocation}
                className="bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-sm font-semibold">
                Use my current location
              </button>
              <span className="text-xs text-stone-500">
                {form.lat != null ? `${form.lat}, ${form.lng}` : "No pin set"}
              </span>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="rb-photos">Photos (at least 3)</label>
            <input id="rb-photos" type="file" multiple accept={PHOTO_TYPES.join(",")}
              onChange={onPhotos} className="text-sm" />
            {photos.length > 0 && (
              <p className="text-xs text-stone-500 mt-1">{photos.length} selected</p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="rb-kra">KRA PIN</label>
            <input id="rb-kra" className={field} value={form.kra_pin}
              onChange={set("kra_pin")} placeholder="A123456789Z" />
          </div>

          <div>
            <label className={label} htmlFor="rb-iddoc">ID document (owner or manager)</label>
            <input id="rb-iddoc" type="file" accept={DOC_TYPES.join(",")}
              onChange={onIdDoc} className="text-sm" />
            <p className="text-xs text-stone-500 mt-1">
              Private — only our verification team can see this.
            </p>
          </div>

          <div>
            <label className={label} htmlFor="rb-note">Anything else? (optional)</label>
            <textarea id="rb-note" rows={2} className={field}
              value={form.applicant_note} onChange={set("applicant_note")} />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-forest text-white rounded-xl px-6 py-3.5 text-sm font-semibold disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit application"}
          </button>
          <p className="text-xs text-stone-500">
            By submitting you confirm you're authorised to represent this
            business. Review usually takes under 48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
```

Adjust the photo-count error copy so the test's `/at least 3 photos/i` matches (`"Add at least 3 photos of your business."` does).

- [ ] **Step 4: Add the route**

In `src/routes.jsx`: add `import RegisterBusinessPage from "./pages/RegisterBusinessPage.jsx";` and, inside the `FullBleedLayout` route group (after the `merchant` route):

```jsx
          <Route path="for-business/register" element={<RegisterBusinessPage />} />
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/RegisterBusinessPage.test.jsx src/test/routes.test.jsx`
Expected: PASS. If `src/test/routes.test.jsx` asserts an exhaustive route list, add the new route to its expectations.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RegisterBusinessPage.jsx src/pages/RegisterBusinessPage.test.jsx src/routes.jsx src/test/routes.test.jsx
git commit -m "feat(ui): business registration intake form at /for-business/register"
```

---

### Task 13: ClaimBusinessPage + BusinessPage claim link

**Files:**
- Create: `src/pages/ClaimBusinessPage.jsx`
- Modify: `src/routes.jsx` (route `b/:slug/claim` under FullBleedLayout)
- Modify: `src/hooks/useBusinessDetail.js` (add `owner_id` to the select at line ~118; expose it from `mapDetailRow`)
- Modify: `src/pages/BusinessPage.jsx` (claim link after the write-a-review nudge, ~line 345)
- Create: `src/pages/ClaimBusinessPage.test.jsx`

**Interfaces:**
- Consumes: Task 8 claim payload; `useAuth()`; storage upload (same helper pattern as Task 12).
- Produces: `/b/:slug/claim`; BusinessPage shows "Own this business? Claim it" only when the live row has `ownerId === null`.

- [ ] **Step 1: Write the failing tests**

```jsx
// ClaimBusinessPage.test.jsx — the short evidence form for claiming an
// existing listing: signed-out prompts sign-in; signed-in submits the claim
// payload; an already-managed listing shows the dead-end message.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ClaimBusinessPage from "./ClaimBusinessPage.jsx";

const { authState, bizState, invokeSpy, uploadSpy } = vi.hoisted(() => ({
  authState: { current: { session: null, user: null } },
  bizState: { current: { id: "b1", name: "Unowned Co", owner_id: null } },
  invokeSpy: vi.fn(() => Promise.resolve({ data: { id: "c1", status: "pending" }, error: null })),
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: bizState.current, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      storage: { from: () => ({ upload: uploadSpy }) },
      functions: { invoke: invokeSpy },
    },
  };
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/b/unowned/claim"]}>
      <Routes>
        <Route path="/b/:slug/claim" element={<ClaimBusinessPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invokeSpy.mockClear();
  uploadSpy.mockClear();
});

test("signed out: prompts sign-in", async () => {
  authState.current = { session: null, user: null };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
});

test("an already-managed listing shows a dead end, no form", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  bizState.current = { id: "b1", name: "Owned Co", owner_id: "someone" };
  mount();
  expect(await screen.findByText(/already managed/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/kra pin/i)).not.toBeInTheDocument();
});

test("signed in: a complete claim submits and confirms", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  bizState.current = { id: "b1", name: "Unowned Co", owner_id: null };
  const user = userEvent.setup();
  mount();

  await user.type(await screen.findByLabelText(/kra pin/i), "A123456789Z");
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.upload(
    screen.getByLabelText(/id document/i),
    new File(["x"], "id.jpg", { type: "image/jpeg" }),
  );
  await user.click(screen.getByRole("button", { name: /submit claim/i }));

  await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
  const [name, { body }] = invokeSpy.mock.calls[0];
  expect(name).toBe("business-intake");
  expect(body.action).toBe("claim");
  expect(body.business_id).toBe("b1");
  expect(await screen.findByText(/under review/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/ClaimBusinessPage.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```jsx
// src/pages/ClaimBusinessPage.jsx
// "This is my business" on an existing listing. Short evidence form; the
// business-intake edge function is the only writer, and re-validates
// everything. The dead-end (already managed) is checked here for UX and
// enforced server-side regardless.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const field =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-sm font-semibold text-ink mb-1.5";

export default function ClaimBusinessPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { session, user } = useAuth();

  const [biz, setBiz] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ role_title: "", kra_pin: "", contact_phone: "", note: "" });
  const [idDoc, setIdDoc] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("businesses")
      .select("id, name, owner_id")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBiz(data ?? null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Claim this listing</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Sign in first so the listing can be linked to your account.
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/welcome", { state: { next: `/b/${slug}/claim` } })}>
          Sign in to continue
        </button>
      </div>
    );
  }

  if (loaded && (!biz || biz.owner_id)) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">
          {biz ? "Already managed" : "Listing not found"}
        </h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          {biz
            ? "This listing is already managed by its owner. If you believe that's wrong, contact hello@karibu.co.ke."
            : "We couldn't find that listing."}
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Claim received</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Your claim is under review — allow up to 48 hours. You can follow its
          status on the For Business page.
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/for-business")}>
          Back to For Business
        </button>
      </div>
    );
  }

  const onIdDoc = (e) => {
    const f = (e.target.files || [])[0] || null;
    if (f && (!DOC_TYPES.includes(f.type) || f.size > MAX_FILE_BYTES)) {
      return setError(`${f.name}: must be an image or PDF under 5 MB`);
    }
    setError(null);
    setIdDoc(f);
  };

  const submit = async () => {
    setError(null);
    if (!/^[AP][0-9]{9}[A-Z]$/.test(form.kra_pin.trim().toUpperCase())) {
      return setError("KRA PIN must look like A123456789Z.");
    }
    if (!form.contact_phone.trim()) return setError("A phone number is required.");
    if (!idDoc) return setError("Upload an ID document so we can verify you.");
    setSubmitting(true);
    try {
      const ext = (idDoc.name.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("verification-docs").upload(path, idDoc);
      if (upError) throw new Error(upError.message);

      const { data, error: fnError } = await supabase.functions.invoke("business-intake", {
        body: {
          action: "claim",
          business_id: biz.id,
          role_title: form.role_title.trim() || undefined,
          kra_pin: form.kra_pin.trim().toUpperCase(),
          contact_phone: form.contact_phone.trim(),
          id_document_path: path,
          note: form.note.trim() || undefined,
        },
      });
      if (fnError) throw new Error(fnError.message || "Submission failed");
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] pb-16">
      <div className="px-5 md:px-8 pt-5 max-w-xl mx-auto">
        <button type="button" onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-stone-500 mb-4">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="font-serif text-2xl text-ink mb-1">
          Claim {biz?.name || "this listing"}
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Prove you run this business and we'll hand you the keys after a quick
          human review.
        </p>

        <div className="space-y-5">
          <div>
            <label className={label} htmlFor="cb-role">Your role (optional)</label>
            <input id="cb-role" className={field} value={form.role_title}
              onChange={set("role_title")} placeholder="Owner, manager..." />
          </div>
          <div>
            <label className={label} htmlFor="cb-kra">KRA PIN</label>
            <input id="cb-kra" className={field} value={form.kra_pin}
              onChange={set("kra_pin")} placeholder="A123456789Z" />
          </div>
          <div>
            <label className={label} htmlFor="cb-phone">Phone</label>
            <input id="cb-phone" className={field} value={form.contact_phone}
              onChange={set("contact_phone")} placeholder="07XX XXX XXX" />
          </div>
          <div>
            <label className={label} htmlFor="cb-iddoc">ID document</label>
            <input id="cb-iddoc" type="file" accept={DOC_TYPES.join(",")}
              onChange={onIdDoc} className="text-sm" />
            <p className="text-xs text-stone-500 mt-1">
              Private — only our verification team can see this.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="cb-note">Anything else? (optional)</label>
            <textarea id="cb-note" rows={2} className={field}
              value={form.note} onChange={set("note")} />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-forest text-white rounded-xl px-6 py-3.5 text-sm font-semibold disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Route + BusinessPage link + owner_id plumb**

1. `src/routes.jsx`: add `import ClaimBusinessPage from "./pages/ClaimBusinessPage.jsx";` and, in the FullBleedLayout group next to `b/:slug/review`:

```jsx
          <Route path="b/:slug/claim" element={<ClaimBusinessPage />} />
```

2. `src/hooks/useBusinessDetail.js`: in the businesses `.select(...)` string (line ~118), append `, owner_id` (inside the string, before `category:categories(...)` works too — keep it a flat column). In `mapDetailRow`, add near the top of the assembled object:

```js
    ownerId: row.owner_id ?? null,
```

3. `src/pages/BusinessPage.jsx`: after the closing tag of the "Write-a-review nudge at bottom" block (~line 345), insert:

```jsx
      {/* Owner claim entry — only for live rows that nobody manages yet */}
      {liveBiz && liveBiz.ownerId === null && b.slug && (
        <div className="px-5 md:px-8 pt-4 pb-2 text-center">
          <button
            type="button"
            onClick={() => navigate(`/b/${b.slug}/claim`)}
            className="text-xs text-stone-400 underline underline-offset-2"
          >
            Own this business? Claim this listing
          </button>
        </div>
      )}
```

   `b.slug` is the same slug variable already passed to `useBusinessDetail(b.slug)` at line 33 — reuse whatever identifier the surrounding JSX uses for it. If `navigate` is not already in scope in that component, add `const navigate = useNavigate();` alongside the existing hooks (and add `useNavigate` to the react-router-dom import if absent).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/ClaimBusinessPage.test.jsx src/pages/BusinessPage.test.jsx src/pages/BusinessPage.services.test.jsx`
Expected: PASS — new tests green, existing BusinessPage tests unaffected (the link only renders when live data carries `ownerId: null`; the shared supabase mock resolves `data: null`, so `liveBiz` stays null in old tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/ClaimBusinessPage.jsx src/pages/ClaimBusinessPage.test.jsx src/routes.jsx src/hooks/useBusinessDetail.js src/pages/BusinessPage.jsx
git commit -m "feat(ui): claim-this-listing flow from the business page"
```

---

### Task 14: AdminReviewPage + route

**Files:**
- Create: `src/pages/AdminReviewPage.jsx`
- Modify: `src/routes.jsx` (route `admin` under FullBleedLayout)
- Create: `src/pages/AdminReviewPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()`; `profiles.is_staff` own-row read (UX gate only); `admin-review` payloads from Task 9.
- Produces: `/admin` — queue with evidence, approve, reject-with-reason.

- [ ] **Step 1: Write the failing tests**

```jsx
// AdminReviewPage.test.jsx — the UX gate (server enforces the real one):
// non-staff see "Not authorized"; staff see the queue and can approve, which
// re-fetches.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminReviewPage from "./AdminReviewPage.jsx";

const { authState, profileState, invokeSpy } = vi.hoisted(() => {
  const invokeSpy = vi.fn((name, { body }) => {
    if (body.action === "queue") {
      return Promise.resolve({
        data: {
          registrations: [{
            id: "b1", name: "Posh Palace", hood: "Kilimani", created_at: "2026-07-23",
            city: { name: "Nairobi" }, category: { label: "Beauty" },
            verification: { kra_pin: "A123456789Z", contact_phone: "0712345678" },
            id_document_url: "https://signed/doc",
          }],
          claims: [],
        },
        error: null,
      });
    }
    return Promise.resolve({ data: { ok: true }, error: null });
  });
  return {
    authState: { current: { session: { user: { id: "u1" } }, user: { id: "u1" } } },
    profileState: { current: { is_staff: true } },
    invokeSpy,
  };
});
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: profileState.current, error: null }),
  };
  return {
    supabase: { from: () => chain, functions: { invoke: invokeSpy } },
  };
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminReviewPage />
    </MemoryRouter>,
  );
}

beforeEach(() => invokeSpy.mockClear());

test("non-staff: Not authorized, and the queue is never requested", async () => {
  profileState.current = { is_staff: false };
  mount();
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});

test("staff: sees the pending registration with its evidence", async () => {
  profileState.current = { is_staff: true };
  mount();
  expect(await screen.findByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getByText("A123456789Z")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /view id document/i }))
    .toHaveAttribute("href", "https://signed/doc");
});

test("staff: approve posts the decision and refetches the queue", async () => {
  profileState.current = { is_staff: true };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /approve/i }));
  await waitFor(() => {
    const actions = invokeSpy.mock.calls.map(([, { body }]) => body.action);
    expect(actions).toContain("approve");
    expect(actions.filter((a) => a === "queue").length).toBeGreaterThanOrEqual(2);
  });
});

test("staff: reject without a reason is blocked client-side", async () => {
  profileState.current = { is_staff: true };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /^reject/i }));
  expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
  expect(invokeSpy.mock.calls.every(([, { body }]) => body.action !== "reject")).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/AdminReviewPage.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```jsx
// src/pages/AdminReviewPage.jsx
// Staff-only onboarding queue. The is_staff read here is a UX gate; the
// admin-review function re-checks it with the service role on every call, so
// nothing on this page grants any capability by itself.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

function QueueCard({ title, subtitle, fields, docUrl, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn, requireReason) => {
    if (requireReason && reason.trim().length < 3) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    setBusy(true);
    try {
      await fn(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="font-serif text-lg text-ink">{title}</p>
      <p className="text-xs text-stone-500 mb-3">{subtitle}</p>
      <dl className="text-sm space-y-1 mb-3">
        {fields.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-stone-500 w-28 shrink-0">{k}</dt>
            <dd className="font-medium break-all">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {docUrl && (
        <a href={docUrl} target="_blank" rel="noreferrer"
          className="text-sm text-forest underline underline-offset-2">
          View ID document
        </a>
      )}
      <div className="mt-4 space-y-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required to reject)"
          className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-sm"
        />
        {reasonError && (
          <p className="text-xs text-red-700">A reason is required to reject.</p>
        )}
        <div className="flex gap-2">
          <button type="button" disabled={busy}
            onClick={() => act(onApprove, false)}
            className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            Approve
          </button>
          <button type="button" disabled={busy}
            onClick={() => act(onReject, true)}
            className="flex-1 bg-white border border-red-300 text-red-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState(null); // null = checking
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setIsStaff(false);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from("profiles").select("is_staff").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsStaff(Boolean(data?.is_staff));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadQueue = useCallback(async () => {
    const { data, error: fnError } = await supabase.functions.invoke("admin-review", {
      body: { action: "queue" },
    });
    if (fnError || data?.error) {
      setError(fnError?.message || data?.error || "Could not load the queue");
      return;
    }
    setError(null);
    setQueue(data);
  }, []);

  useEffect(() => {
    if (isStaff) loadQueue();
  }, [isStaff, loadQueue]);

  const decide = useCallback(
    async (action, kind, id, reason) => {
      const { data, error: fnError } = await supabase.functions.invoke("admin-review", {
        body: { action, kind, id, ...(reason ? { reason } : {}) },
      });
      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || "Action failed");
      }
      await loadQueue();
    },
    [loadQueue],
  );

  if (isStaff === null) {
    return <div className="min-h-screen bg-[#FAF7F0]" />;
  }
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-6">
        <p className="text-sm text-stone-500">Not authorized.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] pb-16">
      <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl text-ink mb-1">Onboarding review</h1>
        <p className="text-sm text-stone-500 mb-6">
          Pending registrations and ownership claims. Every decision is logged.
        </p>
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

        <h2 className="font-semibold text-sm text-stone-600 uppercase tracking-wide mb-3">
          New registrations
        </h2>
        <div className="space-y-4 mb-8">
          {(queue?.registrations ?? []).map((r) => (
            <QueueCard
              key={r.id}
              title={r.name}
              subtitle={`${r.category?.label ?? ""} · ${r.hood}, ${r.city?.name ?? ""}`}
              fields={[
                ["KRA PIN", r.verification?.kra_pin],
                ["Phone", r.verification?.contact_phone],
                ["Note", r.verification?.applicant_note],
                ["Submitted", r.created_at],
              ]}
              docUrl={r.id_document_url}
              onApprove={() => decide("approve", "registration", r.id)}
              onReject={(reason) => decide("reject", "registration", r.id, reason)}
            />
          ))}
          {queue && queue.registrations.length === 0 && (
            <p className="text-sm text-stone-400">Nothing pending.</p>
          )}
        </div>

        <h2 className="font-semibold text-sm text-stone-600 uppercase tracking-wide mb-3">
          Ownership claims
        </h2>
        <div className="space-y-4">
          {(queue?.claims ?? []).map((c) => (
            <QueueCard
              key={c.id}
              title={c.business?.name ?? "Listing"}
              subtitle={`Claimed ${c.created_at}`}
              fields={[
                ["Role", c.role_title],
                ["KRA PIN", c.kra_pin],
                ["Phone", c.contact_phone],
                ["Note", c.note],
              ]}
              docUrl={c.id_document_url}
              onApprove={() => decide("approve", "claim", c.id)}
              onReject={(reason) => decide("reject", "claim", c.id, reason)}
            />
          ))}
          {queue && queue.claims.length === 0 && (
            <p className="text-sm text-stone-400">Nothing pending.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the route**

In `src/routes.jsx`: `import AdminReviewPage from "./pages/AdminReviewPage.jsx";` and in the FullBleedLayout group:

```jsx
          <Route path="admin" element={<AdminReviewPage />} />
```

(`/admin` stays out of every nav component — reachable by URL only, like `/merchant`.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/AdminReviewPage.test.jsx src/test/routes.test.jsx src/test/navigation.test.jsx`
Expected: PASS (update route-list expectations in `src/test/routes.test.jsx` if exhaustive; nav tests must show NO new tabs).

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminReviewPage.jsx src/pages/AdminReviewPage.test.jsx src/routes.jsx src/test/routes.test.jsx
git commit -m "feat(ui): staff onboarding review queue at /admin"
```

---

### Task 15: Full verification, docs, ship

**Files:**
- Modify: `docs/FIX_PLAN.md` (mark task 22/24 progress), `CLAUDE.md` root "Where we are right now" (one sentence: onboarding spine shipped — intake, claims, admin queue, activation email wiring)
- Modify: `SUPABASE_SETUP.md` — add `INTERNAL_FUNCTION_SECRET` note for admin-review→send-onboarding-email if not already listed

**Interfaces:**
- Consumes: everything.

- [ ] **Step 1: Full test sweep**

```bash
npm run lint
npm run build
npx vitest run
deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/
supabase db reset && supabase test db   # skip with a note if no local stack
```

Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Docs touch**

- `docs/FIX_PLAN.md`: under task 22 add a line "Spine shipped (branch feat/business-onboarding-spine): intake form + claims + evidence storage + human review; OTP/iTax still open." Under task 24 add "Minimal queue shipped at /admin (profiles.is_staff + admin_decisions)."
- Root `CLAUDE.md` "Where we are right now": append one bullet-sentence noting the onboarding spine (business-intake + admin-review functions, /for-business/register, /b/:slug/claim, /admin) and that staff are appointed via `UPDATE profiles SET is_staff = true`.
- `SUPABASE_SETUP.md`: ensure `INTERNAL_FUNCTION_SECRET` is listed as required for `admin-review`'s welcome-email call.

- [ ] **Step 3: Commit docs**

```bash
git add docs/FIX_PLAN.md CLAUDE.md SUPABASE_SETUP.md
git commit -m "docs: record the business onboarding spine"
```

- [ ] **Step 4: Push and open a draft PR**

```bash
git push -u origin feat/business-onboarding-spine
gh pr create --draft \
  --title "feat: business onboarding spine (intake, claims, admin review, activation)" \
  --body "$(cat <<'EOF'
## What this is

The onboarding spine from the approved spec
(`docs/superpowers/specs/2026-07-23-business-onboarding-spine-design.md`):
a business can now register a new listing or claim an existing one; evidence
lands in a staff-only review queue; approval activates the listing (or
assigns the owner), logs the decision, and fires the welcome email.

## Shipped

- **DB (5 migrations + pgTAP):** `business_verifications` (evidence, off the
  public businesses row), `business_claims` (partial-unique pending claims),
  `admin_decisions` (service-role-only audit log), `profiles.is_staff`
  (readable, never client-writable), `verification-docs` (private) +
  `business-photos` (public) buckets with own-folder policies.
- **Edge functions:** `business-intake` (verify_jwt, server-side validation,
  rate-limited, service-role writes, compensating delete) and `admin-review`
  (is_staff authorization, guarded idempotent approve/reject, decision log,
  fire-and-forget welcome email, signed URLs for ID docs).
- **UI:** live CTAs + "Your applications" on `/for-business`,
  `/for-business/register` intake form, claim link on business pages +
  `/b/:slug/claim`, staff queue at `/admin` (URL-only, no nav changes).

## Tests

Deno (validation matrix, staff gate, race guards, rate limits), pgTAP (18
assertions over RLS/grants/storage), vitest (CTA wiring, both forms, admin
gate), lint + build green.

## Manual follow-ups before go-live

1. Appoint staff: `UPDATE profiles SET is_staff = true WHERE email = '...';`
2. Deploy the 5 migrations + 2 new functions to the cloud project
   (`supabase db push --linked`, `supabase functions deploy business-intake admin-review`).
3. Confirm `INTERNAL_FUNCTION_SECRET` is set so approvals can send the
   welcome email.
EOF
)"
```
