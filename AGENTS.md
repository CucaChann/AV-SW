# AV-SW: rules for AI agents

This file is the shared brief for every AI agent working in this repository:
Claude (Claude Code) and ChatGPT (Codex). `CLAUDE.md` imports this file, so the
rules live in one place. Change them here only.

## What we are building

AV-SW is a desktop-first design tool for luxury residential AV, lighting,
networking, shading and control (Lutron, Savant, Ubiquiti, Sonance, Leon, DMF,
QTL). The design is the source of truth; BOMs, schedules and quotes come from it.
Read `docs/VISION.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before large
changes, and `docs/PRODUCT-LIBRARY.md` before touching product data.

Stack: Tauri 2 desktop shell, React 19 + TypeScript + Vite, pdf.js and
dxf-parser for drawings, SQLite (via Tauri) for local storage, zod for library
validation, vitest for tests.

## Commands

```bash
npm ci                    # install exactly what package-lock.json pins
npm run dev               # browser dev mode, http://localhost:5173
npm run check             # typecheck + tests + production build (run before every PR)
npm run validate:library  # product library schema and integrity checks
npm run desktop:dev       # desktop app (needs Rust; on Windows also MSVC build tools)
```

## Hard rules

1. **Never invent product data.** Every spec, compatibility claim, alternative
   and rule parameter must cite a source that was actually read. If you can't
   find a value, leave it out and say so in `review.notes`. Excerpts are copied
   verbatim, never paraphrased.
2. **AI agents only propose.** Library records you add or change get
   `review.status: "proposed"` and `proposedBy` set to your agent name
   (`"claude"` or `"chatgpt"`). Never set `"verified"`; only a person does that.
3. **Rules own compatibility and capacity.** Checks such as derating, PSU sizing,
   PoE budgets and load limits are deterministic code in `src/library/rules/` or
   `src/lib/`, with tests, reading library data. Don't hard-code product facts in
   components, and don't let generated text decide pass/fail.
4. **This repository is public.** No client names, addresses, floorplans, quotes
   or photos. No API keys or secrets. No dealer pricing or dealer-portal
   documents unless the owner confirms the dealer agreement allows it.
5. **Keep the build green.** `npm run check` must pass before you open a PR.
   Every calculation or rule change comes with tests. Never skip or delete a
   test to get green.
6. **Dependencies change on purpose only.** Use `npm install <pkg>@<version>`
   so `package-lock.json` updates; never hand-edit lockfiles. Say why in the PR.
   Tauri JS packages and Rust crates must stay on matching minor versions.

## How Claude and ChatGPT work together

- **One task, one branch, one PR.** Claude uses `claude/<topic>` branches,
  ChatGPT uses `codex/<topic>`, people use `feature/<topic>`. Branch from `main`.
- **Never push to `main`** or to another agent's branch, and never force-push a
  branch you didn't create. To change someone else's PR, comment on it or open a
  follow-up PR.
- **Cross-review.** Claude reviews ChatGPT's PRs and ChatGPT reviews Claude's,
  when the owner asks. The repository owner approves and merges. No agent merges
  its own PR.
- **Pick up work from GitHub issues** where possible, and link the issue in the
  PR, so two agents don't build the same thing.
- **Hand-off notes.** Every PR description says what changed, what was verified
  and how, what is still unverified or `proposed`, and what should happen next
  (`.github/pull_request_template.md`).
- **Small PRs.** Prefer several focused PRs over one large one. A reviewer should
  be able to read the whole diff.

## Code layout and conventions

| Path | Contents |
| --- | --- |
| `src/components/` | React UI. Presentational; no product facts or rule math |
| `src/lib/` | Project/design logic (drawings, BOM, builders). Pure functions where possible |
| `src/library/` | Product library schema, validation, rule engines |
| `data/library/` | Product library data (JSON), one file per manufacturer |
| `src-tauri/` | Desktop shell (Rust), SQLite migrations |
| `docs/` | Product and architecture docs |

- TypeScript `strict`; no `any` in new code.
- Function components and hooks. Keep domain logic out of components so it can be tested.
- Tests sit next to the code as `*.test.ts`.
- Match the surrounding code's style; comment the why, not the what.
