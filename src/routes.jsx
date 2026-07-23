// The route table. Chrome routes sit under AppShell, full-screen flows under
// FullBleedLayout, both inside the persistent AppFrame.
import { Routes, Route } from "react-router-dom";
import AppFrame from "./layout/AppFrame.jsx";
import AppShell from "./layout/AppShell.jsx";
import FullBleedLayout from "./layout/FullBleedLayout.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import SubCategoryPage from "./pages/SubCategoryPage.jsx";
import BusinessPage from "./pages/BusinessPage.jsx";
import ForBusinessPage from "./pages/ForBusinessPage.jsx";
import GuidesPage from "./pages/GuidesPage.jsx";
import SavedPage from "./pages/SavedPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import AskKaribuPage from "./pages/AskKaribuPage.jsx";
import CityPickerPage from "./pages/CityPickerPage.jsx";
import ReviewComposePage from "./pages/ReviewComposePage.jsx";
import ClaimBusinessPage from "./pages/ClaimBusinessPage.jsx";
import GuideArticlePage from "./pages/GuideArticlePage.jsx";
import MerchantDashboardPage from "./pages/MerchantDashboardPage.jsx";
import RegisterBusinessPage from "./pages/RegisterBusinessPage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        <Route element={<AppShell />}>
          <Route index element={<DiscoverPage />} />
          <Route path="browse/:categorySlug" element={<SubCategoryPage />} />
          <Route path="c/:categorySlug" element={<CategoryPage />} />
          <Route path="c/:categorySlug/:subSlug" element={<CategoryPage />} />
          <Route path="b/:slug" element={<BusinessPage />} />
          <Route path="for-business" element={<ForBusinessPage />} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<FullBleedLayout />}>
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="ask" element={<AskKaribuPage />} />
          <Route path="city" element={<CityPickerPage />} />
          <Route path="b/:slug/review" element={<ReviewComposePage />} />
          <Route path="b/:slug/claim" element={<ClaimBusinessPage />} />
          <Route path="guides/:slug" element={<GuideArticlePage />} />
          <Route path="merchant" element={<MerchantDashboardPage />} />
          <Route path="for-business/register" element={<RegisterBusinessPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
