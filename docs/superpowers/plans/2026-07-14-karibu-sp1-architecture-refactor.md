# Karibu Sub-project 1 — A-tier Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the single ~3,200-line `src/KaribuApp.jsx` into real `react-router` routes plus one page module per screen, extracted incrementally with a render check after each step, with no change to the visible UI.

**Architecture:** A `useLegacyNav()` adapter maps the prototype's `go("screen", payload)` / `back()` calls onto the router, so each screen's internals stay byte-identical and only the wiring at thin page-wrappers changes. Routes sit under a persistent `AppFrame` (the viewport shell), split into an `AppShell` layout (desktop + bottom nav) and a `FullBleedLayout` (no nav) that reproduce the prototype's `hideBottomNav` behaviour. The selected city and the local optimistic review state move from the monolith's root `useState` into small React contexts. Screen data hooks (`useBusinesses`, `useBusinessDetail`, `useGuides`, `useGuideDetail`) are already called inside each screen and are unchanged; deep links work because those hooks fetch by slug and the pages pass the route `:slug` through.

**Tech Stack:** React 18.3, Vite 6, react-router-dom 6.28, Tailwind 3.4, lucide-react. Tests: Vitest + @testing-library/react + jsdom (added in Task 1).

## Global Constraints

- **The visible UI must not change.** Any change a user could see on screen (design, typography, palette, copy, layout, spacing) is a defect. DOM-level differences from swapping buttons for router links are allowed only when nothing visible changes. Verify each screen at a mobile width (~375px) and a desktop width (~1280px).
- **One screen at a time.** Never big-bang. After every extraction: `npm run build` and `npm run lint` pass, and the screen renders identically before moving on.
- **Do not touch the data layer.** `src/hooks/*`, `src/lib/supabase.js`, `src/data/referenceData.js`, and `src/context/ReferenceDataContext.jsx` are already migrated and are not modified except where this plan explicitly says so.
- **Preserve the hardening fixes** from PR #10 (merged into `main` before this work): in particular the guide article is keyed by its id so article→article navigation remounts. Carry that key into `GuideArticlePage`.
- **Secrets rule (unchanged):** only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public; nothing else goes in `VITE_*`.
- **Commit after each task.** Do not add `Co-Authored-By` lines to commit messages.
- **Branch:** all work happens on a branch cut from `main` after PR #10 merges, e.g. `feat/sp1-architecture-refactor`.

---

## File structure

New files:

```
vitest.config.js                       test runner config (separate from vite.config.js)
src/test/setup.js                      jest-dom matchers + a default supabase mock
src/context/CityContext.jsx            selected city (cityKey + setCityKey)
src/context/LocalReviewsContext.jsx    optimistic guest-review state + addReview
src/lib/nav.js                         pathFor / TAB_PATH / activeTabFromPath / useLegacyNav
src/routes.jsx                         the route table (AppRoutes)
src/layout/AppFrame.jsx                persistent viewport shell + <Outlet/>
src/layout/AppShell.jsx                desktop + bottom nav around <Outlet/>
src/layout/FullBleedLayout.jsx         no-nav scroll container + <Outlet/>
src/components/GlobalStyles.jsx        moved from KaribuApp.jsx
src/components/Badge.jsx               moved shared UI
src/components/StarRow.jsx             moved shared UI
src/components/HeroImage.jsx           moved shared UI
src/components/PlaceholderScreen.jsx   moved shared UI
src/components/BottomNav.jsx           moved (drops nothing; keeps active/go props)
src/components/DesktopNav.jsx          moved (keeps active/go props)
src/pages/DiscoverPage.jsx             + one file per screen (13 pages)
src/pages/CategoryPage.jsx
src/pages/BusinessPage.jsx
src/pages/ReviewComposePage.jsx
src/pages/ForBusinessPage.jsx
src/pages/CityPickerPage.jsx
src/pages/AskKaribuPage.jsx
src/pages/GuidesPage.jsx
src/pages/GuideArticlePage.jsx
src/pages/MerchantDashboardPage.jsx
src/pages/SearchPage.jsx
src/pages/SavedPage.jsx
src/pages/ProfilePage.jsx
src/pages/SubCategoryPage.jsx          (unreachable screen; see Task 6 note)
src/pages/NotFoundPage.jsx             new 404 (no prior art; on-brand placeholder)
```

Modified files:

```
package.json                           add test deps + "test" script
src/App.jsx                            providers + <AppRoutes/> (replaces the /* -> KaribuApp route)
src/KaribuApp.jsx                      screens exported (Task 6), then emptied screen-by-screen, then deleted
src/CLAUDE.md, CLAUDE.md               updated in Task 21 to the new structure + corrected deploy claim
```

---

## Phase 0 — Test infrastructure

### Task 1: Add Vitest + Testing Library and a first smoke test

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Test: `src/test/smoke.test.jsx`

