import { ReferenceDataProvider } from "./context/ReferenceDataContext.jsx";
import { CityProvider } from "./context/CityContext.jsx";
import { LocalReviewsProvider } from "./context/LocalReviewsContext.jsx";
import AppRoutes from "./routes.jsx";

export default function App() {
  return (
    <ReferenceDataProvider>
      <CityProvider>
        <LocalReviewsProvider>
          <AppRoutes />
        </LocalReviewsProvider>
      </CityProvider>
    </ReferenceDataProvider>
  );
}
