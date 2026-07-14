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
