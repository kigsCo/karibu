// MyBusinessSection.test.jsx — the card renders only for owners and links
// to /merchant; non-owners see nothing.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MyBusinessSection from "./MyBusinessSection.jsx";

const { bizState } = vi.hoisted(() => ({
  bizState: { current: { businesses: [], loading: false } },
}));
vi.mock("../../hooks/useMyBusinesses.js", () => ({
  useMyBusinesses: () => bizState.current,
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<MyBusinessSection />} />
        <Route path="/merchant" element={<div>MERCHANT ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("no listings: renders nothing", () => {
  bizState.current = { businesses: [], loading: false };
  const { container } = mount();
  expect(container).toBeEmptyDOMElement();
});

test("an owner sees the card and it opens the dashboard", async () => {
  bizState.current = {
    businesses: [{ id: "b1", name: "Posh Palace", status: "active" }],
    loading: false,
  };
  const user = userEvent.setup();
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /open dashboard/i }));
  expect(await screen.findByText("MERCHANT ROUTE")).toBeInTheDocument();
});
