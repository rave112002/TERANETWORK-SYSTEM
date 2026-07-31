# Backend — (Node + Express + MySQL)

## ⚠️ Before writing any code in `back/server` or `back/database`, load the `backend-conventions` skill

The conventions are **non-negotiable** and live in that skill's `references/`
([`.claude/skills/backend-conventions/`](../.claude/skills/backend-conventions/SKILL.md)) — six
topic docs covering the authenticated `req.user` context and tenant scoping, query/transaction
patterns, schema and ID conventions, validators, permission gating, and upload paths. The skill's
table says which one to read for the area you're touching. Read it **before** writing, not after.

Building a whole new CRUD module? Use the **`new-module`** skill instead — it drives this one plus
the frontend half in the right order.

## Stack

Node + Express · MySQL via a custom `Database` class wrapping `mysql2/promise` (`server/config/database.js`,
injected as `req.db`) · Passport JWT auth · Zod validators · multi-tenant scoping by `companyId`/`branchId`.

Reference implementation: `server/src/controllers/v1/admin/roles.controller.js`.
