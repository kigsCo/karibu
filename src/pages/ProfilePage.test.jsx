// Minimal auth surface (FIX_PLAN P0 #6). Proves both states of ProfilePage:
// signed-out shows the passwordless email form and advances to a "check your
// inbox" confirmation after sending; signed-in shows the email + sign-out.
//
// The supabase client is the offline mock from src/test/setup.js, whose
// signInWithOtp resolves success — so we can drive the form without a network.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "./ProfilePage.jsx";

const { authState } = vi.hoisted(() => ({
  authState: {
    current: { session: null, user: null, loading: false, signOut: () => {} },
  },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));

test("signed out: sending a sign-in link shows the confirmation state", async () => {
  authState.current = { session: null, user: null, loading: false, signOut: () => {} };
  const user = userEvent.setup();
  render(<ProfilePage />);

  expect(
    screen.getByRole("heading", { name: "Sign in to Karibu" }),
  ).toBeInTheDocument();

  await user.type(
    screen.getByPlaceholderText("you@example.com"),
    "visitor@example.com",
  );
  await user.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

  expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
  expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
});

test("signed in: shows the account email and a sign-out control", () => {
  authState.current = {
    session: { user: { email: "v@example.com" } },
    user: { email: "v@example.com" },
    loading: false,
    signOut: () => {},
  };
  render(<ProfilePage />);

  expect(
    screen.getByRole("heading", { name: "Your profile" }),
  ).toBeInTheDocument();
  expect(screen.getByText("v@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
});
