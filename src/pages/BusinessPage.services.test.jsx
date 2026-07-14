import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "../context/CityContext.jsx";
import { LocalReviewsProvider } from "../context/LocalReviewsContext.jsx";
import { ReferenceDataProvider } from "../context/ReferenceDataContext.jsx";
import BusinessPage from "./BusinessPage.jsx";

// Regression for the "Services & prices" fallback leak: because the detail
// screen merges each business onto recommended[0] (the Posh Palace SALON
// constant) for first paint, a live business with no services_json used to
// inherit that salon's price list (Classic manicure, Box braids, ...). A
// restaurant would show nail-salon services. The fix reads services/hours/
// M-Pesa from the LIVE row only once it has loaded, hiding each section when
// this business has none of its own.
//
// We drive that live row by mocking useBusinessDetail (the default supabase
// mock keeps liveBiz null, which is the first-paint fallback path, not this).
const { detail } = vi.hoisted(() => ({
  detail: { current: { business: null, reviews: null } },
}));
vi.mock("../hooks/useBusinessDetail.js", () => ({
  useBusinessDetail: () => detail.current,
}));

function mountAt(slug) {
  return render(
    <ReferenceDataProvider>
      <CityProvider>
        <LocalReviewsProvider>
          <MemoryRouter initialEntries={[`/b/${slug}`]}>
            <Routes>
              <Route path="/b/:slug" element={<BusinessPage />} />
            </Routes>
          </MemoryRouter>
        </LocalReviewsProvider>
      </CityProvider>
    </ReferenceDataProvider>,
  );
}

// A restaurant as it comes back from the DB today: real about/category, but no
// services_json (mapDetailRow omits `services`), no hours, no M-Pesa till.
const restaurantNoServices = {
  id: "nyama-mama-delta",
  slug: "nyama-mama-delta",
  name: "Nyama Mama (Delta)",
  hood: "Westlands",
  category: "Restaurants",
  about: "Fun modern-African diner reinventing Kenyan comfort food.",
  rating: 0,
  reviews: 0,
  price: null,
  badge: null,
  tags: [],
};

test("a loaded business with no services shows no services (no salon-fallback leak)", async () => {
  detail.current = { business: restaurantNoServices, reviews: [] };
  mountAt("nyama-mama-delta");

  expect(
    await screen.findByRole("heading", { name: "Nyama Mama (Delta)" }),
  ).toBeInTheDocument();
  // The recommended[0] salon services must NOT leak onto this restaurant.
  expect(screen.queryByText("Box braids (medium)")).not.toBeInTheDocument();
  expect(screen.queryByText("Classic manicure")).not.toBeInTheDocument();
  // With nothing to list, the whole section is hidden rather than showing a
  // borrowed price list.
  expect(screen.queryByText("Services & prices")).not.toBeInTheDocument();
});

test("a loaded business with its own services renders them", async () => {
  detail.current = {
    business: {
      ...restaurantNoServices,
      services: [{ name: "Chef's tasting menu", price: "KSh 4,500" }],
    },
    reviews: [],
  };
  mountAt("nyama-mama-delta");

  expect(
    await screen.findByRole("heading", { name: "Nyama Mama (Delta)" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Services & prices")).toBeInTheDocument();
  expect(screen.getByText("Chef's tasting menu")).toBeInTheDocument();
  expect(screen.getByText("KSh 4,500")).toBeInTheDocument();
  // And still no leaked salon service.
  expect(screen.queryByText("Box braids (medium)")).not.toBeInTheDocument();
});
