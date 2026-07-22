// Session-aware review composer (FIX_PLAN P0 #6 + #7).
//
// Before auth shipped, a signed-out visitor who wrote a review saw it "posted"
// and were told it was live — but nothing persisted (submit-review needs a
// session). These tests prove the honest behaviour AND that they distinguish the
// fix from pre-fix code:
//   - signed out  -> the composer prompts sign-in, navigates there, and does NOT
//                    optimistically add the review (no fabricated persistence);
//   - signed in   -> a completed form posts for real (calls addReview, the
//                    optimistic local write) and does NOT redirect to sign-in.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ReviewComposePage from "./ReviewComposePage.jsx";

const { authState, addReviewSpy } = vi.hoisted(() => ({
  authState: { current: { session: null } },
  addReviewSpy: vi.fn(),
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
// Mock LocalReviews so we can assert whether the optimistic write happened.
vi.mock("../context/LocalReviewsContext.jsx", () => ({
  useLocalReviews: () => ({ addReview: addReviewSpy }),
}));

function mountReview() {
  return render(
    <MemoryRouter initialEntries={["/b/posh-palace/review"]}>
      <Routes>
        <Route path="/b/:slug/review" element={<ReviewComposePage />} />
        <Route path="/profile" element={<div>PROFILE ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => addReviewSpy.mockClear());

test("signed out: prompts sign-in, navigates there, and never fabricates a post", async () => {
  authState.current = { session: null };
  const user = userEvent.setup();
  mountReview();

  // The honest notice (its inline "Sign in" link) is present...
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  // ...and the primary CTA is a sign-in prompt, not "Post review".
  await user.click(screen.getByRole("button", { name: "Sign in to post review" }));

  // It takes the visitor to sign in — and NEVER optimistically added a review.
  expect(await screen.findByText("PROFILE ROUTE")).toBeInTheDocument();
  expect(addReviewSpy).not.toHaveBeenCalled();
});

test("signed in: a completed form posts for real (addReview fires, no sign-in redirect)", async () => {
  authState.current = { session: { user: { email: "v@example.com" } } };
  const user = userEvent.setup();
  mountReview();

  // No sign-in notice for a signed-in user.
  expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();

  // Fill a valid review: 5 stars (anchored on the stable "How was it?" copy so
  // the click doesn't depend on styling), a recommendation, and a >=40-char body.
  const ratingSection = screen.getByText("How was it?").parentElement;
  const stars = ratingSection.querySelectorAll("button");
  await user.click(stars[4]);
  await user.click(screen.getByRole("button", { name: /Yes, absolutely/i }));
  await user.type(
    screen.getByPlaceholderText(/What stood out/i),
    "Genuinely excellent service and spotless throughout my whole visit.",
  );

  // The CTA is now the real post action (pre-fix this was always "Post review"
  // regardless of auth; the distinguishing behaviour is what the click DOES).
  await user.click(screen.getByRole("button", { name: "Post review" }));

  // It posted (optimistic local write) and did NOT redirect to sign-in.
  expect(addReviewSpy).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("PROFILE ROUTE")).not.toBeInTheDocument();
});
