const HeroImage = ({ variant = "posh" }) => {
  // Warm-toned SVG placeholders so the prototype looks polished offline
  const palettes = {
    posh: ["#E8B89E", "#B8472E", "#3A2418"],
    talisman: ["#C9A76B", "#6F4E1F", "#1F1A11"],
    artcaffe: ["#E4D5B8", "#A48253", "#2C2317"],
    default: ["#E8B89E", "#B8472E", "#2A3D2B"],
  };
  const p = palettes[variant] || palettes.default;
  return (
    <svg viewBox="0 0 400 240" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`g-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p[0]} />
          <stop offset="60%" stopColor={p[1]} />
          <stop offset="100%" stopColor={p[2]} />
        </linearGradient>
        <pattern id={`pat-${variant}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12 L12 0 L24 12 L12 24 Z" fill="none" stroke={p[0]} strokeOpacity="0.18" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill={`url(#g-${variant})`} />
      <rect width="400" height="240" fill={`url(#pat-${variant})`} />
      <circle cx="320" cy="60" r="80" fill={p[0]} fillOpacity="0.3" />
      <circle cx="80" cy="200" r="110" fill={p[2]} fillOpacity="0.25" />
    </svg>
  );
};

export default HeroImage;
