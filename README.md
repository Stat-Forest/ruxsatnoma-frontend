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
