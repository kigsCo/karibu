// RegisterBusinessPage.test.jsx — signed-out visitors get a sign-in prompt
// (never a dead form); signed-in submission calls business-intake with the
// intake payload and ends on the under-review confirmation.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RegisterBusinessPage from "./RegisterBusinessPage.jsx";

const { authState, invokeSpy, uploadSpy } = vi.hoisted(() => ({
  authState: { current: { session: null, user: null } },
  invokeSpy: vi.fn(() => Promise.resolve({ data: { id: "b1", slug: "s" }, error: null })),
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../context/ReferenceDataContext.jsx", () => ({
  useReferenceData: () => ({
    cities: [{ key: "nairobi", label: "Nairobi", hoods: ["Kilimani", "CBD"] }],
    categories: [
      { key: "beauty", label: "Beauty", subTypes: [{ key: "hair", label: "Hair" }] },
    ],
  }),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadSpy }) },
    functions: { invoke: invokeSpy },
  },
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/for-business/register"]}>
      <Routes>
        <Route path="/for-business/register" element={<RegisterBusinessPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeFile(name) {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  invokeSpy.mockClear();
  uploadSpy.mockClear();
});

test("signed out: prompts sign-in instead of a form", async () => {
  authState.current = { session: null, user: null };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});

test("signed in: a complete form submits the register payload and confirms", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  const user = userEvent.setup();
  mount();

  await user.type(screen.getByLabelText(/business name/i), "Posh Palace");
  await user.selectOptions(screen.getByLabelText(/category/i), "beauty");
  await user.selectOptions(screen.getByLabelText(/^city/i), "nairobi");
  await user.selectOptions(screen.getByLabelText(/neighbourhood/i), "Kilimani");
  await user.type(
    screen.getByLabelText(/about/i),
    "A calm, spotless salon with senior stylists and fair prices.",
  );
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.type(screen.getByLabelText(/opening hours/i), "Mon-Sat 9am-7pm");
  await user.type(screen.getByLabelText(/kra pin/i), "A123456789Z");
  await user.upload(
    screen.getByLabelText(/photos/i),
    [makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")],
  );
  await user.upload(screen.getByLabelText(/id document/i), makeFile("id.jpg"));

  await user.click(screen.getByRole("button", { name: /submit application/i }));

  await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
  const [name, { body }] = invokeSpy.mock.calls[0];
  expect(name).toBe("business-intake");
  expect(body.action).toBe("register");
  expect(body.kra_pin).toBe("A123456789Z");
  expect(body.photo_paths).toHaveLength(3);
  expect(uploadSpy).toHaveBeenCalledTimes(4); // 3 photos + 1 ID doc
  expect(await screen.findByText(/under review/i)).toBeInTheDocument();
});

test("missing photos: submit is blocked with an inline error, nothing invoked", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" } };
  const user = userEvent.setup();
  mount();
  // Fill everything EXCEPT photos so the photo check is the one that fires
  // (validation reports the first missing field).
  await user.type(screen.getByLabelText(/business name/i), "Posh Palace");
  await user.selectOptions(screen.getByLabelText(/category/i), "beauty");
  await user.selectOptions(screen.getByLabelText(/^city/i), "nairobi");
  await user.selectOptions(screen.getByLabelText(/neighbourhood/i), "Kilimani");
  await user.type(
    screen.getByLabelText(/about/i),
    "A calm, spotless salon with senior stylists and fair prices.",
  );
  await user.type(screen.getByLabelText(/phone/i), "0712345678");
  await user.type(screen.getByLabelText(/opening hours/i), "Mon-Sat 9am-7pm");
  await user.type(screen.getByLabelText(/kra pin/i), "A123456789Z");
  await user.click(screen.getByRole("button", { name: /submit application/i }));
  expect(await screen.findByText(/at least 3 photos/i)).toBeInTheDocument();
  expect(invokeSpy).not.toHaveBeenCalled();
});
