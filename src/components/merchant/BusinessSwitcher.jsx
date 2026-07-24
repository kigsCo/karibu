// Hidden for a single listing; a compact labelled select for several.
export default function BusinessSwitcher({ businesses, selectedId, onSelect }) {
  if (!businesses || businesses.length < 2) return null;
  return (
    <div className="px-5 md:px-8 pt-4">
      <label htmlFor="ms-switcher" className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider block mb-1">
        Your listings
      </label>
      <select
        id="ms-switcher"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
