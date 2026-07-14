// Chrome layout: the desktop top-nav and the mobile bottom-nav around the
// scrollable screen. The active tab is derived from the path.
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DesktopNav from "../components/DesktopNav.jsx";
import BottomNav from "../components/BottomNav.jsx";
import { TAB_PATH, activeTabFromPath } from "../lib/nav.js";

export default function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = activeTabFromPath(pathname);
  const goTab = (key) => navigate(TAB_PATH[key] || "/");
  return (
    <>
      <DesktopNav active={active} go={goTab} />
      <div className="flex-1 min-h-0 overflow-y-auto hide-scroll">
        <Outlet />
      </div>
      <BottomNav active={active} go={goTab} />
    </>
  );
}
