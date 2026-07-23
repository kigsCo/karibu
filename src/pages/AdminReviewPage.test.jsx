// AdminReviewPage.test.jsx — the UX gate (server enforces the real one):
// non-staff see "Not authorized"; staff see the queue and can approve, which
// re-fetches.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminReviewPage from "./AdminReviewPage.jsx";

const { authState, profileState, invokeSpy } = vi.hoisted(() => {
  const invokeSpy = vi.fn((name, { body }) => {
    if (body.action === "queue") {
      return Promise.resolve({
        data: {
          registrations: [{
            id: "b1", name: "Posh Palace", hood: "Kilimani", created_at: "2026-07-23",
            city: { name: "Nairobi" }, category: { label: "Beauty" },
            verification: { kra_pin: "A123456789Z", contact_phone: "0712345678" },
            id_document_url: "https://signed/doc",
          }],
          claims: [],
        },
        error: null,
      });
    }
    return Promise.resolve({ data: { ok: true }, error: null });
  });
  return {
    authState: { current: { session: { user: { id: "u1" } }, user: { id: "u1" } } },
    profileState: { current: { is_staff: true } },
    invokeSpy,
  };
});
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: profileState.current, error: null }),
  };
  return {
    supabase: { from: () => chain, functions: { invoke: invokeSpy } },
  };
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminReviewPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invokeSpy.mockClear();
});

test("non-staff: Not authorized, and the queue is never requested", async () => {
  profileState.current = { is_staff: false };
  mount();
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});

test("staff: sees the pending registration with its evidence", async () => {
  profileState.current = { is_staff: true };
  mount();
  expect(await screen.findByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getByText("A123456789Z")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /view id document/i }))
    .toHaveAttribute("href", "https://signed/doc");
});

test("staff: approve posts the decision and refetches the queue", async () => {
  profileState.current = { is_staff: true };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /approve/i }));
  await waitFor(() => {
    const actions = invokeSpy.mock.calls.map(([, { body }]) => body.action);
    expect(actions).toContain("approve");
    expect(actions.filter((a) => a === "queue").length).toBeGreaterThanOrEqual(2);
  });
});

test("staff: reject without a reason is blocked client-side", async () => {
  profileState.current = { is_staff: true };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /^reject/i }));
  expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
  expect(invokeSpy.mock.calls.every(([, { body }]) => body.action !== "reject")).toBe(true);
});
