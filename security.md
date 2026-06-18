# Funcap — Security Guard Rails

Companion to **requirements.md v6** (§18 defines the security *requirements* — the what) and **architecture.md v2** (§9 defines the security *architecture* — the where). This document is the **guard rails**: the distilled, enforceable rules that keep any implementation — human or AI — inside the safe design. Each rail is concrete and checkable; §3 gives the secure-default values, §6 says how each rail is enforced.

## 0. How to read this document

- **Binding.** Guard rails are constraints, not suggestions. If a feature cannot be built without violating a rail, the feature changes — not the rail — unless a signed exception exists (§7).
- **Precedence.** On conflict: a guard rail (security) overrides convenience and overrides feature behaviour. requirements.md remains authoritative on *what the product does*; architecture.md on *structure*; this document on *the security boundaries both must respect*.
- **Severity.**
  - **[BLOCKING]** — CI/build fails or the change cannot merge. Mechanically prevented where possible.
  - **[REQUIRED]** — must hold; verified by an automated test and/or mandatory review.
  - **[RECOMMENDED]** — defense-in-depth; apply unless there is a documented reason not to.
- **Provenance.** These rails operationalize requirements §18 and architecture §9, and align with OWASP ASVS (L1 throughout, L2 for auth/session/access-control/admin), the OWASP REST Security Cheat Sheet, and the Next.js data-security guidance. Inline refs like `(req §18.5)` / `(arch §9.2)` point to the source.

## 1. Foundational rails

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| FND-1 | The **server is the only security boundary**. The client (React, URL, headers, hidden fields) is never trusted for authentication, authorization, validity, or pricing/score outcomes. `(req §18.1, arch §1)` | Architecture; review | [REQUIRED] |
| FND-2 | **Deny by default.** Every endpoint, action, and data read denies unless role *and* object-level ownership explicitly permit it. `(req §18.5)` | Test; review | [REQUIRED] |
| FND-3 | **Three trust tiers** only: GUEST (no account, read-only public scoreboard), PLAYER, ADMIN. Guests can never reach a state-changing path. `(req §2)` | Test; review | [BLOCKING] |
| FND-4 | **Least privilege.** ADMIN holds only the capabilities in the §2 matrix; no implicit super-powers; no shared accounts. `(req §18.1, §18.3)` | Review | [REQUIRED] |

## 2. Guard rails by domain

### 2.1 Data access & authorization (DAL)

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| DAL-1 | **No database/ORM access outside the `server-only` DAL** (`src/server/dal/**`). The Prisma client is imported nowhere else. `(arch §5, §8.2)` | `no-restricted-imports` lint banning `@prisma/client` outside the DAL; `import 'server-only'`; CI grep | [BLOCKING] |
| DAL-2 | **Object-level authorization in the DAL, keyed to the session identity, on every request** — never to a client-supplied ID. Ownership/relationship is checked (the IDOR defence), not just "is logged in". `(req §18.5, arch §9.2)` | Test (IDOR suite); review | [BLOCKING] |
| DAL-3 | **Middleware is not an authorization boundary.** It may do headers, CSP, redirects, and rate-limit entry only; authz is re-checked inside the handler/DAL. `(arch §5, §9)` | Review; test | [REQUIRED] |
| DAL-4 | **DTOs only across every boundary.** The DAL returns purpose-shaped DTOs, never raw rows/ORM objects. `password_hash` and `totp_secret` never leave the DAL; `email` never appears in any guest/public response. `(arch §8.2, §9.6)` | Test (DTO-leakage suite); typed DTOs; review | [BLOCKING] |
| DAL-5 | **No mass assignment.** Writes accept only an allow-listed field set. `role`, `status`, IDs, derived records, audit fields, and rating-like fields are never client-settable. `(req §18.5, arch §9.2)` | Zod input schemas; test; review | [BLOCKING] |
| DAL-6 | **One data path.** All reads and writes go through the DAL; component-level/ad-hoc DB queries are prohibited. `(arch §9.6, Next.js "pick one approach")` | Lint (DAL-1); review | [REQUIRED] |

