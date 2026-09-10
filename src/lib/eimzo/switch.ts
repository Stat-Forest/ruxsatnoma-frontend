/**
 * The mock/real switch itself. `index.ts` re-exports it and its docstring
 * says why it is a FUNCTION, not a constant (`import.meta.env` is a live
 * object `vi.stubEnv` mutates in place) and why it defaults SAFE — anything
 * other than the literal `'false'` means mock.
 */
export function isEimzoMock(): boolean {
  return import.meta.env.VITE_EIMZO_MOCK !== 'false';
}
