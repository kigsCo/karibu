// Pure validation for the business-intake pipeline. Dependency-free so the
// whole decision table is unit-testable without a network or database.

/** KRA PIN: A or P, nine digits, one trailing capital letter. */
export const KRA_PIN_RE = /^[AP][0-9]{9}[A-Z]$/;

export function isValidKraPin(v: unknown): boolean {
  return typeof v === "string" && KRA_PIN_RE.test(v);
}

/** Kenyan mobile: 07XX/01XX local, or 254/+254 international, 9 subscriber digits. */
const KE_PHONE_RE = /^(?:\+?254|0)(7\d{8}|1\d{8})$/;

export function isValidKenyanPhone(v: unknown): boolean {
  return typeof v === "string" && KE_PHONE_RE.test(v.replace(/[\s-]/g, ""));
}

/**
 * Loose Kenya bounding box. This is a sanity check that the pin is on the
 * right continent — hood-level truth is the human reviewer's job.
 */
export function isInKenya(lat: number, lng: number): boolean {
  return lat >= -4.9 && lat <= 5.5 && lng >= 33.5 && lng <= 42.0;
}

/**
 * True when `path` is a storage object path inside the caller's own folder:
 * `<uid>/<something>`, no traversal, no absolute paths. The storage RLS
 * policies enforce the same rule at write time; this re-checks it at intake
 * so a submitted path can never point at another user's evidence.
 */
export function ownsPath(path: unknown, uid: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 1024) return false;
  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments[0] !== uid) return false;
  return segments.slice(1).every((s) => s.length > 0 && s !== "." && s !== "..");
}

/** Lowercase, ascii-ish, hyphen-separated. */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Slug for a new listing: name + 6 random hex chars (uniqueness margin). */
export function newBusinessSlug(name: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const base = slugifyName(name) || "business";
  return `${base}-${suffix}`;
}