### 2.2 Authentication

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| AUTH-1 | **Passwords hashed with argon2id** (params in §3); plaintext/reversible passwords are never stored or logged. `(req §18.2)` | Test; lint (ban weak hash APIs); review | [BLOCKING] |
| AUTH-2 | **NIST-aligned password policy**: min length 12, allow ≥ 64, screen against a bundled breached/common list; **no composition mandates, no periodic expiry, no security questions**. `(req §18.2)` | Zod + breached-list check; test | [REQUIRED] |
| AUTH-3 | **MFA (TOTP) is mandatory for ADMIN.** An admin without `mfa_enabled` cannot perform any sensitive action. `(req §18.3)` | Runtime guard; test | [BLOCKING] |
| AUTH-4 | **Step-up re-auth for every sensitive action** (resolve, amend, void, promote, reset-password, create-tournament) within the §3 window. `(req §18.3, arch §9.1)` | Middleware/guard on † routes; test | [BLOCKING] |
| AUTH-5 | **Login throttling + lockout + generic, timing-stable responses** that do not reveal whether an account exists. `(req §18.2)` | Rate limiter; test | [REQUIRED] |
| AUTH-6 | **Password reset is admin-assisted only** in v1 (temporary credential, `must_change_password`). No self-service reset path exists without email. `(req §3, §18.2)` | Absence of route; review | [REQUIRED] |

### 2.3 Sessions

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| SESS-1 | **Server-side sessions** persisted in SQLite; session IDs are high-entropy and opaque; **no auth/session state in JWT-in-JS or browser storage**. `(arch §9.1, A6)` | Architecture; lint (ban localStorage of auth); review | [BLOCKING] |
| SESS-2 | **Session cookie flags**: `HttpOnly`, `Secure`, `SameSite=Lax`, scoped `Path=/`, no domain widening. `(req §18.4)` | Central cookie config; test | [BLOCKING] |
| SESS-3 | **Rotate on login and on any privilege change; invalidate server-side on logout.** Idle + absolute timeouts apply (shorter for admin, §3). `(req §18.4)` | Session service; test | [REQUIRED] |

### 2.4 Sensitive actions & audit

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| AUD-1 | **A privileged change and its `AuditEvent` commit in the same transaction.** No code path mutates a result, role, or credential without an audit row. `(req §18.6, arch §8.4)` | Test (audit-emission suite); review | [BLOCKING] |
| AUD-2 | **A locked (`CONFIRMED`) result is changed only by an admin, only via amend/void, always audited and notified.** Players can never edit a confirmed match. `(req §6.6, §18.6)` | State-machine guard; test | [BLOCKING] |
| AUD-3 | **Audit log is append-only.** No application path updates or deletes `AuditEvent`. `(req §18.6)` | Repository contract; review | [REQUIRED] |

### 2.5 API / REST surface

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| API-1 | **HTTP method allowlist.** A route handler serves only its declared verbs; anything else returns `405`. `(arch §9.5, OWASP REST)` | Route handler shape; test | [REQUIRED] |
| API-2 | **Workflow state is validated server-side; out-of-order transitions are rejected.** The match (§6.4) and tournament (§5.2) state machines are the authority; the frontend never enforces sequencing. `(arch §7, §9.5, OWASP "out-of-order execution")` | Domain transition guards; test | [BLOCKING] |
| API-3 | **CSRF protection on every cookie-authenticated state-changing request** (double-submit token + `SameSite=Lax`). Server Actions, if used, rely on their built-in same-origin check. `(req §18.4, arch §9.3)` | CSRF middleware; test | [BLOCKING] |
| API-4 | **Content-Type + body-size limits.** Mutations require `Content-Type: application/json` (else `415`); bodies over the §3 limit return `413`. The API only produces `application/json`; `Accept` is never echoed into `Content-Type`. `(arch §9.5, OWASP REST + Flask DoS guidance carried over)` | Request guard; config; test | [REQUIRED] |
| API-5 | **No secrets in URLs/query strings**; resource IDs are non-sequential UUIDs. `(arch §8.1, §9.5)` | Review; schema | [REQUIRED] |
| API-6 | **Semantic status codes + generic errors.** Use `400/401/403/404/405/409/413/415/429/500` per meaning; never return stack traces or internal detail to the client. `(arch §9.5, §12)` | Error handler; test | [REQUIRED] |
| API-7 | **Same-origin; CORS disabled.** If a cross-origin API is ever exposed, use a strict origin allowlist — never `*` with credentials. `(arch §9.5)` | Config; review | [REQUIRED] |

