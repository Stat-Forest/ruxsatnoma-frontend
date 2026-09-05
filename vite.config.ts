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
  },
})
