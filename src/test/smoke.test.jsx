import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

// After the Task 6 cutover, App mounted at "/" resolves the react-router index
// route to DiscoverPage, which renders DiscoverScreen for the default city
// "nairobi" (CityContext). "Nairobi" itself appears in several places on this
// screen (the city picker badge, the "Nairobi National Park Safari" card, guide
// titles), so we assert on the full greeting heading instead — it is unique on
// the page and only renders correctly if the fallback reference data
// (ReferenceDataContext, KAR-5) resolved `activeCity: "nairobi"` to its
// `label: "Nairobi"`.
test("app mounts at / and shows the Discover surface", async () => {
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText("What do you need in Nairobi?"),
  ).toBeInTheDocument();
});
