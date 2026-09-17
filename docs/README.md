# Project docs

Home for **repo-level Markdown that isn't front- or back-specific** — anything that spans both
apps or belongs to the project as a whole. Put it here instead of at the repo root (keep the root
clean) or inside `front/` / `back/` (those hold code conventions only).

## Start here

| File | Read it for |
| --- | --- |
| **[STATUS.md](STATUS.md)** | Where the project stands: done, blocked, next. One page. |
| [decisions.md](decisions.md) | Why things are the way they are (D1–D9). Newest at the bottom. |
| [payments.md](payments.md) | How payments work: personal GCash, recording references, GCash Check. |
| [runbooks.md](runbooks.md) | What to do when something goes wrong. |
| [vendor-transcripts/](vendor-transcripts/) | Real OLT command output the drivers were written against. |
| [archive/](archive/) | Finished migration docs and parked designs. History only. |

When something moves, update **STATUS.md**. Record a new owner decision in **decisions.md**.
Prefer updating an existing page over adding a new one.

## What lives here

- **Plans** — implementation plans, design proposals, RFCs, migration strategies.
- **Checklists** — release/QA checklists, setup runbooks, review checklists.
- **Notes** — meeting notes, decisions/ADRs, research, TODO scratchpads.
- Any other cross-cutting `.md` that has no natural home in `front/` or `back/`.

## What does NOT belong here

- **Coding conventions** for the client → the
  [`frontend-conventions`](../.claude/skills/frontend-conventions/SKILL.md) skill's `references/`.
- **Coding conventions** for the API → the
  [`backend-conventions`](../.claude/skills/backend-conventions/SKILL.md) skill's `references/`.
- The **high-level project map** → [`README.md`](../README.md) and [`CLAUDE.md`](../CLAUDE.md) at
  the root.

## Conventions

- One topic per file; name files in `kebab-case.md` (e.g. `stripe-billing-plan.md`,
  `v2-release-checklist.md`).
- Group by kind with a subfolder once a category grows (e.g. `docs/plans/`, `docs/checklists/`).
- Date-stamp anything time-bound in the file (e.g. a `Created: 2026-07-25` line) so stale plans
  are easy to spot.