### 2.6 Input validation & output encoding

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| IN-1 | **All external input validated server-side with shared Zod schemas** — body, query, `[param]` route segments, and relevant headers. Reject (do not coerce) unexpected/malformed input. Client validation is UX only. `(req §18.7, arch §9.6)` | Zod at the boundary; test | [BLOCKING] |
| IN-2 | **No raw SQL.** Prisma parameterised queries only; `$queryRawUnsafe` is banned. The sole hand-written SQL is the reviewed §6.2 partial-index migration. `(arch §8.2)` | `no-restricted-syntax` lint; review | [BLOCKING] |
| IN-3 | **Output is contextually encoded; no raw HTML injection.** `dangerouslySetInnerHTML` is prohibited; user text (esp. the public `display_name`) is stored plain and rendered via React escaping, backstopped by CSP. `(req §18.7, arch §11)` | Lint (ban `dangerouslySetInnerHTML`); review | [BLOCKING] |
| IN-4 | **`display_name` is constrained** to the §3 charset/length and is unique; it is the only user-controlled value shown publicly. `(req §18.7)` | Zod; test | [REQUIRED] |

### 2.7 Secrets & cryptography

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| SEC-1 | **`process.env` secrets are read only in the config/DAL layer; nothing secret is `NEXT_PUBLIC_*`.** `(arch §9.6, §12)` | `no-restricted-syntax` lint on `process.env` outside config; CI grep for `NEXT_PUBLIC_` near secret names | [BLOCKING] |
| SEC-2 | **Secrets come from the environment and are never committed.** `.env` is git-ignored; the repo contains no keys, hashes, or tokens. `(req §18.8)` | `.gitignore`; secret-scanning in CI | [BLOCKING] |
| SEC-3 | **TOTP secrets encrypted at rest** (AES-256-GCM, app key); the SQLite file uses restrictive permissions; SQLCipher if the DB leaves a developer machine. `(req §18.8)` | DAL encryption; deploy config; review | [REQUIRED] |
| SEC-4 | **No homegrown cryptography.** Use vetted libraries only: argon2id (hashing), AES-256-GCM (encryption), RFC 6238 (TOTP). `(req §18.2, §18.8)` | Review | [REQUIRED] |

### 2.8 HTTP & transport hardening

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| HTTP-1 | **Security headers on HTML responses** per §3 (strict CSP with per-request nonce, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). API responses set `Cache-Control: no-store` + `nosniff`. `(req §18.9, arch §9.7)` | Next middleware/`next.config`; test | [REQUIRED] |
| HTTP-2 | **TLS + HSTS before any shared/non-local deployment**; plain HTTP is acceptable on localhost only (§7). `(req §18.9, §18.11)` | Deploy config; review | [REQUIRED] |
| HTTP-3 | **Host header validation before shared deployment** (trusted-hosts allowlist; correct proxy trust). `(arch §13)` | Deploy config; review | [RECOMMENDED] |

### 2.9 Rate limiting & anti-abuse

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| RATE-1 | **Auth, registration, and mutation endpoints are rate-limited** (§3); auth additionally has lockout. `(req §18.2, §18.10)` | Rate limiter; test | [REQUIRED] |
| RATE-2 | **Integrity controls hold**: one non-voided official match per pairing per tournament; suspicious-activity flags surface to admins (non-blocking). `(req §6.2, §11)` | DB partial unique index; test | [REQUIRED] |

