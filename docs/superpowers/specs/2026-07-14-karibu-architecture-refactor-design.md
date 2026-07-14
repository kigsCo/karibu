# Sub-project 1 — A-tier architecture refactor

Date: 2026-07-14
Status: draft for review
Parent roadmap: `2026-07-14-karibu-launch-readiness-roadmap.md`

## Goal

Retire the single ~3,200-line `src/KaribuApp.jsx` into an A-tier structure that
a reviewer or auditor can read, and that a native wrapper can deep-link into.
Concretely:

- Real client-side routing with shareable, deep-linkable URLs.
- One focused module per screen, extracted incrementally with a render check
  after each step.
- Route params plus the existing data hooks replace in-memory navigation
  payloads, so a cold-loaded or shared URL resolves correctly.
- A frontend test pass on top of the green 66-test backend suite.

Non-goal: changing the visual design, typography, palette, or copy. This
sub-project changes structure only. Copy and trust fixes live in Sub-project 2.
The visible UI must not change: any change a user could see on screen is a
defect in this sub-project. (DOM-level differences from swapping buttons for
router links are allowed, as long as nothing visible changes.)

## Current state

`KaribuApp.jsx` is one default-exported component holding all navigation and
screen rendering. Navigation is a hand-rolled stack, not routing:

- State: `stack` (an array of `{ screen, payload }`), `reviewsByBusiness`
  (local optimistic review state, not persisted), `justPostedFor`, `activeCity`
  (defaults to `"nairobi"`).
- `go(screen, payload)` pushes a frame; `back()` pops; `goTab(key)` resets the
  stack to a single tab frame; `merchant_dashboard` and `exitMerchant` reset the
  stack. `handleCitySelect` sets `activeCity` and pops the picker.
- `renderScreen()` is a switch over `current.screen` covering 15 cases:
  `discover`, `category`, `subcategory`, `business`, `review_compose`,
  `business_signup`, `city_picker`, `ask`, `merchant_dashboard`, `guides`,
  `guide_article`, `search`, `saved` (placeholder), `profile` (placeholder),
  plus the default.
- Screens receive data by payload. For example `BusinessScreen` is handed the
  full business object through `current.payload`; `reviews` come from the
  in-memory `reviewsByBusiness` map keyed by `payload.id`. This is the fragile
  pattern that breaks on refresh and on shared links.
- `DesktopNav` (md+) and `BottomNav` (mobile) render the same five
  destinations: `discover`, `guides`, `saved`, `business_signup`, `profile`.
  `hideBottomNav` hides chrome for full-screen flows (`review_compose`,
  `city_picker`, `ask`, `merchant_dashboard`, `guide_article`).
- `react-router-dom` is already a dependency but is not used for navigation.

The data layer is already migrated to hooks (`useBusinesses`,
`useBusinessDetail`, `useGuides`, `useGuideDetail`) and Context
(cities/categories). Those hooks already support fetch-by-slug, which is what
makes the routing migration mostly a re-wiring rather than a rewrite.

## Target structure

```
src/
  main.jsx                     entry (unchanged intent)
  App.jsx                      <BrowserRouter> + providers + <AppRoutes/>
  routes.jsx                   route table (path -> page), lazy-loaded pages
  layout/
    AppShell.jsx               chrome: DesktopNav + BottomNav + <Outlet/>
    FullBleedLayout.jsx        no-chrome layout for full-screen flows
  pages/
    DiscoverPage.jsx
    CategoryPage.jsx
    SubCategoryPage.jsx
    BusinessPage.jsx
    ReviewComposePage.jsx      (kept; hidden/gated in Sub-project 2)
    ForBusinessPage.jsx        (renamed from BusinessSignup; Apply flow in SP2)
    AskKaribuPage.jsx
    GuidesPage.jsx
    GuideArticlePage.jsx
    SearchPage.jsx
    SavedPage.jsx
    ProfilePage.jsx
    MerchantDashboardPage.jsx  (route exists, unlinked; merchant side deferred)
    NotFoundPage.jsx
  components/                  shared presentational UI extracted from the monolith
    nav/DesktopNav.jsx, nav/BottomNav.jsx
    (Badge, cards, and other reused pieces as they are lifted out)
  hooks/                       existing data hooks (unchanged)
  context/
    CityContext.jsx            selected city (replaces the activeCity prop chain)
  data/                        existing reference/fallback data (unchanged)
```

`KaribuApp.jsx` shrinks to nothing and is deleted once the last screen is out.

## Route map

