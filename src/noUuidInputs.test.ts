/// <reference types="node" />
/**
 * Stage 14 (decision #205, R1): no screen asks a person to type a UUID. A
 * UUID is the system's key; a person holds the object's public number
 * (`RX-2026-00001`, `INV-2026-000123`, `А № 004182`). This guard reads the
 * source tree so the rule survives the next screen — the same shape as the
 * backend's `tests/test_code_conventions.py`.
 *
 * `import.meta.dirname` rather than `__dirname`: this file runs under
 * Vitest's ESM loader, where `__dirname` does not exist. The triple-slash
 * reference above brings in `@types/node` for THIS file only (`node:fs`,
 * `node:path`, `ImportMeta.dirname`) without adding "node" to the app-wide
 * `tsconfig.app.json`, which stays DOM-only for every other file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|ts)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx') && !name.endsWith('.d.ts'))
      out.push(path);
  }
  return out;
}

const OFFENDERS = [
  /placeholder=\{?["'`]UUID/, // an input that says "UUID"
  /['"]UUID['"]\s*[,}]/, // a dictionary value that is exactly "UUID"
  /UUID\s+(заявки|разрешения|raqami)/, // "UUID заявки или разрешения"
];

test('no input asks a person for a UUID', () => {
  const hits: string[] = [];
  for (const file of walk(import.meta.dirname)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of OFFENDERS) if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
  }
  expect(hits).toEqual([]);
});
