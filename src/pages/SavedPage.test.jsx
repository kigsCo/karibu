// SavedPage: guests (and empty lists) keep the original placeholder copy;
// signed-in users get their real saved_places list, and tapping the heart
// removes a place through the hook's toggle.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SavedPage from "./SavedPage.jsx";

const { savedState } = vi.hoisted(() => ({ savedState: { current: null } }));
vi.mock("../hooks/useSavedPlaces.js", () => ({
  useSavedPlaces: () => savedState.current,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedPage />
    </MemoryRouter>,
  );
}

const place = (id, name, slug) => ({
  business_id: id,
  saved_at: "2026-07-22T10:00:00Z",
  business: {
    slug,
    name,
    hood: "Westlands",
    rating: 4.6,
    review_count: 10,
    tier: "free",
    category: { label: "Beauty" },
  },
});

test("guest: shows the placeholder invitation", () => {
  savedState.current = {
    canPersist: false,
    savedIds: new Set(),
    places: [],
    loading: false,
    toggle: vi.fn(),
  };
  renderPage();
  expect(screen.getByText("Your saved places")).toBeInTheDocument();
  expect(screen.getByText(/tap the heart on any business/i)).toBeInTheDocument();
});

test("signed in: lists saved places and un-hearts through toggle", async () => {
  const toggle = vi.fn().mockResolvedValue(true);
  savedState.current = {
    canPersist: true,
    savedIds: new Set(["b1", "b2"]),
    places: [place("b1", "Ashleys", "ashleys"), place("b2", "La Beauté", "la-beaute")],
    loading: false,
    toggle,
  };
  const user = userEvent.setup();
  renderPage();

  expect(screen.getByText("Ashleys")).toBeInTheDocument();
  expect(screen.getByText("La Beauté")).toBeInTheDocument();
  expect(screen.getByText(/2 saved/)).toBeInTheDocument();

  await user.click(
    screen.getAllByRole("button", { name: "Remove from saved" })[0],
  );
  expect(toggle).toHaveBeenCalledWith("b1");
});

test("signed in but empty: falls back to the placeholder", () => {
  savedState.current = {
    canPersist: true,
    savedIds: new Set(),
    places: [],
    loading: false,
    toggle: vi.fn(),
  };
  renderPage();
  expect(screen.getByText(/tap the heart on any business/i)).toBeInTheDocument();
});
