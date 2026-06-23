# Karibu Dev Toolkit — `karibu-dev`

A distributable Claude Code plugin that bundles the skills, agents, and slash commands for building the **Karibu** backend on Supabase (Postgres + RLS + Edge Functions, M-Pesa, Resend, and the "Ask Karibu" Claude proxy). Karibu is a services-discovery app for tourists, expats, and newcomers to Kenya, built by Kigs Apex Solutions.

## What's in the plugin

**Skills** (`skills/`) — invoked by name when their trigger matches:

| Skill | Use when |
|---|---|
| `supabase-migration` | creating/altering schema; writing a numbered migration |
| `rls-policy` | adding or auditing row-level security |
| `edge-function` | scaffolding a Deno edge function (CORS, auth, error shape, `verify_jwt`) |
| `seed-data` | (re)generating `seed.sql` from the prototype constants |
| `ranking-algorithm` | implementing/altering `calculate-rankings` and `ranking_score` |
| `review-moderation` | the `moderate-reviews` Claude classification pipeline |
| `mpesa-integration` | M-Pesa Daraja STK push + callback |
| `frontend-data-migration` | replacing a static constant with a live Supabase query |
| `db-performance` | indexing, caching, pagination, async, OLAP decisions |

**Agents** (`agents/`) — delegate focused work:

- `migration-author` — writes/edits numbered migrations; enforces RLS + indexes per table; never edits a shipped migration.
- `edge-fn-builder` — scaffolds/edits Deno edge functions using the `_shared` helpers; handles CORS/validation/secrets/JSON-shape; registers `verify_jwt` in `config.toml`; keeps heavy work on cron.
- `db-reviewer` — read-mostly reviewer that audits a diff/branch against the performance + security checklist (indexing, keyset pagination, no live aggregation, RLS on new tables, no secrets in the frontend, N+1 risks) and returns findings by severity.
- `frontend-migrator` — migrates a static constant to a live Supabase query without restyling, never bulk-splitting `KaribuApp.jsx`, always paginating, and verifying the app still builds.

**Commands** (`commands/`):

- `/new-migration <migration_name>` — create a numbered migration with RLS + indexes; push to staging first.
- `/new-edge-function <function-name>` — scaffold `functions/<name>` with the `_shared` helpers and register it in `config.toml`.
- `/db-review [branch-or-diff]` — run the `db-reviewer` checklist over the current changes.
- `/seed-refresh` — regenerate `supabase/seed.sql` from the prototype constants.
- `/sprint-status` — summarize sprint progress vs the goal, with next steps and blockers.

> Components live at the plugin root in `skills/`, `agents/`, and `commands/` (Claude Code's default locations), so `plugin.json` needs no path fields. They are copied into the plugin during packaging.

## Install from this marketplace

From the repo root, add the marketplace and install the plugin:

```text
/plugin marketplace add ./tools/karibu-dev-marketplace
/plugin install karibu-dev@karibu-dev-marketplace
```

## Already active repo-wide

You don't need to install the plugin to use these inside the Karibu repo itself. The **same** skills, agents, and commands are already active project-wide via `.claude/` (`.claude/skills/`, `.claude/agents/`, `.claude/commands/`) and `.claude/settings.json`. The plugin exists to share that toolkit with other repos or teammates; inside Karibu it is redundant with the committed `.claude/` config.

## MCP / environment variables (`.mcp.json`)

The repo's `.mcp.json` registers the read-only **Supabase MCP server**. JSON cannot hold comments, so the configuration is documented here:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=YOUR_PROJECT_REF"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

Two things must be set before the server will connect:

- **`--project-ref=YOUR_PROJECT_REF`** — replace `YOUR_PROJECT_REF` with your Supabase project ref (the ID in the dashboard URL `app.supabase.com/project/<ref>`). Point it at **staging** for day-to-day work, not production.
- **`SUPABASE_ACCESS_TOKEN`** — a Supabase Personal Access Token, created at **Account → Access Tokens** in the Supabase dashboard. Export it in your shell (e.g. `export SUPABASE_ACCESS_TOKEN=sbp_...`) so the `${SUPABASE_ACCESS_TOKEN}` placeholder resolves; never commit the token. It is a secret, like the `ANTHROPIC_API_KEY` / `MPESA_*` / `RESEND_API_KEY` values that live in the Supabase secret store, not in code.

The server runs with `--read-only`, so it can inspect schema and data but cannot mutate the database — schema changes still go through numbered migrations (`/new-migration`).

## License

UNLICENSED — © Kigs Apex Solutions. Internal tooling for the Karibu project.
