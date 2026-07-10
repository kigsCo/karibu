# Quickstart

You've just unzipped the Karibu repo. Here's the fastest path to seeing it live.

## Run it locally (2 minutes)

You need Node.js 18 or later installed.

```bash
cd karibu-repo
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. You should see the prototype.

## Push it to GitHub (5 minutes)

The repo is already initialized as a Git repository with one commit. To publish it to your GitHub:

1. Create a new empty repository at [github.com/new](https://github.com/new). Name it `karibu` (or whatever you like). **Do not** initialize it with a README, .gitignore, or license.

2. Connect this local repo to it:
   ```bash
   cd karibu-repo
   git remote add origin git@github.com:YOUR-USERNAME/karibu.git
   git push -u origin main
   ```

3. Refresh GitHub. Your repo is now public (or private, your choice in step 1).

## Deploy it for QA (10 minutes)

Now follow `docs/GITHUB_PUBLISHING.md` to deploy:

- **Path A — Lovable** if you want AI-assisted iterative editing
- **Path B — Vercel** if you just want a stable URL to share with testers

Both paths give you a live URL on a real phone within 10 minutes.

## What's next

Read `README.md` for the full project overview and `docs/LOVABLE_DEPLOYMENT.md` for the Supabase + Anthropic API integration steps.
