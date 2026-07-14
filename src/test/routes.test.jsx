import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

// Task 6 cutover proof: every route must MOUNT under the real react-router.
// The supabase mock in src/test/setup.js keeps this offline (data hooks fall
// back to the prototype constants), so a bare mount at each path exercises the
// page wrapper -> screen wiring without a network. If a route throws on mount,
// the wiring is broken — this test is the automated stand-in for a browser walk.

// Render App at a path inside MemoryRouter. act() lets the initial data-hook
// effects (supabase mock -> null -> fallbacks) settle; render throws if any
// component throws on mount.
async function mountAt(path) {
  let container;
  await act(async () => {
    ({ container } = render(
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    ));
  });
  return container;
}

const paths = [
  "/", // Discover (index)
  "/guides", // Guides hub
  "/for-business", // Business signup
  "/saved", // Placeholder
  "/profile", // Placeholder
  "/ask", // Ask Karibu (full-bleed)
  "/city", // City picker (full-bleed)
  "/search", // Search
  "/c/beauty", // Category
  "/b/the-talisman", // Business detail (deep link, no router state)
  "/guides/using-mpesa", // Guide article (deep link, no router state)
  "/merchant", // Merchant dashboard (full-bleed)
  "/no-such-page", // 404 -> NotFoundPage under AppShell
];

describe("route mounts", () => {
  test.each(paths)("mounts %s without throwing", async (path) => {
    const container = await mountAt(path);
    // Render succeeded (no throw) and produced DOM: the AppFrame shell + screen.
    expect(container.firstChild).toBeTruthy();
  });
});

// The riskiest part of the cutover: the "*" catch-all lives UNDER AppShell, so a
// full-bleed route (e.g. /ask) must out-rank it and render its own screen with
// NO nav chrome — not the 404 with chrome. BottomNav's `grid-cols-5` is the
// unambiguous chrome marker; FullBleedLayout renders no nav.
describe("route resolution + chrome", () => {
  test("unknown path renders the 404 page WITH chrome (under AppShell)", async () => {
    const container = await mountAt("/no-such-page");
    expect(container.textContent).toContain("Page not found");
    expect(container.querySelector(".grid-cols-5")).toBeTruthy();
  });

  test("full-bleed route out-ranks '*' and hides chrome", async () => {
    const container = await mountAt("/ask");
    // Had /ask fallen through to '*', we'd see the 404 copy. It doesn't.
    expect(container.textContent).not.toContain("Page not found");
    expect(container.querySelector(".grid-cols-5")).toBeNull();
  });

  test("chrome route ('/') shows the nav", async () => {
    const container = await mountAt("/");
    expect(container.querySelector(".grid-cols-5")).toBeTruthy();
  });
});
