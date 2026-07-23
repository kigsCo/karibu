// ClaimBusinessPage.test.jsx — the short evidence form for claiming an
// existing listing: signed-out prompts sign-in; signed-in submits the claim
// payload; an already-managed listing shows the dead-end message.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ClaimBusinessPage from "./ClaimBusinessPage.jsx";

const { authState, bizState, invokeSpy, uploadSpy } = vi.hoisted(() => ({
  authState: { current: { session: null, user: null } },
  bizState: { current: { id: "b1", name: "Unowned Co", owner_id: null } },
  invokeSpy: vi.fn(() => Promise.resolve({ data: { id: "c1", status: "pending" }, error: null })),
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: bizState.current, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
      storage: { from: () => ({ upload: uploadSpy }) },
      functions: { invoke: invokeSpy },
    },
  };
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/b/unowned/claim"]}>
      <Routes>
        <Route path="/b/:slug/claim" element={<ClaimBusinessPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invokeSpy.mockClear();
  uploadSpy.mockClear();
});

test("signed out: prompts sign-in", async () => {
  authState.current = { session: null, user: null };
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
});

test("an already-managed listing shows a dead end, no form", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  bizState.current = { id: "b1", name: "Owned Co", owner_id: "someone" };
  mount();
  expect(await screen.findByText(/already managed/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/kra pin/i)).not.toBeInTheDocument();
});

test("signed in: a complete claim submits and confirms", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  bizState.current = { id: "b1", name: "Unowned Co", owner_id: null };
  const user = userEvent.setup();
  mount();

  await user.type(await screen.findByLabelText(/kra pin/i), "A123456789Z");
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.upload(
    screen.getByLabelText(/id document/i),
    new File(["x"], "id.jpg", { type: "image/jpeg" }),
  );
  await user.click(screen.getByRole("button", { name: /submit claim/i }));

  await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
  const [name, { body }] = invokeSpy.mock.calls[0];
  expect(name).toBe("business-intake");
  expect(body.action).toBe("claim");
  expect(body.business_id).toBe("b1");
  expect(await screen.findByText(/under review/i)).toBeInTheDocument();
});

test("a 409 from the server surfaces the real message, not the generic one", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  bizState.current = { id: "b1", name: "Unowned Co", owner_id: null };
  invokeSpy.mockImplementationOnce(() =>
    Promise.resolve({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({
            error: "You already have a claim under review for this listing",
          }),
        },
      },
    }),
  );
  const user = userEvent.setup();
  mount();

  await user.type(await screen.findByLabelText(/kra pin/i), "A123456789Z");
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.upload(
    screen.getByLabelText(/id document/i),
    new File(["x"], "id.jpg", { type: "image/jpeg" }),
  );
  await user.click(screen.getByRole("button", { name: /submit claim/i }));

  expect(
    await screen.findByText("You already have a claim under review for this listing"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Edge Function returned a non-2xx status code")).not.toBeInTheDocument();
});
