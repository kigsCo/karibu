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
