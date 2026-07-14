// The persistent app viewport: the kitenge background, the mobile-width column
// on desktop, and the safe-area insets. Reproduces the prototype's outer shell
// exactly; only the screen content inside it changes per route.
import { Outlet } from "react-router-dom";
import GlobalStyles from "../components/GlobalStyles.jsx";

export default function AppFrame() {
  return (
    <>
      <GlobalStyles />
      <div
        className="app-viewport font-sans-d text-ink kitenge-bg"
        style={{
          backgroundColor: "#EEE5D3",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div
          className="w-full h-full flex flex-col overflow-hidden"
          style={{
            backgroundColor: "#F7F1E8",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <Outlet />
        </div>
      </div>
    </>
  );
}