| Path | Page | Notes |
|---|---|---|
| `/` | DiscoverPage | index route |
| `/c/:categorySlug` | CategoryPage | replaces `category` payload |
| `/c/:categorySlug/:subSlug` | SubCategoryPage | replaces `subcategory` payload |
| `/b/:slug` | BusinessPage | fetch by slug via `useBusinessDetail` |
| `/b/:slug/review` | ReviewComposePage | full-bleed; gated in SP2 |
| `/for-business` | ForBusinessPage | tab destination |
| `/ask` | AskKaribuPage | full-bleed |
| `/guides` | GuidesPage | tab destination |
| `/guides/:slug` | GuideArticlePage | full-bleed; fetch by slug |
| `/search` | SearchPage | full-bleed |
| `/saved` | SavedPage | tab destination |
| `/profile` | ProfilePage | tab destination |
| `/merchant` | MerchantDashboardPage | unlinked; deferred surface |
| `*` | NotFoundPage | |

Navigation destinations (the five tabs) stay exactly as they are today. The
page and route are named `ForBusinessPage` / `/for-business` internally, but the
visible tab label stays "Business" (its current copy). Visible tab labels are
unchanged: Discover, Guides, Saved, Business, Profile.

## Navigation and state mapping

- The `stack` push/pop model is replaced by the router. `go(screen, payload)`
  becomes `navigate(path)`; `back()` becomes `navigate(-1)`; tab switches are
  `<NavLink>`s. Native hardware back (Android, via Capacitor) maps to router
  history for free.
- `activeCity` moves from a threaded prop into `CityContext` (a small provider
  next to the existing cities/categories context). Default stays `"nairobi"`.
  The city picker becomes a route or a modal that sets context; it no longer
  pushes and pops a stack frame.
- Payload-passing is removed. Pages read `:slug` / `:categorySlug` from
  `useParams` and fetch through the existing hooks. This is the change that
  makes `/b/some-salon` work when opened cold or shared, which deep links and
  store review both require.
- `reviewsByBusiness` / `justPostedFor` (local optimistic review state) stays
  for now to preserve behaviour, but is isolated inside `BusinessPage` /
  `ReviewComposePage` rather than living at the app root. Sub-project 2 decides
  its final fate when it hides the UGC review flow.
- Chrome vs full-bleed is expressed by nested layout routes (`AppShell` with
  `<Outlet/>` for tabbed pages, `FullBleedLayout` for the flows that hid the
  nav today), not by a `hideBottomNav` array.

## Migration strategy (incremental, verify each step)

Follows the root guardrail: split one screen at a time, confirm the app still
renders and looks identical after each, never big-bang.

1. Introduce `react-router` at the root: `App.jsx` wraps the current monolith in
   a `BrowserRouter` and a single catch-all route rendering `KaribuApp` as-is.
   No behaviour change. Establishes the router without moving any screen.
2. Add `CityContext` and move `activeCity` into it, still rendering the monolith.
3. Extract the two layouts (`AppShell`, `FullBleedLayout`) and the nav
   components. Wire the five tab routes to thin pages that still delegate into
   the monolith's screen components.
4. Extract screens one at a time in dependency order (leaf screens first:
   Guides, GuideArticle, Discover, Category, SubCategory, Business, Ask, Search,
   ForBusiness, ReviewCompose, Saved, Profile, MerchantDashboard). After each
   extraction: `npm run build` and `npm run lint` pass, and the screen renders
   identically. Convert payload consumers to `useParams` + hooks as they move.
5. Delete `KaribuApp.jsx` once empty. Update `src/CLAUDE.md` to describe the new
   structure and drop the "do not split" framing (the split is now done and
   verified). Correct the stale deployment claim in the root `CLAUDE.md`.

Each numbered step is a separate commit, independently verifiable, and safe to
stop at.

## Testing

- Keep the backend suite green (66/66; run with `--node-modules-dir=auto`).
- Add frontend smoke tests (Vitest + React Testing Library): each route mounts
  its page without crashing, the fallback path renders when a hook returns an
  empty live result, and the five tabs navigate to the right route. Deep-link
  tests assert `/b/:slug` and `/guides/:slug` fetch by param.
- Manual render parity check after each extraction, on mobile and desktop
  widths, since the acceptance bar is "looks identical".

## Acceptance criteria

- `KaribuApp.jsx` is deleted; no screen switch remains; every screen is a page
  module reached by a route.
- Every screen has a shareable URL; `/b/:slug` and `/guides/:slug` resolve when
  loaded cold (no reliance on in-memory payload).
- `activeCity` is context, not a threaded prop.
- `npm run build` and `npm run lint` pass; frontend smoke tests pass; backend
  66/66 still pass.
- The rendered UI (design, typography, palette, copy) is unchanged. A visual
  diff on each screen at mobile and desktop widths shows no change.
- `src/CLAUDE.md` and root `CLAUDE.md` are updated to match the new reality.

## Risks and rollback

- Risk: a payload-to-param conversion changes what a screen shows (for example a
  business that was passed a richer in-memory object than the slug fetch
  returns). Mitigation: convert one screen per commit and diff its render; the
  detail hooks already back these screens in production.
- Risk: full-bleed vs chrome regressions when moving to layout routes.
  Mitigation: the `hideBottomNav` list is the exact acceptance checklist.
- Rollback: because each screen is its own commit, any regression reverts to the
  last good screen without losing the rest of the refactor.
