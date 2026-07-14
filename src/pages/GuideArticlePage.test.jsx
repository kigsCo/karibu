import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "../context/CityContext.jsx";
import { LocalReviewsProvider } from "../context/LocalReviewsContext.jsx";
import { ReferenceDataProvider } from "../context/ReferenceDataContext.jsx";
import GuideArticlePage from "./GuideArticlePage.jsx";

// Mirrors BusinessPage.test.jsx: a visitor lands on /guides/:slug directly
// (shared link, refresh, bookmark) with NO `location.state`, so `payload` is
// only `{ id: slug, slug }` (see GuideArticlePage's
// `state?.payload ?? { id: slug, slug }`). Unlike BusinessPage, this payload
// is NOT merged onto a full prototype guide -- `useGuideDetail` seeds its
// state directly from that sparse payload, and the mocked Supabase client
// (src/test/setup.js) resolves the detail fetch to `null`, so the guide never
// gains a real `category`. That is exactly the scenario the guides.js
// PR #10 hardening fix (`GUIDE_CATEGORY_FALLBACK`) targets: an
// unrecognised/absent category must render the "Guide" chip instead of
// throwing on `cat.Icon` / `cat.label`. Asserting on that fallback text is a
// concrete, meaningful check of the cold deep-link path -- not a tautology,
// and not something routes.test.jsx (which only checks "did it throw")
// already covers.
test("mounts from a cold /guides/:slug URL with no nav state and renders the guide-category fallback", async () => {
  render(
    <ReferenceDataProvider>
      <CityProvider>
        <LocalReviewsProvider>
          <MemoryRouter initialEntries={["/guides/using-mpesa"]}>
            <Routes>
              <Route path="/guides/:slug" element={<GuideArticlePage />} />
            </Routes>
          </MemoryRouter>
        </LocalReviewsProvider>
      </CityProvider>
    </ReferenceDataProvider>,
  );

  // "More from {cat.label}" only renders "More from Guide" when `cat` fell
  // back to GUIDE_CATEGORY_FALLBACK -- i.e. when the cold-loaded guide has no
  // resolved category, exactly as expected with no nav state and no live data.
  expect(await screen.findByText("More from Guide")).toBeInTheDocument();
});