**Interfaces:**
- Produces: an `npm test` script running `vitest run`; a `src/test/setup.js` that registers jest-dom matchers and a default chainable `supabase` mock other tests reuse.

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
```

- [ ] **Step 2: Add the test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
  },
});
```

- [ ] **Step 4: Create `src/test/setup.js`**

```js
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Default: the Supabase client is a no-op whose query chain resolves to an
// empty result, so data hooks keep their fallbacks and never hit the network in
// tests. Individual tests can override with their own vi.mock if needed.
vi.mock("../lib/supabase", () => {
  const result = Promise.resolve({ data: null, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    lt: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => result,
    then: (onFulfilled) => result.then(onFulfilled),
  };
  return {
    supabase: {
      from: () => chain,
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});
```

Note: the relative path in `vi.mock("../lib/supabase")` is resolved from each test file. Because the setup file registers the mock globally via `vi.mock` hoisting, place the mock in each test file that needs it OR keep this in setup and confirm resolution; if resolution fails, move the `vi.mock("./lib/supabase", ...)` call into the individual test file with a path relative to that file. Verify in Step 6.

- [ ] **Step 5: Write the smoke test**

`src/test/smoke.test.jsx`:
```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

test("app mounts at / and shows the Discover surface", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
  // Discover renders the city label from the fallback reference data.
  expect(await screen.findByText(/Nairobi/i)).toBeInTheDocument();
});
```

This test depends on the router refactor (Task 6). Until then, it asserts against the current `App`. If Task 1 runs first, temporarily assert on any stable text the current Discover screen renders (e.g. a heading), and tighten it after Task 6.

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS (1 test). If the supabase mock path fails to resolve, move the `vi.mock` into `smoke.test.jsx` with path `../lib/supabase` and re-run.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/test/
git commit -m "test: add vitest + testing-library with a mount smoke test"
```

---

## Phase 1 — Foundations (no behavior change)

### Task 2: Add CityContext and LocalReviewsContext

**Files:**
- Create: `src/context/CityContext.jsx`
- Create: `src/context/LocalReviewsContext.jsx`
- Test: `src/context/CityContext.test.jsx`

**Interfaces:**
- Produces: `useCity() -> { cityKey: string, setCityKey: (key) => void }`, default `cityKey === "nairobi"`.
- Produces: `useLocalReviews() -> { reviewsByBusiness: object, justPostedFor: string|null, addReview: (businessId, review) => void }`. `addReview` prepends the review, sets `justPostedFor`, and clears it after 6000ms — matching the prototype's `submitReview`.

- [ ] **Step 1: Write the failing test**

`src/context/CityContext.test.jsx`:
```jsx
import { render, screen, act } from "@testing-library/react";
import { CityProvider, useCity } from "./CityContext.jsx";

function Probe() {
  const { cityKey, setCityKey } = useCity();
  return <button onClick={() => setCityKey("mombasa")}>{cityKey}</button>;
}

