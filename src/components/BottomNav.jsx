import { Compass, BookOpen, Bookmark, User } from "lucide-react";

// Customer chrome only: the business side lives at /for-business (reached
// from /welcome's business card and deep links), deliberately not a tab.
const BottomNav = ({ active, go }) => {
  const items = [
    { key: "discover", label: "Discover", Icon: Compass },
    { key: "guides", label: "Guides", Icon: BookOpen },
    { key: "saved", label: "Saved", Icon: Bookmark },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div
      data-testid="bottom-nav"
      className="border-t border-ink-10 bg-ivory grid grid-cols-4 flex-shrink-0 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className="flex flex-col items-center py-2.5"
        >
          <Icon size={19} className={active === key ? "text-clay" : "text-stone-w"} />
          <span
            className={`text-[10px] md:text-xs mt-0.5 ${
              active === key ? "text-clay font-semibold" : "text-stone-w"
            }`}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default BottomNav;
