# Auth: Google login, account creation, profiles, and a sign-in landing page

**Date:** 2026-07-22 · **Status:** Implementing (autonomous background run — the draft PR is the approval gate)

## What we're building

Karibu's authenticated half is gated on sign-in (STATUS.md risk #2: reviews are
silently dropped; saved places, merchant, checkout all blocked). The
`fix/p0-launch-blockers` branch already carries an uncommitted minimal auth
substrate: `AuthContext` (session source of truth) and a magic-link form on
ProfilePage. This feature extends that substrate with:

1. **Google login** — `supabase.auth.signInWithOAuth({ provider: "google" })`.
2. **Account creation** — email + password `signUp` / `signInWithPassword`.
3. **Customer database** — a `public.profiles` table, one row per
   `auth.users` row, auto-created by trigger, owner-only RLS.
4. **A landing page** (`/welcome`) for signing in / creating an account, with a
   section directing to the business side (`/for-business`) — the entry point
   for future business accounts ("we will get to that").

## Approach chosen

Supabase Auth end-to-end (GoTrue). Alternatives rejected: hosted auth
(Clerk/Auth0) adds a service and splits the user store from Postgres/RLS;
custom password handling in edge functions reinvents GoTrue and is a security
liability. Supabase Auth keeps the single-project architecture and gives us
`auth.uid()` for RLS for free.

## Components

### 1. Migration — `supabase/migrations/20260722090000_create_profiles.sql`

- `public.profiles`: `id uuid PK → auth.users(id) ON DELETE CASCADE`,
  `email text`, `full_name text`, `avatar_url text`,
  `home_city_id uuid → cities(id)`, `created_at/updated_at timestamptz`.
- **RLS:** enabled. `SELECT` own row (`auth.uid() = id`), `UPDATE` own row
  (USING + WITH CHECK). No INSERT/DELETE policies — rows are created by the
  trigger and die with the user. Profiles are private (no public read).
- **Grants:** repo convention (20260710160000) — revoke all from
  `anon, authenticated`, then grant `SELECT` + `UPDATE (full_name, avatar_url,
  home_city_id)` to `authenticated` only. Column-scoped UPDATE so a client can
  never rewrite its own `email` copy or `id`.
- **Trigger:** `public.handle_new_user()` `SECURITY DEFINER` with
  `SET search_path = ''` (pinned — a prior review flagged unpinned
  search_path), AFTER INSERT ON `auth.users`. Copies `email` and Google's
  `raw_user_meta_data` (`full_name`/`name`, `avatar_url`/`picture`).
- **Backfill:** `INSERT … SELECT FROM auth.users ON CONFLICT DO NOTHING` for
  any users that predate the table.
- `updated_at` via existing `set_updated_at()`; index on `home_city_id`
  (every-FK-indexed rule).
- **pgTAP:** `supabase/tests/profiles_test.sql` — RLS on, policies present,
  anon has no privileges, authenticated cannot update `email`, trigger creates
  a row, backfill idempotent.

### 2. Frontend

- `src/context/AuthContext.jsx` + `App.jsx` wiring + `src/test/setup.js` auth
  mocks: **recreated verbatim** from the P0 branch's uncommitted versions so an
  eventual merge is content-identical, then the mock extended
  (`signInWithOAuth`, `signInWithPassword`, `signUp`, `maybeSingle`, `update`).
- `src/pages/WelcomePage.jsx` — new full-bleed route `/welcome`:
  - Brand hero in the existing visual language (kitenge/ivory/clay/serif) —
    the do-not-rebuild-the-UI guardrail means we reuse the prototype's tokens,
    not invent a new look (deliberately NOT a redesign).
  - "Continue with Google" button → `signInWithOAuth` with
    `redirectTo: window.location.origin + "/welcome"`.
  - Email + password form with a Sign in ↔ Create account toggle
    (`signInWithPassword` / `signUp`; signup success shows a
    check-your-inbox-if-confirmation-required state).
  - "Email me a sign-in link instead" — reuses the magic-link flow.
  - "Continue as guest" → `/`.
  - **For-business section:** card directing to `/for-business` ("Own a
    business? Get verified…") — placeholder entry for future business accounts.
  - Already-signed-in visitors are redirected to `/profile` (replace).
- `src/hooks/useProfile.js` — fetch own `profiles` row when a session exists;
  `saveName(full_name)` update helper. Null when signed out.
- `src/pages/ProfilePage.jsx` — carried from the P0 branch, extended: signed-in
  state shows profile name/avatar from `useProfile` with an inline editable
  display name (exercises the UPDATE policy end-to-end); signed-out state keeps
  the magic-link form and adds a link to `/welcome` for Google/password.
- `src/routes.jsx` — `/welcome` under `FullBleedLayout`.

### 3. Config & docs

- `supabase/config.toml` — `[auth.external.google]` block, `enabled = false`
  by default (local Google OAuth needs real Google credentials; enabling with
  empty creds would break `supabase start`), creds via
  `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_*)`, comment explaining how to enable.
- `SUPABASE_SETUP.md` — new section: create the OAuth client in Google Cloud
  Console, authorized redirect URI
  `https://jwiptjcpczamewmyaost.supabase.co/auth/v1/callback`, enable the
  provider in the dashboard, local-dev note.

### 4. Tests

- `WelcomePage.test.jsx` — Google button calls `signInWithOAuth`; toggle
  switches sign-in ↔ create-account; create-account calls `signUp`; signed-in
  visitor is redirected.
- `ProfilePage.test.jsx` — P0 branch tests carried over + profile-name cases.
- pgTAP as above. Deno tests untouched (no edge-function changes).

## Error handling

Every auth call surfaces its message in the same error card style ProfilePage
already uses; the OAuth redirect failure mode (provider disabled) comes back as
a GoTrue error message, shown in place. Profile fetch failure degrades to the
session's email — the page never blanks.

## Out of scope (deliberate)

- Business accounts / owner claim flow — the landing page only *directs* there.
- Saved-places sync, review-flow auth wiring (`ReviewComposePage`) — lives on
  the P0 branch; not duplicated here to keep the merge surface small.
- Password reset flow (Supabase's hosted recovery email works without UI; a
  dedicated screen is follow-up).
- Cloud dashboard configuration (enabling the Google provider) — manual step,
  documented.

## Merge note

Built on `origin/main`. Overlapping files (`AuthContext.jsx`, `App.jsx`,
`setup.js`, `ProfilePage.jsx`, its test) are recreated to match the
`fix/p0-launch-blockers` working tree exactly where they overlap, so merging
the two branches resolves clean or trivially.