### 2.10 Dependencies & build

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| DEP-1 | **Dependencies are pinned** (committed lockfile) and pass **SCA** (`npm audit` / Dependency-Track); no known High/Critical advisories at release. `(req §18.10)` | CI gate | [BLOCKING] |
| DEP-2 | **No new external runtime dependency** (network calls, CDNs, cloud services, third-party auth) without review — the offline invariant must hold. `(req §16, §18.11)` | Review; CI grep for outbound calls | [REQUIRED] |
| DEP-3 | **Production runs with `NODE_ENV=production`** and the debugger/verbose errors off, so no internal detail leaks. `(arch §12)` | Deploy config | [REQUIRED] |

### 2.11 Logging

| ID | Guard rail | Enforced by | Severity |
|---|---|---|---|
| LOG-1 | **No sensitive data in logs** — never passwords, tokens, TOTP secrets, or full session IDs. `(req §18.8)` | Logger redaction; review | [BLOCKING] |
| LOG-2 | **Log security events** (auth failures, privileged actions) and **sanitise log data against log injection**. `(req §18.6, OWASP REST audit)` | Logger; test | [REQUIRED] |

## 3. Secure configuration baseline

Shipped defaults. Tunable in config, but these are the values the app ships with; lowering a security value requires an exception (§7).

- **Password**: argon2id, starting floor memory 19 MiB, iterations 2, parallelism 1 (raise to hardware); min length 12, max ≥ 64; breached/common-list screening on set/change.
- **Session cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. Server-side store in SQLite.
- **Session lifetime**: idle timeout 30 min (player) / 15 min (admin); absolute 12 h (player) / 8 h (admin); rotate on login and privilege change.
- **Step-up window**: 5 minutes for sensitive actions.
- **Lockout**: 5 failed logins within 15 min → 15-min lock with exponential backoff; per-IP cap.
- **Rate limits**: login 5/min/account; register 5/hour/IP; mutation endpoints ~60/min/session; global per-IP ceiling.
- **Request body**: JSON max 64 KB → `413` over limit (scores are tiny).
- **CSRF**: double-submit token in `X-CSRF-Token`, required on all non-GET cookie-authenticated requests.
- **CSP (HTML)**: `default-src 'self'; script-src 'self' 'nonce-{per-request}'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. Plus `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, minimal `Permissions-Policy`.
- **API headers**: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, correct `Content-Type: application/json`.
- **HSTS (shared deploy only)**: `max-age=31536000; includeSubDomains`.
- **`display_name`**: 2–30 chars, `[A-Za-z0-9 _-]` (or Unicode letters + space/`_`/`-`), unique, no HTML.
- **`self_level`**: integer 1–10. **`email`**: validated, private.
- **TOTP**: RFC 6238, 30 s step, 6 digits; secrets AES-256-GCM encrypted at rest; QR generated locally.

## 4. Threat model → guard-rail coverage

