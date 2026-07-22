// Auth surface of ProfilePage: signed-out shows the passwordless email form
// (advancing to "check your inbox" after sending) plus the pointer to the
// /welcome landing page; signed-in shows the profiles-row name/email, the
// inline name editor, and sign-out.
//
// The supabase client is the offline mock from src/test/setup.js (its
// signInWithOtp resolves success). useAuth and useProfile are mocked per-test
// through hoisted state so each case pins its exact auth/profile shape.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage.jsx";

const { authState, profileState } = vi.hoisted(() => ({
  authState: {
    current: { session: null, user: null, loading: false, signOut: () => {} },
  },
  profileState: {
    current: {
      profile: null,
      loading: false,
      saving: false,
      error: null,
      saveName: async () => true,
    },
  },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../hooks/useProfile.js", () => ({
  useProfile: () => profileState.current,
}));

const signedIn = {
  session: { user: { email: "v@example.com" } },
  user: { email: "v@example.com" },
  loading: false,
  signOut: () => {},
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
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
  profileState.current = {
    profile: null,
    loading: false,
    saving: false,
    error: null,
    saveName: async () => true,
  };
});

test("signed out: sending a sign-in link shows the confirmation state", async () => {
  const user = userEvent.setup();
  renderPage();

  expect(
    screen.getByRole("heading", { name: "Sign in to Karibu" }),
  ).toBeInTheDocument();
  // The pointer to the Google/password landing page.
  expect(
    screen.getByRole("button", { name: /more sign-in options/i }),
  ).toBeInTheDocument();

  await user.type(
    screen.getByPlaceholderText("you@example.com"),
    "visitor@example.com",
  );
  await user.click(
    screen.getByRole("button", { name: "Email me a sign-in link" }),
  );

  expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
  expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
});

test("signed in: shows the account email and a sign-out control", () => {
  authState.current = signedIn;
  renderPage();

  expect(
    screen.getByRole("heading", { name: "Your profile" }),
  ).toBeInTheDocument();
  expect(screen.getByText("v@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
});

test("signed in: profile row supplies the display name", () => {
  authState.current = signedIn;
  profileState.current = {
    ...profileState.current,
    profile: {
      id: "u1",
      email: "v@example.com",
      full_name: "Amina W.",
      avatar_url: null,
      home_city_id: null,
    },
  };
  renderPage();

  expect(screen.getByRole("heading", { name: "Amina W." })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit name/i })).toBeInTheDocument();
});

test("signed in: saving a display name calls saveName with the typed value", async () => {
  const saveName = vi.fn().mockResolvedValue(true);
  authState.current = signedIn;
  profileState.current = { ...profileState.current, saveName };
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole("button", { name: /add your name/i }));
  await user.type(screen.getByPlaceholderText("Your name"), "Amina W.");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(saveName).toHaveBeenCalledWith("Amina W.");
  // On success the editor closes back to the display state.
  expect(
    await screen.findByRole("button", { name: /add your name/i }),
  ).toBeInTheDocument();
});
