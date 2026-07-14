import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

// routes.test.jsx proves every route MOUNTS directly (jumping straight to a
// path via MemoryRouter's initialEntries). It never clicks anything, so it
// can't catch a wiring break between the tab bar and the router (e.g. a
// BottomNav/DesktopNav key that no longer maps through `TAB_PATH` in
// lib/nav.js). This test drives the real interaction: click the Guides tab,
// see the Guides surface; click back to Discover, see the Discover surface.
//
// Both DesktopNav (`hidden md:flex`) and BottomNav (`md:hidden`) render in
// the DOM at once -- jsdom doesn't evaluate the responsive CSS that would
// hide one of them -- so each tab label matches two buttons. Either one
// exercises the same `go(key)` -> `navigate(TAB_PATH[key])` wiring, so we
// click the first match.
test("clicking the Guides tab shows Guides, and Discover navigates back", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );

  // Starts on Discover.
  expect(
    await screen.findByText("What do you need in Nairobi?"),
  ).toBeInTheDocument();

  const [guidesTab] = screen.getAllByRole("button", { name: "Guides" });
  await user.click(guidesTab);

  expect(
    await screen.findByText(
      "Practical guides written by our editorial team and updated monthly. No affiliate links, no sponsored content.",
    ),
  ).toBeInTheDocument();

  const [discoverTab] = screen.getAllByRole("button", { name: "Discover" });
  await user.click(discoverTab);

  expect(
    await screen.findByText("What do you need in Nairobi?"),
  ).toBeInTheDocument();
});

// Regression guard for the dead "subcategory" nav (KAR): tapping a Discover
// category that HAS sub-types must open the sub-type PICKER (/browse/:cat),
// not silently no-op to "/". This drives the real chain end to end:
// Discover -> Health & Beauty tile -> picker -> Nail Salons -> listing.
// The picker (SubCategoryScreen) and the listing (CategoryScreen) share no
// unique copy, so each assertion below can only pass on the intended surface.
test("Discover -> a has-subs category opens the sub-type picker, then a sub-type opens the listing", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );

  // The Discover "Browse services" grid renders the category tiles. "Health &
  // Beauty" has sub-types, so its tile fires go("subcategory", cat).
  const beautyTile = await screen.findByRole("button", {
    name: /Health & Beauty/i,
  });
  await user.click(beautyTile);

  // Landed on /browse/beauty — the PICKER. "Browse all health & beauty", the
  // "By type" heading, and the per-type tiles are unique to SubCategoryScreen;
  // the /c/... listing shows none of them.
  expect(
    await screen.findByText(/Browse all health & beauty/i),
  ).toBeInTheDocument();
  expect(screen.getByText("By type")).toBeInTheDocument();
  const nailsTile = screen.getByRole("button", { name: "Nail Salons" });

  // Picking a sub-type advances to /c/beauty/nails — the LISTING (CategoryScreen).
  await user.click(nailsTile);

  // CategoryScreen's sort control and the sub-type <h2> are unique to the
  // listing; both prove we left the picker for /c/beauty/nails. (In tests the
  // offline supabase mock resolves an empty live page, so the listing shows its
  // "coming soon" state rather than the seeded salons — the route + screen are
  // what this asserts.) The picker's "Browse all" affordance is now gone.
  expect(await screen.findByText("Sort:")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Nail Salons" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Browse all health & beauty/i),
  ).not.toBeInTheDocument();
});
