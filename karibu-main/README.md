# Karibu

> A local guide, for newcomers.

Karibu is a services-discovery app for tourists, expats, and newcomers to Kenya — built to answer the questions every visitor asks in their first week: *Where can I get my nails done? Which restaurant won't disappoint? Is this neighbourhood safe after dark? How does M-Pesa actually work?*

This repository contains the React frontend prototype, editorial guide content, and the structure for the merchant dashboard. Backend (Supabase), auth, and AI search integration are wired in Lovable — see `docs/LOVABLE_DEPLOYMENT.md`.

## What's in the app

- **Service discovery** across 12 categories — salons, restaurants, rides, cafés, pharmacies, gyms, and more — in Nairobi, Mombasa, Naivasha, Kisumu, and Nakuru.
- **Karibu Recommended** — a verified-businesses tier driven by reviews, not advertising spend.
- **Review system** with star ratings, country-tagged reviewers, service tags, and a rating-distribution view. Low-rated businesses enter a 60-day improvement window before being unlisted.
- **Ask Karibu AI** — a conversational assistant that only recommends verified businesses from the real directory.
- **Editorial guides library** — long-form pieces on staying safe, choosing neighbourhoods, using M-Pesa, transport, culture, and health.
- **Merchant dashboard** — rating trends, category rank, activity metrics, review theme extraction, and subscription status.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Icons | lucide-react |
| Typography | Instrument Serif (display), Plus Jakarta Sans (body) |
| Backend (planned) | Supabase — Postgres, Auth, Edge Functions |
| AI | Anthropic Claude Sonnet 4.6, proxied via Supabase Edge Functions |
| Deployment | Lovable (preview), Vercel or Netlify (production) |

## Getting started

Requires Node.js 18+ and npm (or pnpm / bun).

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

Open `http://localhost:5173` to see the app.

### Environment variables

Copy the template and fill in your own values once you've connected Supabase:

```bash
cp .env.example .env
```

The Anthropic API key is **never** placed in frontend env vars. It lives only in Supabase's secret manager and is read by the `ask-karibu` Edge Function. See the deployment guide for details.

## Project structure

```
karibu/
├── public/                  Static assets (icon, OG images)
├── src/
│   ├── App.jsx              Top-level route wrapper
│   ├── KaribuApp.jsx        Main prototype (single component for now)
│   ├── main.jsx             Entry point
│   ├── index.css            Tailwind + brand utility classes
│   ├── components/          (Reserved — Lovable will populate as the
│   │                         prototype is split into smaller pieces)
│   ├── pages/               (Reserved — future route-based pages)
│   ├── data/                (Reserved — seed data for businesses/guides)
│   ├── lib/                 (Reserved — Supabase client, API helpers)
│   └── hooks/               (Reserved — custom React hooks)
├── docs/
│   ├── LOVABLE_DEPLOYMENT.md    How to deploy via Lovable for QA
│   ├── BUSINESS_OWNER_GUIDE.md  Partner-facing preview guide
│   └── GITHUB_PUBLISHING.md     Publishing paths (this doc matters)
├── tailwind.config.js
├── vite.config.js
└── package.json
```

The prototype is currently a single 2,900-line component in `KaribuApp.jsx`. This is intentional for the first push — it keeps the prototype stable while you set up Lovable, and lets you split it into proper pages/components iteratively once connected. **Don't split it manually before pushing** — Lovable's agent does this well when you ask it to, and pre-splitting increases the chance of breaking something.

## Design system

The prototype uses a warm editorial palette:

| Token | Value | Usage |
|---|---|---|
| Clay | `#B8472E` | Primary action, accents |
| Forest | `#2A3D2B` | Trust signals, secondary |
| Ochre | `#D4A341` | Recommended badge, AI features |
| Ivory | `#F7F1E8` | Background |
| Ink | `#1C1613` | Body text |

All colors are in `tailwind.config.js` and mirrored as utility classes in `src/index.css`.

## Deployment paths

Two supported paths depending on what you need:

**Preview for QA and partner testing → Lovable.** See `docs/LOVABLE_DEPLOYMENT.md`. You get an AI-assisted editing environment, preview URLs, and the simplest path to wire up Supabase.

**Production → Vercel or Netlify.** One click from this repo. Set environment variables in the dashboard, point your custom domain at the deployment, and you're live.

See `docs/GITHUB_PUBLISHING.md` for the full walkthrough of each.

## Contributing

Karibu is a product of [Kigs Apex Solutions](https://kigsapexsolutions.com), based in Nairobi. The prototype is intentionally opinionated about design, tone of voice, and business model — contributions are welcome but best discussed in an issue first.

## License

All rights reserved. This is a commercial product in active development. The code, design, editorial content, and brand are property of Kigs Apex Solutions. If you're interested in partnering, licensing, or using Karibu's infrastructure for a similar product in another region, reach out: partners@karibu.co.ke.

---

**Karibu sana.** Welcome.
