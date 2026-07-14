import { Sparkles, Check } from "lucide-react";

const Badge = ({ kind, children }) => {
  const styles = {
    recommended: { bg: "#FBF4E0", border: "#D4A341", color: "#7A5A10" },
    verified: { bg: "#EBEFE9", border: "#5C7A5E", color: "#2A3D2B" },
    open: { bg: "#EFF5EC", border: "#7A9A6F", color: "#2A3D2B" },
    closed: { bg: "#F3EEE9", border: "#B8A999", color: "#6B5B4A" },
  };
  const s = styles[kind] || styles.verified;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {kind === "recommended" && <Sparkles size={11} />}
      {kind === "verified" && <Check size={11} />}
      {children}
    </span>
  );
};

export default Badge;
