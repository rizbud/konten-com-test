# ClipPay take-home (fullstack)

Build the **review & approve** slice of a platform that pays creators per video
view. Full brief: [SOAL.md](SOAL.md) (Indonesian). It is real money in the real
product — correctness beats feature count.

Domain language: [CONTEXT.md](CONTEXT.md). Decisions already made:
[docs/adr/](docs/adr/) — read those before re-arguing one.

## Scope

1. `GET /api/submissions` — pagination, filter by `status` and `campaignId`,
   search by creator username, response includes total row count.
2. `POST /api/submissions/:id/approve` — compute earning, decrement
   `campaigns.remaining_budget`, insert into `earnings`, flip status.
   Budget must never go negative; no double payment; safe under double-click and
   two concurrent admins.
3. `/review` page — table, filters, pagination, per-row Approve, with
   loading / empty / error states handled.

Bonus (optional, only if the required part is clean): money-calc tests,
`GET /api/campaigns/:id/summary`, and the views-decay answer written in the README.

## Stack

Next.js 16 App Router (React 19) + TypeScript · Drizzle ORM
(`drizzle-orm/node-postgres`) · PostgreSQL · Tailwind v4 · Vitest + React
Testing Library.

Next 16 differs from what you remember — read the relevant guide under
`node_modules/next/dist/docs/01-app/` before writing app code, per
[AGENTS.md](AGENTS.md).

Code lives in `src/`, imported as `@/*`. Route handlers in
`src/app/api/**/route.ts`, the page in `src/app/review/page.tsx`, DB in
`src/db/`.

Server components for data fetching, client components only for interactivity.
Drizzle is used against the **existing** `schema.sql` — model it in
`src/db/schema.ts` and do not generate migrations that recreate those tables.
New indexes go in a separate small SQL migration file so they are reviewable.

## Setup

```bash
docker compose up -d
psql "postgresql://clippay:clippay@localhost:5433/clippay" -f schema.sql
```

`DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay` in `.env`.

Scaffolded by `create-next-app`; Drizzle, `pg`, and Vitest are not installed
yet — add them when the first code needs them, and add the `test` script then.

```bash
npm run dev
npm test
npm run lint
```

## Conventions

- Money and views are integers throughout. No floats, no `Number` on a bigint
  string without an explicit conversion.
- Query params validated at the route boundary; invalid input → 400, never a
  driver 500.
- Honest TypeScript: no `any`, no `as` to silence a real mismatch. No dead code,
  no commented-out blocks, no scaffolding "for later".
- Every non-obvious technical decision goes in the README with the *why*, plus
  what was cut for time. That file is graded as heavily as the code.
- Follow the project skills below rather than re-deriving their rules.

## Skills

All project-scoped in `.claude/skills/` (nothing installed globally). The
third-party ones came from [skills.sh](https://skills.sh) via `npx skills add`
and are pinned in [skills-lock.json](skills-lock.json).

Written for this take-home — these two carry the graded rules:

| Skill | Use for |
|---|---|
| [money-approve](.claude/skills/money-approve/SKILL.md) | earning math, fee/rounding, the approve transaction, budget guard, double-pay guard |
| [submissions-query](.claude/skills/submissions-query/SKILL.md) | `GET /api/submissions`, DB-side pagination, filters/search, indexes, campaign summary, `/review` server/client split |

Stack references:

| Skill | Use for |
|---|---|
| [nextjs-app-router-patterns](.claude/skills/nextjs-app-router-patterns/SKILL.md) | App Router, server vs client components, data fetching, streaming |
| [next-best-practices](.claude/skills/next-best-practices/SKILL.md) | Next.js file conventions, RSC boundaries, async APIs, route handlers |
| [vercel-react-best-practices](.claude/skills/vercel-react-best-practices/SKILL.md) | React/Next performance: re-renders, data fetching, bundle size |
| [vercel-composition-patterns](.claude/skills/vercel-composition-patterns/SKILL.md) | component API design when a component grows boolean props |
| [drizzle-orm-patterns](.claude/skills/drizzle-orm-patterns/SKILL.md) | schema definition, queries, transactions, migrations |
| [postgresql-optimization](.claude/skills/postgresql-optimization/SKILL.md) | query plans, indexing, Postgres-specific features |
| [vitest](.claude/skills/vitest/SKILL.md) | unit tests, mocking, config |
| [react-testing-library](.claude/skills/react-testing-library/SKILL.md) | component tests, role/label queries, async utilities |
| [next-dev-loop](.claude/skills/next-dev-loop/SKILL.md) | verifying a change in a running `next dev`, not just that it compiles |
| [webapp-testing](.claude/skills/webapp-testing/SKILL.md) | driving the app in a real browser (Playwright) when a runtime bug needs reproducing |

UI — low priority, the brief does not grade CSS. Reach for these only once the
required slice is done:

| Skill | Use for |
|---|---|
| [tailwind-css-patterns](.claude/skills/tailwind-css-patterns/SKILL.md) | utility-first styling |
| [tailwind-design-system](.claude/skills/tailwind-design-system/SKILL.md) | Tailwind v4 tokens, component variants |
| [ui-design](.claude/skills/ui-design/SKILL.md) | layout and interface decisions for the `/review` table |
| [anti-ui-slop](.claude/skills/anti-ui-slop/SKILL.md) | pre-ship UI check: required states covered, nothing generic |
| [frontend-design](.claude/skills/frontend-design/SKILL.md) | visual direction if the page gets styled beyond plain |

`drizzle` is also vendored but is model-invocation-disabled — prefer
`drizzle-orm-patterns`.

Re-install after a fresh clone:

```bash
npx skills experimental_install
```
