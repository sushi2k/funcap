# CLAUDE.md

Guidance for Claude Code working in the Funcap repository. Read this first — it is the entry point to the three specification documents and the rules that bind all work here. Keep it loaded; defer to the linked docs for detail.

## What Funcap is

A trust-based community web app for self-reported singles tennis across recurring 3-month tournaments: players enter and approve match scores, results lock on agreement, admins resolve disputes, and a public scoreboard shows season standings (points) and career rankings (win %). Local-first, offline, a single Next.js process over a SQLite file.

## Project status

Specifications are complete; implementation has not started. Build against the three documents below. When you scaffold the project, make the commands in [Commands](#commands) real.

## Source of truth (read in this order)

- **`requirements.md`** — *what* the product does (behaviour, data model, API surface §15, resolved decisions §17, security requirements §18). Authoritative on behaviour.
- **`architecture.md`** — *how* it is structured (layers, the DAL, data flow, the request/security pipeline §9). Authoritative on structure.
- **`security.md`** — the enforceable security **guard rails** both must respect (41 rails, severities, enforcement §6, secure-default values §3, per-change checklist §5). Binding.

**Precedence on conflict:** `security.md` (security) > `requirements.md` (behaviour) > `architecture.md` (structure). If anything in *this* file disagrees with those docs, the docs win — update this file.

## Golden rules (non-negotiable)

The spine of the system. Violating one is a defect, not a style choice. (IDs reference `security.md`.)

1. **Server is the only authority.** Never trust the client for authentication, authorization, validity, or outcomes. Client validation is UX only.
2. **All database access and secrets go through the `server-only` DAL** (`src/server/dal/**`). Nothing else imports `@prisma/client` or reads secret `process.env`. — DAL-1, SEC-1
3. **Authorize in the DAL on every request, keyed to the session identity** — ownership checks (IDOR), not just "is logged in". Middleware is **not** an authz boundary. — DAL-2/3
4. **Return DTOs, never raw rows.** `password_hash`/`totp_secret` never leave the DAL; `email` never reaches a guest/public response. — DAL-4
5. **Statistics are derived, never stored.** Standings and career are queries over confirmed official matches; do not add aggregate columns or materialize without an explicit decision. — arch A4
6. **The domain core is pure** (`src/domain/**`): no HTTP, Prisma, React, or secrets. The match (req §6.4) and tournament (req §5.2) state machines are the authority — reject out-of-order transitions server-side. — API-2
7. **Every privileged action writes an `AuditEvent` in the same transaction and requires MFA step-up.** A locked (`CONFIRMED`) result changes only via admin amend/void. — AUD-1/2, AUTH-4
8. **Offline invariant:** add no outbound/network/CDN/cloud/third-party runtime dependency. — DEP-2
9. **Validate all external input server-side** with shared Zod schemas (body, query, `[param]`, headers). — IN-1
10. **Never** use `$queryRawUnsafe`, `dangerouslySetInnerHTML`, a secret under `NEXT_PUBLIC_*`, or secrets/tokens in URLs. — IN-2/3, SEC-1, API-5

## Tech stack

Next.js (App Router) full-stack · TypeScript (strict) · Prisma + SQLite (local `funcap.db`) · Zod · argon2id · otplib (TOTP) · Tailwind · node-cron (in-process scheduler). Same-origin; no CORS.

## Commands

Intended npm scripts — create them to match when scaffolding.

```
npm run dev              # run the app on localhost
npm run build            # production build
npm start                # serve the production build
npm run lint             # eslint, incl. the security lint rules (security.md §6)
npm run typecheck        # tsc --noEmit
npm test                 # unit + integration + security suites
npx prisma migrate dev   # apply migrations, incl. the raw partial-index migration
npm run seed             # create the first admin (+ optional sample data)
```

Run `lint`, `typecheck`, and `test` before treating any change as done.

## Project layout

```
app/             # App Router: (public)/(auth)/(player)/(admin) pages + api/ route handlers (req §15)
middleware.ts    # headers/CSP, coarse gating, rate-limit entry — NOT authz
src/domain/      # pure logic: scoring, standings, career, tournament, matchmaking, match transitions
src/application/ # use-case services; own transactions
src/server/dal/  # 'server-only' Data Access Layer: Prisma + authz + DTOs (sole DB/secret access)
src/server/{auth,security,audit,config,scheduler}/
src/shared/      # Zod schemas + DTO types (shared client/server)
prisma/          # schema.prisma, migrations/ (raw partial-index), seed.ts
```

## How to build a feature (the path every change follows)

Thin entry point → service → DAL → domain.

1. Define or extend the Zod schema + DTO in `src/shared`.
2. Route handler (or Server Action): validate input, re-verify auth, then call the service. Keep it thin.
3. Service: orchestrate, own the transaction, call the domain for any rule, validation, or state transition.
4. DAL: enforce object-level authz, do the Prisma work, return a DTO. If the action is privileged, write the `AuditEvent` in the same transaction.
5. Tests: add the authz/IDOR, audit-emission, DTO-leakage, and validation/status-code cases (security.md §5/§6).

## Project gotchas

- **SQLite + Prisma:** no native enum or JSON type — store enums and the `sets` array as TEXT and validate with Zod; UUIDs/timestamps as TEXT. The one-match-per-pairing rule is a **partial unique index added via a raw migration** (Prisma can't express it).
- **Sessions** are server-side, persisted in SQLite; cookie is `httpOnly`+`Secure`+`SameSite=Lax`; rotate on login and privilege change. No JWT-in-JS, no auth state in browser storage.
- **Tournament state is derived from time** — don't add a mutable state column. Only the finalize side-effects run on a schedule, idempotent via `finalized_at`.
- **Match format default** is the full third set (`BEST_OF_3_FULL`); the 10-point super-tiebreak is a per-tournament option.
- **Mutations are POST/PATCH/DELETE with CSRF**, never a render side-effect. Same-origin, so no CORS.
- **Units/format:** metric; ISO-8601 UTC timestamps.
- **Production:** `NODE_ENV=production`, no stack traces to clients; TLS/HSTS + strict admin MFA before any shared deploy (the relaxations in security.md §7 are localhost-only).

## Style

Concise and technically precise. Match existing patterns; prefer the lean solution consistent with the docs. Do not add dependencies, layers, or abstractions the specifications do not call for. If a requirement and a guard rail seem to conflict, stop and flag it rather than guessing.