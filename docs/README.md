# Project docs

Home for **repo-level Markdown that isn't front- or back-specific** — anything that spans both
apps or belongs to the project as a whole. Put it here instead of at the repo root (keep the root
clean) or inside `front/` / `back/` (those hold code conventions only).

## What lives here

- **Plans** — implementation plans, design proposals, RFCs, migration strategies.
- **Checklists** — release/QA checklists, setup runbooks, review checklists.
- **Notes** — meeting notes, decisions/ADRs, research, TODO scratchpads.
- Any other cross-cutting `.md` that has no natural home in `front/` or `back/`.

## What does NOT belong here

- **Coding conventions** for the client → [`front/docs/`](../front/docs/) (imported by
  [`front/CLAUDE.md`](../front/CLAUDE.md)).
- **Coding conventions** for the API → [`back/docs/`](../back/docs/) (imported by
  [`back/CLAUDE.md`](../back/CLAUDE.md)).
- The **high-level project map** → [`README.md`](../README.md) and [`CLAUDE.md`](../CLAUDE.md) at
  the root.

## Conventions

- One topic per file; name files in `kebab-case.md` (e.g. `stripe-billing-plan.md`,
  `v2-release-checklist.md`).
- Group by kind with a subfolder once a category grows (e.g. `docs/plans/`, `docs/checklists/`).
- Date-stamp anything time-bound in the file (e.g. a `Created: 2026-07-25` line) so stale plans
  are easy to spot.