| Abuse case | Primary guard rails |
|---|---|
| Fake/forged scores | API-2 (state machine), DAL-2 (authz), AUD-2 (lock); two-party confirm (product) |
| Collusion (mutual fake wins) | RATE-2 (one-per-pairing + flags), AUD-1 (audit) |
| Account takeover | AUTH-1/2/5 (hashing, policy, lockout), SESS-1/2/3 |
| Admin abuse or compromise | AUTH-3/4 (MFA + step-up), FND-4 (least privilege), AUD-1/3 (audit), no shared accounts |
| IDOR (acting on others' resources) | DAL-2 (object-level authz), IN-1 (param validation) |
| Stored XSS via `display_name` | IN-3/IN-4 (escaping, constraint), HTTP-1 (CSP) |
| Private data leaking to the client | DAL-1/DAL-4 (server-only + DTOs), SEC-1 (no `NEXT_PUBLIC_` secrets) |
| Brute force / credential stuffing | AUTH-5 + RATE-1 |
| DoS via oversized/over-many payloads | API-4 (size limit), RATE-1 |
| CSRF | API-3 + SESS-2 (`SameSite=Lax`) |
| SQL injection | IN-2 (parameterised, no raw) |
| Supply-chain compromise | DEP-1/DEP-2 |
| Secret exposure | SEC-1/2/3, LOG-1 |

## 5. Definition of Done — security checklist (per change)

A change touching data, auth, routes, or the DAL is not done until:

- [ ] All new external input is Zod-validated server-side (body, query, `[param]`, headers) — IN-1.
- [ ] DB access and `process.env` reads occur only in the `server-only` DAL — DAL-1, SEC-1.
- [ ] Every new/changed entry point re-checks authentication **and** object-level authorization in the DAL — FND-2, DAL-2, DAL-3.
- [ ] Responses and Server→Client props carry DTOs only; no `email`/`password_hash`/`totp_secret`/raw rows cross the boundary — DAL-4.
- [ ] Any privileged action writes an `AuditEvent` in the same transaction and requires step-up — AUD-1, AUTH-4.
- [ ] Mutations are POST/PATCH/DELETE with CSRF, correct status codes, and size/content-type guards — API-1/3/4/6.
- [ ] State changes go through the domain transition guards; no out-of-order path added — API-2.
- [ ] No `dangerouslySetInnerHTML`, no `$queryRawUnsafe`, no secret in a URL or `NEXT_PUBLIC_*` — IN-2/3, SEC-1, API-5.
- [ ] No new outbound network dependency; lockfile updated; `npm audit` clean of High/Critical — DEP-1/2.
- [ ] Tests added for the authz/IDOR, audit-emission, and DTO-leakage cases the change touches — §6.

## 6. Enforcement & verification

How the rails are actually held — not by good intentions but by tooling:

- **Lint (`eslint`)** — `no-restricted-imports` (Prisma client only in DAL), `no-restricted-syntax` (`process.env` outside config, `$queryRawUnsafe`, `dangerouslySetInnerHTML`), an architecture-boundaries rule for the layer dependency direction, and a check banning auth/session values in browser storage. Enforces DAL-1, IN-2, IN-3, SEC-1, SESS-1.
- **Type system** — DTO types in `shared/`; narrow component props (no whole-`User`); `strict` TypeScript. Backs DAL-4, IN-1.
- **`import 'server-only'`** on the DAL and config modules — build error on client import. Backs DAL-1, DAL-6.
- **Automated tests** — dedicated suites for: authorization/IDOR, step-up enforcement on † routes, audit emission (no privileged write without its row), DTO leakage, input validation + status codes (`405/413/415`), output escaping, auth throttling/lockout, and the pairing-uniqueness `409`. Backs FND-2, DAL-2/4/5, AUD-1, AUTH-4/5, API-1/2/4/6, RATE-2.
- **CI gates (blocking)** — lint + typecheck + tests + `npm audit`/SBOM + secret scanning + a grep guard (Prisma/`process.env`/`NEXT_PUBLIC_` placement, outbound-call detection). Backs the [BLOCKING] rails.
- **Runtime configuration** — central cookie config, CSP/header middleware, rate limiter, body-size limit, `NODE_ENV=production`. Backs SESS-2, HTTP-1, API-3/4, RATE-1, DEP-3.
- **Mandatory review** — changes to `src/server/dal/**`, `src/server/auth/**`, `src/server/config/**`, `app/api/**`/`route.ts`, or `middleware.ts` require security review and benefit from periodic pen-testing/scanning (per the Next.js audit checklist, arch §14).

## 7. Exceptions & change control

- **Pre-approved local/offline exceptions** (from req §18.11) — each valid only for the local build and **automatically revoked at its trigger**:
  - Email unverified / no self-service password reset → revoked when email delivery is added.
  - No automated bot defence (CAPTCHA) → revoked on public/internet exposure.
  - Plain HTTP on localhost → revoked on any shared deployment (then HTTP-2 applies).
  - In-memory rate-limit (and, single-instance, session) state → revoked on multi-instance deployment.
  - Admin-MFA relaxation flag for solo local testing → revoked on any shared deployment (then AUTH-3 is strict).
- **Any other deviation** requires a documented exception: owner, date, exact scope, the compensating control, and an expiry/review date. An expired exception is a [BLOCKING] finding.
- **Changing a guard rail** (adding, removing, or weakening) is a security-review decision recorded in the change log of this file; weakening a [BLOCKING] rail additionally requires explicit sign-off.