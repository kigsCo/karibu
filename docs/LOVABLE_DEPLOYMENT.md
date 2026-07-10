# Lovable Deployment

The full Lovable deployment and QA guide is distributed as a formatted document rather than inline here — it's designed to be readable as a standalone PDF that developers and testers can keep open in a second tab.

**Get the full guide:** `karibu-lovable-guide.pdf` (distributed separately by the Kigs Apex team).

## Quick reference

Short version for someone who just needs to remember the key steps:

1. **Get code into Lovable** — see `GITHUB_PUBLISHING.md`, Path A.
2. **Connect Supabase** — click the green Supabase button in your Lovable project, authorize, pick or create a project.
3. **Add the Anthropic API key as a secret** in Lovable's Cloud → Secrets tab. Name it `ANTHROPIC_API_KEY`.
4. **Create the edge function** for Ask Karibu AI. Use the prompt in the full deployment guide — it's long, copy it exactly.
5. **Update the frontend** to call `supabase.functions.invoke("ask-karibu", ...)` instead of calling Anthropic directly.
6. **Share the preview URL** with testers.

## Required secrets

| Location | Key | Purpose |
|---|---|---|
| Supabase Edge Function Secrets | `ANTHROPIC_API_KEY` | Ask Karibu AI |
| Vercel/Netlify env (production) | `VITE_SUPABASE_URL` | Frontend → Supabase |
| Vercel/Netlify env (production) | `VITE_SUPABASE_ANON_KEY` | Frontend → Supabase |

Never put `ANTHROPIC_API_KEY` in Vite env (`VITE_*`). It would end up in the frontend bundle.

## Supabase tables

See the full guide for the complete schema. Core tables:

- `businesses` — directory of salons, restaurants, rides, etc.
- `reviews` — user-submitted reviews with moderation flag
- `guides` — editorial articles

All tables should have Row Level Security enabled with policies detailed in the full guide.
