import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://dev-api.ruxsatnoma-urmon.uz',
        changeOrigin: true,
        secure: false,
        headers: {
          Origin: 'https://dev-api.ruxsatnoma-urmon.uz',
          Referer: 'https://dev-api.ruxsatnoma-urmon.uz/',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // The default 5s was set when this suite was 43 tests. The administration
    // screens type into many fields through `userEvent`, one character at a
    // time, and under the full suite's parallel load a form-heavy test can
    // exceed 5s while passing comfortably on its own. Raised rather than
    // marking those tests slow individually: the cause is load, not any one
    // test, and a per-test override would have to be repeated in every new one.
    testTimeout: 15000,
    // Pinned, because `applicant/format.ts::formatDateTime` renders a
    // `timestamptz` in the VIEWER'S local time — deliberately, it is what a
    // person in Tashkent should read. A test that asserts on its output is
    // therefore machine-dependent: 11:30 here, 06:30 on a UTC runner, which is
    // how CI caught `TemplatesPage.test.tsx` while every local run passed.
    // Uzbekistan has one zone and no DST, so pinning it makes every such test
    // deterministic without weakening what it asserts.
    // VITE_EIMZO_MOCK on by default in tests so the E-IMZO tab's form (gated
    // on the same flag in LoginPage.tsx) renders instead of the "not
    // connected" placeholder — the real key/plugin flow is stage 5.2. A test
    // that needs the other branch (the one every real build shows, since the
    // flag defaults off) overrides it locally with `vi.stubEnv`; `unstubEnvs`
    // below is what makes that override local to that one test.
    env: { TZ: 'Asia/Tashkent', VITE_EIMZO_MOCK: 'true', VITE_API_BASE: 'http://localhost:8000' },
    // Per-session git worktrees live under `.claude/worktrees/` (the root
    // CLAUDE.md gives each parallel session its own), and each is a FULL
    // checkout of this repository — so vitest's default include pattern walks
    // straight into them and runs every other branch's tests as if they were
    // this one's. Measured on `dev` the day this was added: 794 files / 5461
    // tests instead of 97 / 632, an eightfold suite made of code that is not
    // on the branch under test. Nothing failed, which is the dangerous part —
    // a green run over the wrong tests reads exactly like a green run.
    // `.claude/` is gitignored, so CI never saw this and never will; it is
    // purely a local trap, and only for whoever is running parallel sessions.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    // Both restore automatically after every test instead of relying on each
    // test file to remember its own `afterEach`: `restoreMocks` puts every
    // `vi.spyOn` back to its original implementation (a `navigation.assign`
    // spy must not survive past the test that set it), `unstubEnvs` reverts
    // any `vi.stubEnv` override back to this file's own defaults above.
    restoreMocks: true,
    unstubEnvs: true,
  },
})
