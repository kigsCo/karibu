// Avatar for the profile header: the provider photo when one exists (Google
// supplies it via the profiles row), otherwise an initials circle in the
// app's palette. No uploads this round — see the profile-hub spec.
export default function InitialsAvatar({ name, email, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="w-14 h-14 rounded-full object-cover"
      />
    );
  }
  const source = (name || "").trim() || (email || "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : (source[0] || "?").toUpperCase();
  return (
    <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center">
      <span className="font-serif-d text-xl text-clay">{initials}</span>
    </div>
  );
}
