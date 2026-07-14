import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "../context/CityContext.jsx";
import { LocalReviewsProvider } from "../context/LocalReviewsContext.jsx";
import { ReferenceDataProvider } from "../context/ReferenceDataContext.jsx";
import BusinessPage from "./BusinessPage.jsx";

// Task 21 gap: routes.test.jsx already proves every route mounts (including
// /b/:slug cold) without throwing, but it never inspects what actually
// renders. This test targets the real deep-link scenario -- a visitor lands
// on /b/:slug directly (shared link, refresh, bookmark) with NO
// `location.state`, so `payload` is only `{ id: slug, slug }` (see
// BusinessPage's `state?.payload ?? { id: slug, slug }`). The screen then
// merges that sparse payload onto `recommended[0]` (the prototype fallback,
// KAR-6), so a business-specific name should appear even though the slug in
// the URL matches nothing in the merge. The mocked Supabase client (see
// src/test/setup.js) resolves the detail fetch to `null`, so `liveBiz` never
// overrides the fallback -- proving the cold path renders concrete content
// rather than a blank screen.
test("mounts from a cold /b/:slug URL with no nav state and renders the fallback business", async () => {
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

  // full = { ...recommended[0], ...payload, ...(liveBiz || {}) } -- payload
  // only carries id/slug, so the name comes from recommended[0] ("Posh Palace
  // Salon"), proving the fallback merge fires on a cold, state-less deep link.
  expect(
    await screen.findByRole("heading", { name: "Posh Palace Salon" }),
  ).toBeInTheDocument();
});
