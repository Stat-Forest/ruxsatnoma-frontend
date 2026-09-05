import '@testing-library/jest-dom/vitest'

// Node 22+ ships its own global `localStorage` (a `Storage` backed by
// `--localstorage-file`), and in this Vitest jsdom environment `window` IS
// `globalThis` — so that global shadows jsdom's own working implementation
// rather than sitting beside it (`localStorage === window.localStorage`).
// Without a `--localstorage-file` path (not configured here — tests need no
// on-disk persistence) it is present but non-functional: every call throws
// `localStorage.setItem is not a function`, and every Vitest run logs the
// `--localstorage-file was provided without a valid path` warning as the
// symptom. Replaced with a small in-memory `Storage` so `localStorage` (and
// `window.localStorage`) behaves the way jsdom's own implementation would.
// The property is `configurable` on Node's global, so this simply installs
// a working one in its place — fresh per test file, same as jsdom's own
// would be.
class MemoryStorage implements Storage {
  #data = new Map<string, string>()

  get length() {
    return this.#data.size
  }

  clear() {
    this.#data.clear()
  }

  getItem(key: string) {
    return this.#data.has(key) ? this.#data.get(key)! : null
  }

  key(index: number) {
    return Array.from(this.#data.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.#data.delete(key)
  }

  setItem(key: string, value: string) {
    this.#data.set(key, String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})
