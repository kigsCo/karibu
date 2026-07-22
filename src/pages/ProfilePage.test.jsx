// ProfilePage: signed-out shows the passwordless email form (advancing to a
// "check your inbox" confirmation) plus the pointer to /welcome; signed-in is
// the profile hub — name/avatar from the profiles row, the inline name
// editor, "Your reviews" with status chips, and visit history with Clear.
//
// The supabase client is the offline mock from src/test/setup.js. useAuth,
// useProfile, useMyReviews, and useVisitHistory are mocked through hoisted
// state so each case pins its exact shape. REVIEW_STATUS_CHIP is re-exported
// through the real useMyReviews module, so the mock preserves it.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage.jsx";

const { authState, profileState, reviewsState, historyState } = vi.hoisted(() => ({
  authState: { current: null },
  profileState: { current: null },
  reviewsState: { current: null },
  historyState: { current: null },
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../hooks/useProfile.js", () => ({
  useProfile: () => profileState.current,
}));
vi.mock("../hooks/useMyReviews.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, useMyReviews: () => reviewsState.current };
});
vi.mock("../hooks/useVisitHistory.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, useVisitHistory: () => historyState.current };
});

const signedIn = {
  session: { user: { email: "v@example.com" } },
  user: { id: "u1", email: "v@example.com" },
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
    saveHomeCity: async () => true,
  };
  reviewsState.current = { reviews: [], loading: false };
  historyState.current = {
    visits: [],
    loading: false,
    error: null,
    clear: async () => true,
  };
});

test("signed out: sending a sign-in link shows the confirmation state", async () => {
  const user = userEvent.setup();
  renderPage();

  expect(
    screen.getByRole("heading", { name: "Sign in to Karibu" }),
  ).toBeInTheDocument();
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
  expect(
    await screen.findByRole("button", { name: /add your name/i }),
  ).toBeInTheDocument();
});

test("signed in: reviews render with honest status chips", () => {
  authState.current = signedIn;
  reviewsState.current = {
    loading: false,
    reviews: [
      {
        id: "r1",
        rating: 5,
        body: "Great fades, quick service, fair prices for Westlands.",
        status: "published",
        created_at: "2026-07-01T10:00:00Z",
        business: { slug: "bloke-barbers", name: "Bloke Barbers" },
      },
      {
        id: "r2",
        rating: 3,
        body: "Queue was long on a Saturday morning but staff were kind.",
        status: "pending_moderation",
        created_at: "2026-07-20T10:00:00Z",
        business: { slug: "ashleys", name: "Ashleys" },
      },
    ],
  };
  renderPage();

  expect(screen.getByText("Bloke Barbers")).toBeInTheDocument();
  expect(screen.getByText("Live")).toBeInTheDocument();
  expect(screen.getByText("Ashleys")).toBeInTheDocument();
  expect(screen.getByText("In review")).toBeInTheDocument();
});

test("signed in: clearing visit history calls clear()", async () => {
  const clear = vi.fn().mockResolvedValue(true);
  authState.current = signedIn;
  historyState.current = {
    loading: false,
    error: null,
    clear,
    visits: [
      {
        business_id: "b1",
        visited_at: "2026-07-22T10:00:00Z",
        business: {
          slug: "the-talisman",
          name: "The Talisman",
          hood: "Karen",
          category: { label: "Restaurants" },
        },
      },
    ],
  };
  const user = userEvent.setup();
  renderPage();

  expect(screen.getByText("The Talisman")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear history" }));
  expect(clear).toHaveBeenCalledTimes(1);
});
