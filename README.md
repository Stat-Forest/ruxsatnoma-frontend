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

## Installing dependencies

`.npmrc` sets `legacy-peer-deps=true`: `openapi-typescript@7` declares a peer
range of `typescript@^5.x`, but only calls TypeScript's stable AST factory
API, which works fine under the TypeScript 6.x this project actually uses
(verified — it correctly generates `src/api/schema.d.ts`, 125 paths / 142
schemas, under TS 6.0.3). Without the override, a plain `npm install` or
`npm ci` fails with `ERESOLVE` on a peer range that is declared too narrow
rather than actually violated.
