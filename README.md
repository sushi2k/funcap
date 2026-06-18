# Funcap

Community singles tennis tournaments. See `requirements.md`, `architecture.md`, and `security.md` for the binding specs and `claude.md` for the working agreement.

## Status

Scaffold only (issue #1). Subsequent issues fill the layers.

## Setup

```
cp .env.example .env
npm install                  # also runs `prisma generate`
npx prisma migrate dev       # creates funcap.db from prisma/schema.prisma
npm run seed                 # no-op until issue #2
npm run dev                  # http://localhost:3000
```

## Scripts

| Command              | Purpose                                                     |
|----------------------|-------------------------------------------------------------|
| `npm run dev`        | Next dev server.                                            |
| `npm run build`      | Production build.                                           |
| `npm start`          | Serve the production build.                                 |
| `npm run lint`       | Next/ESLint, including the security rules (security.md §6). |
| `npm run typecheck`  | `tsc --noEmit`.                                             |
| `npm test`           | Vitest (unit + integration + security suites).              |
| `npm run seed`       | Create the first admin (and optional sample data).          |

Treat `lint`, `typecheck`, and `test` as the gate before any change is "done".

## Layout

See `architecture.md` §6. The skeleton is in place; modules are filled by the remaining v1 issues.
