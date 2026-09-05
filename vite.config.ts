import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    // connected" placeholder — the real key/plugin flow is stage 5.2.
    env: { TZ: 'Asia/Tashkent', VITE_EIMZO_MOCK: 'true' },
  },
})
