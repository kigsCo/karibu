// WelcomePage.next.test.jsx — a signed-in visit to /welcome honours
// location.state.next so auth-gated flows can bounce through sign-in.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import WelcomePage from "./WelcomePage.jsx";

const { authState } = vi.hoisted(() => ({
  authState: { current: { session: { user: { id: "u1" } }, loading: false } },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));

function mount(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/profile" element={<div>PROFILE ROUTE</div>} />
        <Route path="/for-business/register" element={<div>REGISTER ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("already signed in with a next state: lands on next", async () => {
  mount({ pathname: "/welcome", state: { next: "/for-business/register" } });
  expect(await screen.findByText("REGISTER ROUTE")).toBeInTheDocument();
});

test("already signed in without next: lands on /profile as before", async () => {
  mount({ pathname: "/welcome" });
  expect(await screen.findByText("PROFILE ROUTE")).toBeInTheDocument();
});
