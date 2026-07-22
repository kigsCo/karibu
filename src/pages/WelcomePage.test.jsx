// The /welcome auth landing page: Google OAuth kicks off through
// signInWithOAuth, the form toggles between sign-in and create-account,
// account creation goes through signUp (surfacing the confirm-email notice
// when no session comes back), and an already-signed-in visitor is bounced to
// /profile. The supabase client is the offline mock from src/test/setup.js;
// auth method calls are observed with spies on that mock.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { supabase } from "../lib/supabase";
import WelcomePage from "./WelcomePage.jsx";

const { authState } = vi.hoisted(() => ({
  authState: {
    current: { session: null, user: null, loading: false, signOut: () => {} },
  },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/welcome"]}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/profile" element={<div>PROFILE-SCREEN</div>} />
        <Route path="/" element={<div>DISCOVER-SCREEN</div>} />
        <Route path="/for-business" element={<div>FOR-BUSINESS-SCREEN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.current = {
    session: null,
    user: null,
    loading: false,
    signOut: () => {},
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("Continue with Google starts the OAuth flow", async () => {
  const oauth = vi.spyOn(supabase.auth, "signInWithOAuth");
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole("button", { name: /continue with google/i }));

  expect(oauth).toHaveBeenCalledTimes(1);
  expect(oauth.mock.calls[0][0].provider).toBe("google");
});

test("toggles between sign-in and create-account modes", async () => {
  const user = userEvent.setup();
  renderPage();

  // Default: sign-in mode, no name field.
  expect(
    screen.getByRole("heading", { name: "Welcome back" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByPlaceholderText("Your name (optional)"),
  ).not.toBeInTheDocument();

  await user.click(
    screen.getByRole("button", { name: /new to karibu\? create an account/i }),
  );

  expect(
    screen.getByRole("heading", { name: "Create your account" }),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Your name (optional)"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create account" }),
  ).toBeInTheDocument();
});

test("creating an account calls signUp and shows the confirm-email notice", async () => {
  // The mock resolves { session: null } — the confirmation-required shape.
  const signUp = vi.spyOn(supabase.auth, "signUp");
  const user = userEvent.setup();
  renderPage();

  await user.click(
    screen.getByRole("button", { name: /new to karibu\? create an account/i }),
  );
  await user.type(
    screen.getByPlaceholderText("Your name (optional)"),
    "Amina W.",
  );
  await user.type(
    screen.getByPlaceholderText("you@example.com"),
    "newbie@example.com",
  );
  await user.type(
    screen.getByPlaceholderText("Password (6+ characters)"),
    "s3cret-pw",
  );
  await user.click(screen.getByRole("button", { name: "Create account" }));

  expect(signUp).toHaveBeenCalledTimes(1);
  const arg = signUp.mock.calls[0][0];
  expect(arg.email).toBe("newbie@example.com");
  expect(arg.options.data.full_name).toBe("Amina W.");
  expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
});

test("signing in with a password calls signInWithPassword", async () => {
  const signIn = vi.spyOn(supabase.auth, "signInWithPassword");
  const user = userEvent.setup();
  renderPage();

  await user.type(
    screen.getByPlaceholderText("you@example.com"),
    "v@example.com",
  );
  await user.type(screen.getByPlaceholderText("Password"), "s3cret-pw");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  expect(signIn).toHaveBeenCalledWith({
    email: "v@example.com",
    password: "s3cret-pw",
  });
});

test("an already-signed-in visitor is redirected to /profile", async () => {
  authState.current = {
    session: { user: { email: "v@example.com" } },
    user: { email: "v@example.com" },
    loading: false,
    signOut: () => {},
  };
  renderPage();

  expect(await screen.findByText("PROFILE-SCREEN")).toBeInTheDocument();
});

test("the business section directs to /for-business", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(
    screen.getByRole("button", { name: /own a business in kenya/i }),
  );

  expect(await screen.findByText("FOR-BUSINESS-SCREEN")).toBeInTheDocument();
});
