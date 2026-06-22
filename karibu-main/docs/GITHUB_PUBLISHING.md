# Publishing Karibu through GitHub

Two paths, pick the one that fits your need.

## Path A: GitHub → Lovable (for QA and iterative development)

Lovable cannot import a pre-existing repository directly. The supported workaround is to create a throwaway Lovable project, connect it to a new empty GitHub repo via Lovable's GitHub integration, then push your real code to that repo — Lovable picks up the code on the next sync.

### Steps

1. **Create the empty GitHub repo.**
   - Go to [github.com/new](https://github.com/new)
   - Name: `karibu` (or `karibu-app`, your call)
   - Set to **Private** initially. You can flip to public later.
   - **Don't** initialize with a README, .gitignore, or license — we want a truly empty repo. Lovable's starter will go in first.

2. **Create a throwaway Lovable project.**
   - Go to [lovable.dev](https://lovable.dev), click "Build something."
   - Prompt it with anything simple, like "A landing page for a coffee shop."
   - Wait ~30 seconds for the generation.

3. **Connect the Lovable project to your GitHub repo.**
   - In your Lovable project, click the GitHub icon (top-right) or go to **Settings → Connectors → GitHub**.
   - Authorize Lovable with GitHub.
   - Select your `karibu` repo.
   - Lovable pushes its starter code to the repo. The repo now has a working Vite/React/Tailwind/Lovable-compatible structure.

4. **Overwrite the starter with this Karibu code.**
   - Clone your repo locally:
     ```bash
     git clone git@github.com:YOUR-USERNAME/karibu.git
     cd karibu
     ```
   - Pull the Lovable starter that's already there — note the `.git` folder is the Lovable-connected one:
     ```bash
     git pull
     ```
   - Copy the Karibu files from this repository into your local clone, **except** for `.git/`. You want to keep Lovable's Git connection.
     ```bash
     # From the directory containing the karibu-repo folder:
     cp -r karibu-repo/* karibu/
     cp -r karibu-repo/.github karibu/.github
     cp karibu-repo/.gitignore karibu/.gitignore
     cp karibu-repo/.env.example karibu/.env.example
     cp karibu-repo/.eslintrc.cjs karibu/.eslintrc.cjs
     ```
   - Commit and push:
     ```bash
     cd karibu
     git add .
     git commit -m "Replace starter with Karibu prototype"
     git push origin main
     ```

5. **Refresh Lovable.**
   - Go back to your Lovable project. It'll pick up the new code automatically within a minute or two.
   - The first preview may look broken — ask Lovable in chat to **"install missing dependencies and run the dev server."** It will run `npm install` and reload.
   - From here, you can edit via Lovable's chat interface. Every change syncs back to GitHub.

### Why this workaround exists

Lovable is designed around its own project model and doesn't yet let you import an arbitrary GitHub repo as the starting point. The throwaway-project trick gives you the Git connection without having to use Lovable's starter code.

---

## Path B: GitHub → Vercel (for production, simpler, no AI editing)

If you just want a real deployed URL with a custom domain — no Lovable involvement — this is the faster path.

### Steps

1. **Push the repo to GitHub.**
   From inside the `karibu-repo/` directory on your machine:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Karibu prototype"
   git branch -M main
   git remote add origin git@github.com:YOUR-USERNAME/karibu.git
   git push -u origin main
   ```
   (Create the empty repo at github.com/new first, don't initialize it with anything.)

2. **Import into Vercel.**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository," authorize if needed, select `karibu`.
   - Vercel auto-detects Vite. Defaults are correct: `npm run build`, output `dist`.
   - Click Deploy.

3. **You get a URL.**
   - Something like `karibu-xyz123.vercel.app`. Works on any phone. Share this on WhatsApp with business owners.

4. **Add a custom domain** (optional, when ready).
   - In Vercel project settings → Domains, add `karibu.co.ke` (or your chosen domain).
   - Vercel gives you DNS records. Add them at your domain registrar (Squarespace, Namecheap, whoever). SSL is automatic.

### Environment variables in Vercel

When you wire up Supabase later, add these in Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase public anon key

The Anthropic API key never goes here. It belongs only in the Supabase Edge Function secrets.

---

## Which path do I pick?

| | Path A (Lovable) | Path B (Vercel) |
|---|---|---|
| Public URL for QA | ✅ | ✅ |
| AI-assisted editing via chat | ✅ | ❌ |
| Custom domain | ✅ (paid plan) | ✅ (free) |
| Supabase integration | ✅ (one-click) | Manual |
| Cost for QA stage | Free | Free |
| Cost at production | Paid plan | Free tier fine for low traffic |

Most teams do **both**: Path A during QA and iteration, Path B once things are stable and you want the cheapest, fastest production hosting. Lovable makes it easy to export to GitHub at any point, so you're not locked in.

---

## Branch strategy for ongoing work

Once the repo is pushed, use normal feature-branch workflow:

```bash
# Start a new feature
git checkout -b feature/mombasa-listings

# Make changes (locally or in Lovable)
# Lovable creates branches automatically if you ask it to

# Push the branch
git push origin feature/mombasa-listings

# Open a pull request on GitHub, merge to main when ready
```

For the QA phase specifically, we recommend:

- `main` — always deployable, what testers see
- `dev` — integration branch for in-progress features
- `feature/*` — individual tickets, merged into `dev` first

This keeps Lovable iterating on a stable `main` while your development happens elsewhere.
