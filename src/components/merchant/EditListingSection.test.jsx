// EditListingSection.test.jsx — the editor saves only granted fields,
// surfaces server errors, and locks identity fields.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditListingSection from "./EditListingSection.jsx";

const { saveState, uploadSpy } = vi.hoisted(() => ({
  saveState: { current: { save: vi.fn(async () => true), saving: false, error: null } },
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../../hooks/useOwnerListingUpdate.js", () => ({
  useOwnerListingUpdate: () => saveState.current,
}));
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("../../lib/supabase", () => ({
  supabase: { storage: { from: () => ({ upload: uploadSpy }) } },
}));

const BIZ = {
  id: "b1", name: "Posh Palace", hood: "Kilimani",
  category: { label: "Health & Beauty" },
  hours_json: "Mon-Sat 9am-7pm", phone: "0712345678", whatsapp: "",
  email: "", website: "", about: "A calm salon.", price_range: "",
  address: "", hero_image_url: null, gallery_image_urls: [],
};

beforeEach(() => {
  saveState.current = { save: vi.fn(async () => true), saving: false, error: null };
  uploadSpy.mockClear();
});

test("save sends only granted fields and reports success", async () => {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={onSaved} />);
  const phone = screen.getByLabelText(/phone/i);
  await user.clear(phone);
  await user.type(phone, "0722000000");
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  await waitFor(() => expect(saveState.current.save).toHaveBeenCalledTimes(1));
  const sent = saveState.current.save.mock.calls[0][0];
  expect(sent.phone).toBe("0722000000");
  expect(Object.keys(sent).every((k) =>
    ["hours_json", "phone", "whatsapp", "email", "website", "about",
     "price_range", "address", "hero_image_url", "gallery_image_urls"].includes(k),
  )).toBe(true);
  expect(onSaved).toHaveBeenCalled();
  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
});

test("a failed save surfaces the hook's error and does not call onSaved", async () => {
  saveState.current = {
    save: vi.fn(async () => false), saving: false, error: "value too long for phone",
  };
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={onSaved} />);
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  expect(await screen.findByText("value too long for phone")).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
});

test("identity fields are locked with the contact note", () => {
  render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  expect(screen.getByText(/contact hello@karibu\.co\.ke to change/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/business name/i)).not.toBeInTheDocument();
});

test("adding photos uploads to the owner folder and joins the gallery", async () => {
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  await user.upload(
    screen.getByLabelText(/add photos/i),
    new File(["x"], "new.jpg", { type: "image/jpeg" }),
  );
  await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  await waitFor(() => expect(saveState.current.save).toHaveBeenCalled());
  const sent = saveState.current.save.mock.calls[0][0];
  expect(sent.gallery_image_urls.length).toBe(1);
  expect(sent.gallery_image_urls[0]).toContain("/business-photos/u1/");
});

test("a same-id refetch does not clobber in-flight edits", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  const phone = screen.getByLabelText(/phone/i);
  await user.clear(phone);
  await user.type(phone, "0722000000");
  // Same id, new object reference — as a page refresh after save would deliver.
  rerender(<EditListingSection business={{ ...BIZ }} onSaved={vi.fn()} />);
  expect(screen.getByLabelText(/phone/i)).toHaveValue("0722000000");
});

test("a genuine listing switch reseeds the form", () => {
  const { rerender } = render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  rerender(
    <EditListingSection
      business={{ ...BIZ, id: "b2", phone: "0733999999" }}
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByLabelText(/phone/i)).toHaveValue("0733999999");
});
