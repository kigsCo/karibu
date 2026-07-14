// No-chrome layout for the full-screen flows (Ask Karibu, city picker, review
// composer, guide article, merchant dashboard) — the routes the prototype hid
// the nav for. Same scroll container, no nav.
import { Outlet } from "react-router-dom";

export default function FullBleedLayout() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto hide-scroll">
      <Outlet />
    </div>
  );
}
