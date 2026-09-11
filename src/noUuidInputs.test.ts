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
 * reference above brings in `@types/node` for `node:fs`/`node:path` and
 * `ImportMeta.dirname`, which this file needs and `tsconfig.app.json`'s own
 * `types` list does not include. It does not keep the rest of `src/`
 * DOM-only — `@types/node`'s ambient globals are program-wide the moment
 * any file in the same tsconfig program references them; this comment only
 * explains why this one file carries the reference.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (
      /\.(tsx?|ts)$/.test(name) &&
      !name.endsWith('.test.ts') &&
      !name.endsWith('.test.tsx') &&
      !name.endsWith('.d.ts')
    )
      out.push(path);
  }
  return out;
}

/**
 * True where "UUID" (ASCII) or its Cyrillic transliteration "УУИД" occurs as
 * a whole word — not as a substring of a longer identifier or word
 * (`randomUUID`, `Ариза...`). JS `\b` is defined over ASCII word characters
 * only, so it is correct for `UUID` but silently wrong for Cyrillic (every
 * Cyrillic letter looks like a non-word character to it, so `\b` would
 * plant a false boundary in the middle of a Cyrillic word). A
 * Unicode-aware lookaround stands in for `\b` there instead.
 */
function hasUuidWord(text: string): boolean {
  return /\bUUID\b/.test(text) || /(?<![\p{L}])УУИД(?![\p{L}])/u.test(text);
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function lineTextAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? text.length : end).trim();
}

// An attribute literal, e.g. placeholder="UUID" or label={'...'} — not
// aria-label (excluded by the lookbehind so a hyphenated attribute name
// doesn't also match "label=").
const ATTR_RE = /(?<![\w-])(?:placeholder|label)=\{?["'`]([^"'`]*)["'`]/g;
// JSX text content between tags: >...UUID...<
const JSX_TEXT_RE = />([^<>{}]*)</g;

test('no input asks a person for a UUID', () => {
  const hits: string[] = [];

  for (const file of walk(import.meta.dirname)) {
    const rel = relative(ROOT, file);
    if (rel.startsWith(`src${sep}api${sep}`)) continue; // the generated client, not a person-facing surface

    const text = readFileSync(file, 'utf8');

    if (rel.startsWith(`src${sep}i18n${sep}`)) {
      // Any dictionary string value containing the word — every language,
      // not just the ones an earlier pass happened to check by hand.
      for (const re of [/\bUUID\b/g, /(?<![\p{L}])УУИД(?![\p{L}])/gu]) {
        for (const m of text.matchAll(re)) {
          hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
        }
      }
    } else if (file.endsWith('.tsx')) {
      // A doc/code comment mentioning UUID, or crypto.randomUUID(), is not
      // a hit — only what a person actually reads: a placeholder/label
      // attribute, or literal JSX text between tags.
      for (const m of text.matchAll(ATTR_RE)) {
        if (hasUuidWord(m[1])) hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
      }
      for (const m of text.matchAll(JSX_TEXT_RE)) {
        if (hasUuidWord(m[1])) hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
      }
    }
  }

  expect(hits).toEqual([]);
});