test("defaults to nairobi and updates on set", () => {
  render(<CityProvider><Probe /></CityProvider>);
  const btn = screen.getByRole("button");
  expect(btn).toHaveTextContent("nairobi");
  act(() => btn.click());
  expect(btn).toHaveTextContent("mombasa");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- CityContext`
Expected: FAIL (cannot find `./CityContext.jsx`).

- [ ] **Step 3: Create `src/context/CityContext.jsx`**

```jsx
// The currently-selected city, lifted out of the KaribuApp root state so any
// route can read or change it. The LIST of cities still lives in
// ReferenceDataContext; this holds only the selection.
import { createContext, useContext, useState } from "react";

const CityContext = createContext({ cityKey: "nairobi", setCityKey: () => {} });

export function CityProvider({ children }) {
  const [cityKey, setCityKey] = useState("nairobi");
  return (
    <CityContext.Provider value={{ cityKey, setCityKey }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  return useContext(CityContext);
}
```

- [ ] **Step 4: Create `src/context/LocalReviewsContext.jsx`**

```jsx
// Guest reviews are local-only until an auth flow ships (see root CLAUDE.md):
// submitting one updates optimistic in-memory state and shows a "just posted"
// toast on the business screen. This preserves the prototype's exact behaviour
// now that the compose flow spans two routes (/b/:slug/review -> /b/:slug).
// Sub-project 2 decides this flow's final fate.
import { createContext, useContext, useState } from "react";

const LocalReviewsContext = createContext({
  reviewsByBusiness: {},
  justPostedFor: null,
  addReview: () => {},
});

export function LocalReviewsProvider({ children }) {
  const [reviewsByBusiness, setReviewsByBusiness] = useState({});
  const [justPostedFor, setJustPostedFor] = useState(null);

  const addReview = (businessId, review) => {
    setReviewsByBusiness((prev) => ({
      ...prev,
      [businessId]: [review, ...(prev[businessId] || [])],
    }));
    setJustPostedFor(businessId);
    setTimeout(() => setJustPostedFor(null), 6000);
  };

  return (
    <LocalReviewsContext.Provider
      value={{ reviewsByBusiness, justPostedFor, addReview }}
    >
      {children}
    </LocalReviewsContext.Provider>
  );
}

export function useLocalReviews() {
  return useContext(LocalReviewsContext);
}
```

- [ ] **Step 5: Run tests + lint**

Run: `npm test -- CityContext && npm run lint`
Expected: test PASS; lint clean (mirror `ReferenceDataContext.jsx`'s export shape so the react-refresh rule behaves identically).

- [ ] **Step 6: Commit**

```bash
git add src/context/CityContext.jsx src/context/LocalReviewsContext.jsx src/context/CityContext.test.jsx
git commit -m "feat: add CityContext and LocalReviewsContext (unused until cutover)"
```

### Task 3: Extract shared presentational components

Move `GlobalStyles`, `Badge`, `StarRow`, `HeroImage`, `PlaceholderScreen`, `BottomNav`, `DesktopNav` out of `KaribuApp.jsx` into `src/components/`, and import them back. Pure code move — no behavior change.

**Files:**
- Create: `src/components/{GlobalStyles,Badge,StarRow,HeroImage,PlaceholderScreen,BottomNav,DesktopNav}.jsx`
- Modify: `src/KaribuApp.jsx` (remove those definitions, add imports)

- [ ] **Step 1: Locate GlobalStyles**

Run: `grep -nE "GlobalStyles|const Badge|const StarRow|const HeroImage|const PlaceholderScreen|const BottomNav|const DesktopNav" src/KaribuApp.jsx`
Record the exact line ranges of each definition.

- [ ] **Step 2: Move each component to its own file**

For each component, create `src/components/<Name>.jsx` containing the moved definition plus its own imports (`import { icon } from "lucide-react"`, `import React from "react"` where JSX needs it) and `export default function <Name>(...) {...}` (convert the `const X = (...) => ...` to a default-exported function, or keep the const and `export default X`). `BottomNav` and `DesktopNav` keep their `{ active, go }` props unchanged. `PlaceholderScreen` keeps `{ title, message }`. Do not change any JSX or class names.

- [ ] **Step 3: Import them back into KaribuApp.jsx**

Add at the top of `KaribuApp.jsx`:
```jsx
import GlobalStyles from "./components/GlobalStyles.jsx";
import Badge from "./components/Badge.jsx";
import StarRow from "./components/StarRow.jsx";
import HeroImage from "./components/HeroImage.jsx";
import PlaceholderScreen from "./components/PlaceholderScreen.jsx";
import BottomNav from "./components/BottomNav.jsx";
import DesktopNav from "./components/DesktopNav.jsx";
```
Remove the original in-file definitions.

- [ ] **Step 4: Verify build, lint, and a manual render**

Run: `npm run build && npm run lint && npm test`
Then `npm run dev` and confirm the app looks identical at ~375px and ~1280px (nav bars, badges, star rows, hero images all render as before).
Expected: build + lint + tests pass; no visible change.

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/KaribuApp.jsx
git commit -m "refactor: extract shared UI (nav, badge, star row, hero, placeholder, global styles)"
```

### Task 4: Add the navigation adapter

**Files:**
- Create: `src/lib/nav.js`
- Test: `src/lib/nav.test.js`

**Interfaces:**
- Produces: `pathFor(screen, payload) -> string`; `TAB_PATH` (record of tab key -> path); `activeTabFromPath(pathname) -> tab key`; `useLegacyNav() -> { go(screen, payload?), back() }`. `go` navigates to `pathFor(...)` and passes `payload` via router `state`.

- [ ] **Step 1: Write the failing test**

`src/lib/nav.test.js`:
```js
import { pathFor, activeTabFromPath, TAB_PATH } from "./nav.js";

test("pathFor maps screens + payloads to routes", () => {
  expect(pathFor("discover")).toBe("/");
  expect(pathFor("ask")).toBe("/ask");
  expect(pathFor("guides")).toBe("/guides");
  expect(pathFor("guide_article", { slug: "using-mpesa" })).toBe("/guides/using-mpesa");
  expect(pathFor("business", { slug: "the-talisman" })).toBe("/b/the-talisman");
  expect(pathFor("business", { id: "talisman" })).toBe("/b/talisman");
  expect(pathFor("review_compose", { slug: "the-talisman" })).toBe("/b/the-talisman/review");
  expect(pathFor("category", { key: "beauty" })).toBe("/c/beauty");
  expect(pathFor("category", { key: "beauty", subType: { key: "nails" } })).toBe("/c/beauty/nails");
  expect(pathFor("business_signup")).toBe("/for-business");
  expect(pathFor("merchant_dashboard")).toBe("/merchant");
  expect(pathFor("city_picker")).toBe("/city");
});

test("activeTabFromPath highlights the right tab", () => {
  expect(activeTabFromPath("/")).toBe("discover");
  expect(activeTabFromPath("/b/x")).toBe("discover");
  expect(activeTabFromPath("/c/beauty")).toBe("discover");
  expect(activeTabFromPath("/guides")).toBe("guides");
  expect(activeTabFromPath("/saved")).toBe("saved");
  expect(activeTabFromPath("/for-business")).toBe("business_signup");
  expect(activeTabFromPath("/profile")).toBe("profile");
  expect(TAB_PATH.discover).toBe("/");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- nav`
Expected: FAIL (cannot find `./nav.js`).

- [ ] **Step 3: Create `src/lib/nav.js`**

```js
// The single source of truth mapping the prototype's screen-name navigation
// onto real routes. useLegacyNav lets screen components keep calling
// go("business", biz) / back() unchanged while the router does the work, so the
// cutover changes wiring, never a screen's internals.
import { useNavigate } from "react-router-dom";

export function pathFor(screen, payload) {
  switch (screen) {
    case "discover":
      return "/";
    case "ask":
      return "/ask";
    case "guides":
      return "/guides";
    case "guide_article":
      return `/guides/${payload?.slug || payload?.id}`;
    case "business":
      return `/b/${payload?.slug || payload?.id}`;
    case "review_compose":
      return `/b/${payload?.slug || payload?.id}/review`;
    case "category": {
      const sub = payload?.subType?.key;
      return sub ? `/c/${payload.key}/${sub}` : `/c/${payload?.key}`;
    }
    case "business_signup":
      return "/for-business";
    case "merchant_dashboard":
      return "/merchant";
    case "city_picker":
      return "/city";
    case "search":
      return "/search";
    case "saved":
      return "/saved";
    case "profile":
      return "/profile";
    default:
      return "/";
  }
}

export const TAB_PATH = {
  discover: "/",
  guides: "/guides",
  saved: "/saved",
  business_signup: "/for-business",
  profile: "/profile",
};

// Detail routes reached from Discover (/c, /b, /search) highlight Discover,
// matching the prototype's "root tab of the stack" behaviour for the common
// case. Documented as an intentional approximation.
export function activeTabFromPath(pathname) {
  if (pathname.startsWith("/guides")) return "guides";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/for-business")) return "business_signup";
  if (pathname.startsWith("/profile")) return "profile";
  return "discover";
}

export function useLegacyNav() {
  const navigate = useNavigate();
  const go = (screen, payload = null) =>
    navigate(pathFor(screen, payload), payload ? { state: { payload } } : undefined);
  const back = () => navigate(-1);
  return { go, back };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- nav`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.js src/lib/nav.test.js
git commit -m "feat: add legacy-nav router adapter (pathFor + useLegacyNav)"
```

---

## Phase 2 — Router cutover (atomic)

### Task 5: Add the layout shells

**Files:**
- Create: `src/layout/AppFrame.jsx`, `src/layout/AppShell.jsx`, `src/layout/FullBleedLayout.jsx`

These reproduce the prototype's outer shell exactly (see `KaribuApp.jsx` lines ~3119–3149). `AppFrame` is the persistent viewport; `AppShell` adds the two nav bars around the scroll area; `FullBleedLayout` is the same scroll area with no nav.

- [ ] **Step 1: Create `src/layout/AppFrame.jsx`**

```jsx
// The persistent app viewport: the kitenge background, the mobile-width column
// on desktop, and the safe-area insets. Reproduces the prototype's outer shell
// exactly; only the screen content inside it changes per route.
import { Outlet } from "react-router-dom";
import GlobalStyles from "../components/GlobalStyles.jsx";

export default function AppFrame() {
  return (
    <>
      <GlobalStyles />
      <div
        className="app-viewport font-sans-d text-ink kitenge-bg"
        style={{
          backgroundColor: "#EEE5D3",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div
          className="w-full h-full flex flex-col overflow-hidden"
          style={{
            backgroundColor: "#F7F1E8",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <Outlet />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `src/layout/AppShell.jsx`**

```jsx
// Chrome layout: the desktop top-nav and the mobile bottom-nav around the
// scrollable screen. The active tab is derived from the path.
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DesktopNav from "../components/DesktopNav.jsx";
import BottomNav from "../components/BottomNav.jsx";
import { TAB_PATH, activeTabFromPath } from "../lib/nav.js";

export default function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = activeTabFromPath(pathname);
  const goTab = (key) => navigate(TAB_PATH[key] || "/");
  return (
    <>
      <DesktopNav active={active} go={goTab} />
      <div className="flex-1 min-h-0 overflow-y-auto hide-scroll">
        <Outlet />
      </div>
      <BottomNav active={active} go={goTab} />
    </>
  );
}
```

- [ ] **Step 3: Create `src/layout/FullBleedLayout.jsx`**

```jsx
// No-chrome layout for the full-screen flows (Ask Karibu, city picker, review
// composer, guide article, merchant dashboard) — the routes the prototype hid
// the nav for. Same scroll container, no nav.
import { Outlet } from "react-router-dom";

export default function FullBleedLayout() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto hide-scroll">
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: pass (files compile; not yet wired).

- [ ] **Step 5: Commit**

```bash
git add src/layout/
git commit -m "feat: add AppFrame/AppShell/FullBleedLayout layout shells"
```

### Task 6: Cut over from the state-stack router to react-router

This is the one atomic switch. It (a) exports the screen components from `KaribuApp.jsx` so pages can import them, (b) adds every page wrapper, (c) adds `routes.jsx`, (d) rewires `App.jsx`, and (e) deletes the old root `Karibu()` navigation. Screens' internals are untouched.

**Files:**
- Modify: `src/KaribuApp.jsx` (add `export` to each screen `const`; delete the root `Karibu()` default export and its stack/`go`/`back`/`renderScreen`/`goTab`/`exitMerchant`/`handleCitySelect`/`submitReview`)
- Create: all 15 files in `src/pages/`
- Create: `src/routes.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useLegacyNav` (Task 4), `useCity` / `useLocalReviews` (Task 2), the layout shells (Task 5), `useReferenceData` (existing).
- Produces: `AppRoutes` default export mounted by `App`.

- [ ] **Step 1: Export the screens**

In `src/KaribuApp.jsx`, add the `export` keyword to each screen definition:
`DiscoverScreen`, `SubCategoryScreen`, `CategoryScreen`, `BusinessScreen`, `ReviewComposerScreen`, `BusinessSignupScreen`, `CityPickerScreen`, `AskKaribuScreen`, `MerchantDashboardScreen`, `GuidesHubScreen`, `GuideArticleScreen`, `SearchScreen` (e.g. `export const DiscoverScreen = (...) => {`). Leave their bodies unchanged.

- [ ] **Step 2: Create the page wrappers**

Create each file below verbatim.

`src/pages/DiscoverPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { DiscoverScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function DiscoverPage() {
  const { go } = useLegacyNav();
  const navigate = useNavigate();
  const { cityKey } = useCity();
  return (
    <DiscoverScreen go={go} activeCity={cityKey} onOpenCityPicker={() => navigate("/city")} />
  );
}
```

`src/pages/CategoryPage.jsx` (also serves `/c/:categorySlug/:subSlug` — the subtype is folded in):
```jsx
import { useParams } from "react-router-dom";
import { CategoryScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

export default function CategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <CategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
```

`src/pages/BusinessPage.jsx`:
```jsx
import { useParams, useLocation } from "react-router-dom";
import { BusinessScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useLocalReviews } from "../context/LocalReviewsContext.jsx";

export default function BusinessPage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { go, back } = useLegacyNav();
  const { reviewsByBusiness, justPostedFor } = useLocalReviews();
  const payload = state?.payload ?? { id: slug, slug };
  const id = payload.id;
  return (
    <BusinessScreen
      payload={payload}
      go={go}
      back={back}
      reviews={id ? reviewsByBusiness[id] || [] : []}
      justPosted={justPostedFor != null && justPostedFor === id}
    />
  );
}
```

`src/pages/ReviewComposePage.jsx`:
```jsx
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ReviewComposerScreen } from "../KaribuApp.jsx";
import { useLocalReviews } from "../context/LocalReviewsContext.jsx";

export default function ReviewComposePage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { addReview } = useLocalReviews();
  const payload = state?.payload ?? { id: slug, slug };
  const onSubmit = (businessId, review) => {
    addReview(businessId, review);
    navigate(-1);
  };
  return <ReviewComposerScreen payload={payload} back={() => navigate(-1)} onSubmit={onSubmit} />;
}
```

`src/pages/ForBusinessPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { BusinessSignupScreen } from "../KaribuApp.jsx";

export default function ForBusinessPage() {
  const navigate = useNavigate();
  return <BusinessSignupScreen back={() => navigate(-1)} />;
}
```

`src/pages/CityPickerPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { CityPickerScreen } from "../KaribuApp.jsx";
import { useCity } from "../context/CityContext.jsx";

export default function CityPickerPage() {
  const navigate = useNavigate();
  const { cityKey, setCityKey } = useCity();
  const onSelect = (key) => {
    setCityKey(key);
    navigate(-1);
  };
  return <CityPickerScreen back={() => navigate(-1)} activeCity={cityKey} onSelect={onSelect} />;
}
```

`src/pages/AskKaribuPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { AskKaribuScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function AskKaribuPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <AskKaribuScreen back={() => navigate(-1)} go={go} activeCity={cityKey} />;
}
```

`src/pages/GuidesPage.jsx`:
```jsx
import { GuidesHubScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function GuidesPage() {
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <GuidesHubScreen go={go} activeCity={cityKey} />;
}
```

`src/pages/GuideArticlePage.jsx` (carries the PR #10 id-key fix — `key={payload.id}` forces a remount on article→article navigation):
```jsx
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { GuideArticleScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";

export default function GuideArticlePage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const payload = state?.payload ?? { id: slug, slug };
  return <GuideArticleScreen key={payload.id} payload={payload} back={() => navigate(-1)} go={go} />;
}
```

`src/pages/MerchantDashboardPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { MerchantDashboardScreen } from "../KaribuApp.jsx";

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  return <MerchantDashboardScreen back={() => navigate("/")} />;
}
```

`src/pages/SearchPage.jsx`:
```jsx
import { useNavigate } from "react-router-dom";
import { SearchScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";

export default function SearchPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  return <SearchScreen back={() => navigate(-1)} go={go} />;
}
```

`src/pages/SavedPage.jsx` (exact copy from the prototype's placeholder):
```jsx
import PlaceholderScreen from "../components/PlaceholderScreen.jsx";

export default function SavedPage() {
  return (
    <PlaceholderScreen
      title="Your saved places"
      message="Tap the heart on any business to save it here for later. Great for building a short-list before a trip."
    />
  );
}
```

`src/pages/ProfilePage.jsx`:
```jsx
import PlaceholderScreen from "../components/PlaceholderScreen.jsx";

export default function ProfilePage() {
  return (
    <PlaceholderScreen
      title="Your profile"
      message="Sign in to sync your saved places across devices and leave reviews."
    />
  );
}
```

`src/pages/SubCategoryPage.jsx` — `SubCategoryScreen` has no navigation into it today (no `go("subcategory", ...)` call site). It is extracted for parity but left UNROUTED. Add the file, and in Step 1's export list confirm whether any code reaches it before deciding to route or delete (Task 20 revisits):
```jsx
import { useParams } from "react-router-dom";
import { SubCategoryScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

// NOTE: currently unreachable (no navigation targets "subcategory"). Kept for
// parity; wire to a route or remove with the team in a later task.
export default function SubCategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <SubCategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
```
To satisfy the react-refresh/unused rules without routing it, this file may stay unimported; if lint flags an unused file it will not (ESLint lints imports, not orphan files). Leave it; Task 20 decides its fate.

`src/pages/NotFoundPage.jsx` (new; no prior art, so an on-brand placeholder is allowed):
```jsx
import PlaceholderScreen from "../components/PlaceholderScreen.jsx";

export default function NotFoundPage() {
  return (
    <PlaceholderScreen
      title="Page not found"
      message="That page doesn't exist. Head back to Discover to find trusted places near you."
    />
  );
}
```

- [ ] **Step 3: Create `src/routes.jsx`**

```jsx
// The route table. Chrome routes sit under AppShell, full-screen flows under
// FullBleedLayout, both inside the persistent AppFrame.
import { Routes, Route } from "react-router-dom";
import AppFrame from "./layout/AppFrame.jsx";
import AppShell from "./layout/AppShell.jsx";
import FullBleedLayout from "./layout/FullBleedLayout.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import BusinessPage from "./pages/BusinessPage.jsx";
import ForBusinessPage from "./pages/ForBusinessPage.jsx";
import GuidesPage from "./pages/GuidesPage.jsx";
import SavedPage from "./pages/SavedPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import AskKaribuPage from "./pages/AskKaribuPage.jsx";
import CityPickerPage from "./pages/CityPickerPage.jsx";
import ReviewComposePage from "./pages/ReviewComposePage.jsx";
import GuideArticlePage from "./pages/GuideArticlePage.jsx";
import MerchantDashboardPage from "./pages/MerchantDashboardPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        <Route element={<AppShell />}>
          <Route index element={<DiscoverPage />} />
          <Route path="c/:categorySlug" element={<CategoryPage />} />
          <Route path="c/:categorySlug/:subSlug" element={<CategoryPage />} />
          <Route path="b/:slug" element={<BusinessPage />} />
          <Route path="for-business" element={<ForBusinessPage />} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<FullBleedLayout />}>
          <Route path="ask" element={<AskKaribuPage />} />
          <Route path="city" element={<CityPickerPage />} />
          <Route path="b/:slug/review" element={<ReviewComposePage />} />
          <Route path="guides/:slug" element={<GuideArticlePage />} />
          <Route path="merchant" element={<MerchantDashboardPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 4: Rewire `src/App.jsx`**

```jsx
import { ReferenceDataProvider } from "./context/ReferenceDataContext.jsx";
import { CityProvider } from "./context/CityContext.jsx";
import { LocalReviewsProvider } from "./context/LocalReviewsContext.jsx";
import AppRoutes from "./routes.jsx";

export default function App() {
  return (
    <ReferenceDataProvider>
      <CityProvider>
        <LocalReviewsProvider>
          <AppRoutes />
        </LocalReviewsProvider>
      </CityProvider>
    </ReferenceDataProvider>
  );
}
```

- [ ] **Step 5: Delete the old root navigation from `KaribuApp.jsx`**

Remove the `export default function Karibu() {...}` component and its helpers (`stack`, `go`, `back`, `goTab`, `exitMerchant`, `submitReview`, `handleCitySelect`, `renderScreen`, `activeTab`, `hideBottomNav`, and the outer JSX shell now living in the layouts). Leave the screen component definitions (now exported) and any shared constants/helpers they still reference. `KaribuApp.jsx` no longer has a default export.

- [ ] **Step 6: Verify the whole app + deep links by hand**

Run: `npm run build && npm run lint && npm run dev`
Walk every route and confirm no visible change vs. before:
- `/` Discover; open a category (`/c/...`), a business (`/b/...`), Ask (`/ask`), Guides (`/guides`), a guide article (`/guides/...`), city picker (`/city`), For Business (`/for-business`), Saved, Profile, Search, Merchant (`/merchant`).
- Bottom/desktop nav shows on chrome routes, hidden on `ask`, `city`, `b/:slug/review`, `guides/:slug`, `merchant`.
- Back button (browser + in-screen) returns correctly.
- **Deep link cold-load:** hard-refresh on `/b/<a real slug>` and `/guides/<a real slug>` and confirm the detail loads from Supabase (the whole point of the refactor). Confirm article→article navigation shows the new article (PR #10 id-key fix carried).
- Review compose: open a business, start a review, submit, confirm the optimistic review + "just posted" toast appear on the business screen.

- [ ] **Step 7: Tighten the smoke test + commit**

Update `src/test/smoke.test.jsx` if needed so it asserts on Discover content under the new router. Run `npm test`.
```bash
git add src/pages/ src/routes.jsx src/App.jsx src/KaribuApp.jsx src/test/smoke.test.jsx
git commit -m "refactor: cut over to react-router with page wrappers and layout routes"
```

---

## Phase 3 — Screen extraction (one screen per task)

Each task moves one screen's definition out of `KaribuApp.jsx` and inlines it into its page file, so the temporary `export`/import indirection disappears. Pure code move: no JSX, class, or logic change.

**Repeatable procedure (apply per screen):**
1. Open the page file (e.g. `src/pages/BusinessPage.jsx`) and the screen definition in `KaribuApp.jsx`.
2. Move the screen component's full body into the page file, renaming it to the page component and merging the wrapper's prop-wiring around it. Keep its imports (lucide icons, hooks, shared components, constants). Any shared fallback constant it relies on that still lives in `KaribuApp.jsx` (e.g. `recommended`, `guides`, `salonsList`, `tiers`, `reviewsSample`) moves to `src/data/` (follow the `referenceData.js` precedent) if used by more than one screen, or into the page file if used only there.
3. Remove the now-dead `export const <Screen>` from `KaribuApp.jsx` and the `import { <Screen> } from "../KaribuApp.jsx"` line from the page.
4. Run `npm run build && npm run lint && npm test`, then eyeball the screen at ~375px and ~1280px.
5. Commit: `git commit -m "refactor: extract <ScreenName> into pages/<PageName>"`.

**Order (leaf/simple screens first):**

- [ ] **Task 7:** SavedPage + ProfilePage already stand alone (they use `PlaceholderScreen`); confirm no `PlaceholderScreen` dependence remains in `KaribuApp.jsx` other than shared import. (No move needed if already clean — skip if so.)
- [ ] **Task 8:** SearchScreen → `SearchPage.jsx`. Confirm reachability first (`grep -n 'go("search"' src` and any header search button); note findings in the commit.
- [ ] **Task 9:** CityPickerScreen → `CityPickerPage.jsx`.
- [ ] **Task 10:** BusinessSignupScreen → `ForBusinessPage.jsx`.
- [ ] **Task 11:** MerchantDashboardScreen → `MerchantDashboardPage.jsx`.
- [ ] **Task 12:** GuidesHubScreen → `GuidesPage.jsx` (moves any `guides` fallback constant to `src/data/`).
- [ ] **Task 13:** GuideArticleScreen → `GuideArticlePage.jsx` (keep the `key={payload.id}` in the page).
- [ ] **Task 14:** AskKaribuScreen → `AskKaribuPage.jsx`.
- [ ] **Task 15:** DiscoverScreen → `DiscoverPage.jsx` (moves `recommended` and `guides` fallbacks to `src/data/` if not already).
- [ ] **Task 16:** CategoryScreen → `CategoryPage.jsx`.
- [ ] **Task 17:** SubCategoryScreen → `SubCategoryPage.jsx` (unreachable; move for parity, keep unrouted, flag in commit).
- [ ] **Task 18:** BusinessScreen → `BusinessPage.jsx`.
- [ ] **Task 19:** ReviewComposerScreen → `ReviewComposePage.jsx`.

After each task, `KaribuApp.jsx` shrinks. When the last screen is out, it holds only leftover shared constants/helpers (if any) — move those to `src/data/` or `src/lib/` in the same task that empties the file.

---

## Phase 4 — Cleanup and verification

### Task 20: Reachability decision for SubCategory/Search

- [ ] **Step 1:** Confirm whether `SubCategoryScreen` and `SearchScreen` are reachable in the shipped UX (grep the whole `src/` for anything that would navigate to `/c/:categorySlug/:subSlug` as a *distinct* screen, or to `/search`). Record findings.
- [ ] **Step 2:** If genuinely unreachable, leave `SubCategoryPage.jsx` unrouted with its NOTE comment (do not delete without the team). If `SearchScreen` is reachable (e.g. a header search icon), confirm the `/search` route works; if not, note it for Sub-project 2.
- [ ] **Step 3:** Commit any notes/adjustments.

### Task 21: Delete the monolith, add deep-link tests, update docs

**Files:**
- Delete: `src/KaribuApp.jsx` (once empty)
- Create: `src/pages/BusinessPage.test.jsx`, `src/pages/GuideArticlePage.test.jsx`, `src/test/navigation.test.jsx`
- Modify: `src/CLAUDE.md`, `CLAUDE.md`

- [ ] **Step 1: Confirm KaribuApp.jsx is empty and delete it**

Run: `grep -c "." src/KaribuApp.jsx` and confirm nothing but possibly a trailing comment remains; move any leftover exports first. Then `git rm src/KaribuApp.jsx`.

- [ ] **Step 2: Deep-link test — BusinessPage cold-load by slug**

`src/pages/BusinessPage.test.jsx`:
```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "../context/CityContext.jsx";
import { LocalReviewsProvider } from "../context/LocalReviewsContext.jsx";
import { ReferenceDataProvider } from "../context/ReferenceDataContext.jsx";
import BusinessPage from "./BusinessPage.jsx";

test("mounts from a cold /b/:slug URL with no nav state", () => {
  render(
    <ReferenceDataProvider>
      <CityProvider>
        <LocalReviewsProvider>
          <MemoryRouter initialEntries={["/b/the-talisman"]}>
            <Routes>
              <Route path="/b/:slug" element={<BusinessPage />} />
            </Routes>
          </MemoryRouter>
        </LocalReviewsProvider>
      </CityProvider>
    </ReferenceDataProvider>,
  );
  // The page renders without throwing even though there is no location.state.
  expect(document.body).toBeTruthy();
});
```
(With the default supabase mock the detail fetch resolves empty and the screen keeps its fallback — the assertion is that a cold deep link mounts without a payload.)

- [ ] **Step 3: Deep-link test — GuideArticlePage cold-load**

`src/pages/GuideArticlePage.test.jsx`: mirror Step 2 for `/guides/:slug` mounting `GuideArticlePage`, asserting it mounts with no `location.state`.

- [ ] **Step 4: Tab navigation test**

`src/test/navigation.test.jsx`: render `App` in a `MemoryRouter` at `/`, click the Guides tab (find by its label text), and assert the guides surface appears; click back to Discover and assert Discover appears. Use `@testing-library/user-event`.

- [ ] **Step 5: Run the full suite**

Run: `npm test && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 6: Update docs**

- `src/CLAUDE.md`: replace the "do not bulk-split `KaribuApp.jsx`" framing with the new structure (pages/, components/, layout/, routes.jsx, contexts), noting the split is done and verified.
- Root `CLAUDE.md`: in "Where we are right now", correct the stale claim that edge functions are not deployed (they were deployed 2026-07-12), and note the frontend is now route-based.

- [ ] **Step 7: Final manual parity pass + commit**

`npm run dev`; walk every route at ~375px and ~1280px one more time. Then:
```bash
git add -A
git commit -m "refactor: delete KaribuApp monolith; add deep-link + nav tests; update docs"
```

---

## Self-review (completed by plan author)

**Spec coverage:** Every spec section maps to tasks — routing map (Task 6 `routes.jsx`), incremental extraction with render checks (Tasks 7–19), `activeCity` → context (Task 2, wired Task 6), params+hooks replace payloads for deep links (Task 6 pages + Task 21 tests), frontend tests (Tasks 1, 2, 4, 21), delete monolith + doc updates (Task 21), full-bleed vs chrome via layout routes (Task 5/6, checklist in 6.6). The `hideBottomNav` acceptance list is verified explicitly in Task 6 Step 6.

**Placeholder scan:** No TBD/TODO left as work items; the only "NOTE" is the deliberately-unreachable `SubCategoryScreen`, which has an explicit decision task (Task 20).

**Type/name consistency:** `useCity()`/`cityKey`, `useLocalReviews()`/`addReview`/`justPostedFor`, `pathFor`/`TAB_PATH`/`activeTabFromPath`/`useLegacyNav`, and the page/route names are used identically across `routes.jsx`, the pages, and the tests.

**Known approximation (documented):** `activeTabFromPath` highlights Discover for `/c` and `/b` detail routes, matching the prototype's common-case "root tab of the stack". If the team wants exact origin-tab tracking, thread the origin through router `state` in a follow-up — out of scope here.
