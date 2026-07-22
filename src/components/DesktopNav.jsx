import { Compass, BookOpen, Bookmark, User } from "lucide-react";

// The bottom tab bar is a mobile pattern. On tablet/desktop we surface the same
// customer destinations as a top navigation bar and hide the bottom bar
// (md:hidden), so the wide layout gets proper app chrome instead of a stranded
// mobile row. Business chrome deliberately lives off-tab at /for-business.
const DesktopNav = ({ active, go }) => {
  const items = [
    { key: "discover", label: "Discover", Icon: Compass },
    { key: "guides", label: "Guides", Icon: BookOpen },
    { key: "saved", label: "Saved", Icon: Bookmark },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div className="hidden md:flex items-center justify-between border-b border-ink-10 bg-ivory px-8 py-3 flex-shrink-0">
      <button
        onClick={() => go("discover")}
        className="font-serif-d text-2xl text-clay leading-none"
      >
        Karibu
      </button>
      <nav className="flex items-center gap-1">
        {items.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => go(key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition ${
              active === key
                ? "bg-clay-soft text-clay"
                : "text-stone-w hover:text-ink hover:bg-black/5"
            }`}
          >
            <Icon size={17} className={active === key ? "text-clay" : "text-stone-w"} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default DesktopNav;
