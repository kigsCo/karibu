import { AuthProvider } from "./context/AuthContext.jsx";
import { ReferenceDataProvider } from "./context/ReferenceDataContext.jsx";
import { CityProvider } from "./context/CityContext.jsx";
import { LocalReviewsProvider } from "./context/LocalReviewsContext.jsx";
import AppRoutes from "./routes.jsx";

export default function App() {
  return (
    <AuthProvider>
      <ReferenceDataProvider>
        <CityProvider>
          <LocalReviewsProvider>
            <AppRoutes />
          </LocalReviewsProvider>
        </CityProvider>
      </ReferenceDataProvider>
    </AuthProvider>
  );
}
