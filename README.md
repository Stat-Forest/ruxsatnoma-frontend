# adminka

Staff and citizen-cabinet frontend for the Ruxsatnoma electronic permit system
(React 19 + TypeScript, Vite, Tailwind 4, TanStack Query, react-router).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck and build for production
- `npm run lint` / `npm run typecheck` / `npm run test` — individually
- `npm run check` — lint + typecheck + test, all green before every commit
- `npm run api:types` — regenerate `src/api/schema.d.ts` from a running
  backend's `/openapi.json` (see `scripts/gen-types.sh`)

## Environment variables

- `VITE_API_BASE` — the backend origin baked into the bundle at build time
  (e.g. `https://dev-api.ruxsatnoma-urmon.uz`). Unset falls back to
  `http://localhost:8000`.
- `VITE_LANDING_BASE_URL` — the public site's origin, baked in the same way
  (e.g. `https://dev.ruxsatnoma-urmon.uz`); the login page's "home", "verify a
  permit" and footer links point there (`src/lib/landing.ts`). Unset falls back
  to `http://localhost:5173`, the landing's own `vite` dev port.
- `VITE_EIMZO_MOCK` — the E-IMZO mock/real switch (`src/lib/eimzo/index.ts`).
  **Defaults to mock**: unset, or anything other than the literal string
  `'false'`, means mock. Set it to `'false'` to run against a real E-IMZO
  install and a backend whose own `EIMZO_MODE` is `real` — never the other
  way around, and never by relying on the default: `.github/workflows/
  checks.yml`/`deploy.yml` always pass it explicitly, per environment. This
  is deliberately its own variable, distinct in both name and shape from the
  backend's `EIMZO_MODE` (an enum, `mock`/`real`) — the two are configured
  independently, one per side, and are not meant to be copied from one to
  the other.

## Installing dependencies

`.npmrc` sets `legacy-peer-deps=true`: `openapi-typescript@7` declares a peer
range of `typescript@^5.x`, but only calls TypeScript's stable AST factory
API, which works fine under the TypeScript 6.x this project actually uses
(verified — it correctly generates `src/api/schema.d.ts`, 125 paths / 142
schemas, under TS 6.0.3). Without the override, a plain `npm install` or
`npm ci` fails with `ERESOLVE` on a peer range that is declared too narrow
rather than actually violated.
