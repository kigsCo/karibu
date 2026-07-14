import { Compass, BookOpen, Bookmark, Briefcase, User } from "lucide-react";

const BottomNav = ({ active, go }) => {
  const items = [
    { key: "discover", label: "Discover", Icon: Compass },
    { key: "guides", label: "Guides", Icon: BookOpen },
    { key: "saved", label: "Saved", Icon: Bookmark },
    { key: "business_signup", label: "Business", Icon: Briefcase },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div
      className="border-t border-ink-10 bg-ivory grid grid-cols-5 flex-shrink-0 md:hidden"
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
