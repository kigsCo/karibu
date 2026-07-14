// The single source of truth mapping the prototype's screen-name navigation
// onto real routes. useLegacyNav lets screen components keep calling
// go("business", biz) / back() unchanged while the router does the work, so the
// cutover changes wiring, never a screen's internals.
import { useNavigate } from "react-router-dom";

export function pathFor(screen, payload) {
  switch (screen) {
    case "discover":
      return "/";
    case "ask":
      return "/ask";
    case "guides":
      return "/guides";
    case "guide_article":
      return `/guides/${payload?.slug || payload?.id}`;
    case "business":
      return `/b/${payload?.slug || payload?.id}`;
    case "review_compose":
      return `/b/${payload?.slug || payload?.id}/review`;
    case "category": {
      const sub = payload?.subType?.key;
      return sub ? `/c/${payload.key}/${sub}` : `/c/${payload?.key}`;
    }
    case "business_signup":
      return "/for-business";
    case "merchant_dashboard":
      return "/merchant";
    case "city_picker":
      return "/city";
    case "search":
      return "/search";
    case "saved":
      return "/saved";
    case "profile":
      return "/profile";
    default:
      return "/";
  }
}

export const TAB_PATH = {
  discover: "/",
  guides: "/guides",
  saved: "/saved",
  business_signup: "/for-business",
  profile: "/profile",
};

// Detail routes reached from Discover (/c, /b, /search) highlight Discover,
// matching the prototype's "root tab of the stack" behaviour for the common
// case. Documented as an intentional approximation.
export function activeTabFromPath(pathname) {
  if (pathname.startsWith("/guides")) return "guides";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/for-business")) return "business_signup";
  if (pathname.startsWith("/profile")) return "profile";
  return "discover";
}

export function useLegacyNav() {
  const navigate = useNavigate();
  const go = (screen, payload = null) =>
    navigate(pathFor(screen, payload), payload ? { state: { payload } } : undefined);
  const back = () => navigate(-1);
  return { go, back };
}
