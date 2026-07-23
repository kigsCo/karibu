// MerchantDashboardPage.test.jsx — the four states plus switcher, on real
// hook seams (hooks mocked at module level; no network).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MerchantDashboardPage from "./MerchantDashboardPage.jsx";

const { authState, bizState, statsState } = vi.hoisted(() => ({
  authState: { current: { session: { user: { id: "u1" } }, user: { id: "u1" }, loading: false, signOut: vi.fn() } },
  bizState: { current: { businesses: [], loading: false, error: null, refresh: vi.fn() } },
  statsState: { current: { stats: null, loading: false } },
}));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => authState.current }));
vi.mock("../hooks/useMyBusinesses.js", () => ({ useMyBusinesses: () => bizState.current }));
vi.mock("../hooks/useMerchantStats.js", () => ({ useMerchantStats: () => statsState.current }));
vi.mock("../hooks/useOwnerListingUpdate.js", () => ({
  useOwnerListingUpdate: () => ({ save: vi.fn(async () => true), saving: false, error: null }),
}));

const ACTIVE = {
  id: "b1", slug: "posh", name: "Posh Palace", status: "active", tier: "free",
  rating: 4.5, review_count: 12, improvement_until: null,
  hero_image_url: null, gallery_image_urls: [], hours_json: "Mon-Sat 9am-7pm",
  phone: "0712345678", whatsapp: null, email: null, website: null,
  about: "A calm salon.", price_range: null, address: null, hood: "Kilimani",
  category: { label: "Health & Beauty" },
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/merchant"]}>
      <Routes>
        <Route path="/merchant" element={<MerchantDashboardPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
        <Route path="/for-business/register" element={<div>REGISTER ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("guest: sign-in prompt, no dashboard", async () => {
  authState.current = { session: null, user: null, loading: false, signOut: vi.fn() };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
});

test("no listings: register CTA", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" }, loading: false, signOut: vi.fn() };
  bizState.current = { businesses: [], loading: false, error: null, refresh: vi.fn() };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /list your business/i }));
  expect(await screen.findByText("REGISTER ROUTE")).toBeInTheDocument();
});

test("pending-only: under-review panel, no dashboard tiles", () => {
  bizState.current = {
    businesses: [{ ...ACTIVE, id: "p1", status: "pending", name: "Pending Co" }],
    loading: false, error: null, refresh: vi.fn(),
  };
  mount();
  expect(screen.getByText(/under review/i)).toBeInTheDocument();
  expect(screen.queryByText(/last 30 days/i)).not.toBeInTheDocument();
});

test("active: real tiles from business + stats, no mock metrics", () => {
  bizState.current = { businesses: [ACTIVE], loading: false, error: null, refresh: vi.fn() };
  statsState.current = {
    stats: { reviews_30d: 3, five_star: 8, one_star: 0, pending_moderation: 1,
             trend: [{ month: "2026-06", avg: 4.4, count: 5 }, { month: "2026-07", avg: 4.5, count: 7 }] },
    loading: false,
  };
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getByText("4.5")).toBeInTheDocument();       // rating tile
  expect(screen.getByText("3")).toBeInTheDocument();          // 30d tile
  expect(screen.getByText("1")).toBeInTheDocument();          // in moderation
  expect(screen.queryByText(/profile views/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/whatsapp taps/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/what reviewers mention/i)).not.toBeInTheDocument();
});

test("stats failure: tiles show em-dashes, page intact", () => {
  bizState.current = { businesses: [ACTIVE], loading: false, error: null, refresh: vi.fn() };
  statsState.current = { stats: null, loading: false };
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
});

test("two active listings: switcher swaps the header", async () => {
  bizState.current = {
    businesses: [ACTIVE, { ...ACTIVE, id: "b2", slug: "second", name: "Second Shop" }],
    loading: false, error: null, refresh: vi.fn(),
  };
  const user = userEvent.setup();
  mount();
  // BusinessSwitcher also renders each name inside an <option>, so a bare
  // text query collides with the header — target the heading specifically.
  expect(screen.getByRole("heading", { level: 1, name: "Posh Palace" })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/your listings/i), "b2");
  expect(await screen.findByRole("heading", { level: 1, name: "Second Shop" })).toBeInTheDocument();
});
