---
name: frontend-data-migration
description: Use when replacing a hardcoded constant in src/KaribuApp.jsx with a live Supabase query WITHOUT touching the visual layer — wiring lib/supabase.js, cities/categories into Context, recommended/salonsList into a paginated useBusinesses hook, BusinessScreen by slug, the ask-karibu function swap, and submit-review. Enforces the strict migration order and the do-not-restyle / do-not-bulk-split / always-paginate guardrails.
---

# Frontend data migration

The golden rule (`src/CLAUDE.md`): **migrate the data layer; do not touch the visual layer.** The design, typography, palette, and copy are deliberate. You are swapping hardcoded constants for live Supabase data and leaving everything you can see on screen exactly as it was.

## When to use
Replacing any prototype constant (`cities`, `categories`, `recommended`, `salonsList`, `reviewsSample`, `guides`) or the inline Anthropic `fetch` in `src/KaribuApp.jsx` with real backend data.

## Strict migration order (do these in sequence)
From `src/CLAUDE.md` — do not jump ahead:
1. **`lib/supabase.js`** — typed client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (the only two public vars).
2. **`cities` + `categories`** -> one-time fetch held in React **Context** (small, read-only reference data; fetch once on app load, never per render).
3. **`recommended` + `salonsList`** -> **paginated** queries via `hooks/useBusinesses.js`. Never `select('*')` an unbounded table.
4. **`BusinessScreen`** -> fetch one business **by slug** + its `published` reviews.
5. **The direct `fetch("https://api.anthropic.com/...")`** in `AskKaribuScreen` (~line 2097) -> `supabase.functions.invoke('ask-karibu', ...)`. **Do this EARLY — it removes the leaked API key** (root guardrail 1). Treat it as a priority, not step-5-someday.
6. **In-memory review state** -> `submit-review` function calls, then re-fetch the published reviews.

## Guardrails (violating these is a defect)
- **Never restyle.** No className changes, no component-library swaps, no "while I'm here" cleanup. The JSX that renders stays byte-for-byte where you can manage it; only the data source changes.
- **Never bulk-split `KaribuApp.jsx`.** It is ~3,200 lines in one component. If a screen must move out, extract exactly one and confirm the app still renders before the next. No big-bang refactor.
- **Always paginate** hot lists (default page size 20-50). Keyset/cursor on ranking; offset only for admin/low-traffic. See the `db-performance` skill.
- **Map fields to the real schema** — the prototype's `reviews` count is `review_count`, `price` is `price_range`, `badge` maps to `tier`, the business key is `slug`. Read `supabase/migrations/20260601000001_core_schema.sql` for exact column names.
- **Verify after each step:** `npm run dev` renders unchanged; `npm run build` + `npm run lint` pass.

## lib/supabase.js (step 1 pattern)
```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev; only these two public vars belong client-side.
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);
```
The Ask Karibu call (step 5) then becomes — note: no API key in the browser:
```js
const { data, error } = await supabase.functions.invoke('ask-karibu', {
  body: { citySlug, messages },
});
```

## hooks/useBusinesses.js (step 3 pattern — paginated)
Keyset pagination on `ranking_score` using the `idx_businesses_active_rank_id` index. Never fetch unbounded.
```js
// src/hooks/useBusinesses.js
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 20;

export function useBusinesses({ categorySlug, citySlug } = {}) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);   // last ranking_score seen
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);

    let q = supabase
      .from('businesses')
      .select('id, slug, name, hood, rating, review_count, price_range, tier, tags, hero_image_url, ranking_score')
      .eq('status', 'active')                     // RLS also enforces this
      .order('ranking_score', { ascending: false })
      .order('id', { ascending: false })          // tiebreaker for stable keyset
      .limit(PAGE_SIZE);

    if (categorySlug) {
      // category_id resolved from the cities/categories Context, or a joined view
      q = q.eq('category_id', /* id from context */ undefined);
    }
    if (cursor !== null) q = q.lt('ranking_score', cursor);   // keyset, not offset

    const { data, error } = await q;
    setLoading(false);
    if (error) return;                            // surface via your existing error UI
    if (!data.length) { setDone(true); return; }
    setItems((prev) => [...prev, ...data]);
    setCursor(data[data.length - 1].ranking_score);
    if (data.length < PAGE_SIZE) setDone(true);
  }, [categorySlug, citySlug, cursor, done, loading]);

  return { items, loadMore, loading, done };
}
```
Map these rows into the **existing** card components without changing their markup: the prototype `reviews` prop reads from `review_count`, `price` from `price_range`, the badge from `tier`.

## BusinessScreen by slug (step 4)
```js
const { data: business } = await supabase
  .from('businesses').select('*').eq('slug', slug).eq('status', 'active').maybeSingle();
const { data: reviews } = await supabase
  .from('reviews')
  .select('id, reviewer_name, reviewer_country, rating, body, created_at')
  .eq('business_id', business.id).eq('status', 'published')
  .order('created_at', { ascending: false }).limit(20);
```

## Common mistakes
- Restyling or "tidying" markup while migrating data — out of scope, breaks the design.
- Bulk-splitting `KaribuApp.jsx` instead of one-screen-at-a-time.
- `select('*')` on an unbounded list, or offset pagination on a hot list.
- Leaving the Anthropic `fetch` for last — it leaks the key; swap it early.
- Mapping to prototype field names (`reviews`, `price`, `badge`) instead of schema names (`review_count`, `price_range`, `tier`).
- Putting any secret other than the two public Supabase values in `VITE_*`.

## Checklist
- [ ] Followed the strict order (client -> context -> useBusinesses -> BusinessScreen -> ask-karibu swap -> submit-review).
- [ ] The Anthropic `fetch` is replaced with `functions.invoke('ask-karibu')` (key no longer client-side).
- [ ] Lists are paginated (keyset, page size 20-50); no `select('*')` on unbounded tables.
- [ ] No restyling; no bulk split; one screen extracted at a time if at all.
- [ ] Fields mapped to real schema columns.
- [ ] `npm run dev` renders unchanged; `npm run build` + `npm run lint` pass.
