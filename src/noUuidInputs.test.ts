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
 *
 * `src/api/` (the generated OpenAPI client, whose own docstrings say UUID)
 * and every `*.test.ts(x)` file (which may legitimately type ids into
 * `data-testid`s or fixtures) are excluded on purpose — neither is a
 * person-facing surface.
 *
 * Final review (A6): the first cut of this guard only read `.tsx` attribute
 * literals and bare JSX text, and skipped every non-i18n `.ts` file
 * entirely — so an inline copy table like `{ idLabel: 'UUID' }` in a plain
 * `.ts` module, or a JSX child written as its own string expression
 * (`{'Enter the UUID'}` rather than bare text), passed clean. Four patterns
 * now run, each aimed at one place a person-facing "UUID" string can hide;
 * see each regex's own comment below for which.
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
 * True where "UUID" (ASCII, case-insensitive — a person reads "uuid" and
 * "Uuid" exactly as badly as "UUID") or its Cyrillic transliteration "УУИД"
 * occurs as a whole word — not as a substring of a longer identifier or word
 * (`randomUUID`, `Ариза...`). JS `\b` is defined over ASCII word characters
 * only, so it is correct for `UUID` but silently wrong for Cyrillic (every
 * Cyrillic letter looks like a non-word character to it, so `\b` would
 * plant a false boundary in the middle of a Cyrillic word). A
 * Unicode-aware lookaround stands in for `\b` there instead.
 */
function hasUuidWord(text: string): boolean {
  return /\bUUID\b/i.test(text) || /(?<![\p{L}])УУИД(?![\p{L}])/u.test(text);
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

// An attribute literal a person reads or a screen reader announces:
// placeholder="UUID", title={'...'}, aria-label="UUID", or a FormField/Input
// hint/helperText string (`FormControls.tsx`'s own `hint` prop and
// `FormField`'s own `helperText` prop). `aria-label` is named explicitly
// rather than relying on the lookbehind to reach it through "label" — the
// lookbehind's job is only to stop a COMPOUND identifier like "myLabel="
// from matching as "label=".
const ATTR_RE = /(?<![\w-])(?:placeholder|label|title|aria-label|hint|helperText)=\{?["'`]([^"'`]*)["'`]/g;
// JSX text content between tags: >...UUID...<. Known false positive,
// accepted rather than special-cased: a comment reading `-> UUID <` (an
// arrow drawn in prose) also matches this shape and would be flagged even
// though it is not JSX. None exist in this tree today; if one ever does,
// reword the comment rather than the regex.
const JSX_TEXT_RE = />([^<>{}]*)</g;
// A JSX child written as its OWN string expression rather than bare text —
// `<p>{'Enter the UUID'}</p>` — which `JSX_TEXT_RE` cannot see because the
// `{`/`}` sit between it and the text. Deliberately narrow (the whole
// expression must be nothing but one quoted string) so it does not also
// swallow an object literal like `{ idLabel: 'UUID' }`, whose first
// non-whitespace character after `{` is an identifier, not a quote.
const JSX_EXPR_STRING_RE = /\{\s*(['"`])((?:(?!\1)[\s\S])*)\1\s*\}/g;
// The plan's own third pattern (Task 5 Step 1), dropped in the first cut and
// restored here: a string literal that is EXACTLY "UUID" (any quote style,
// case-sensitive — this one is aimed at code, not prose) immediately
// followed by `,` or `}`. This is what catches an inline copy table entry
// such as `{ idLabel: 'UUID' }` in a plain `.ts`/`.tsx` module — neither an
// attribute nor JSX text, so neither pattern above reads it. Applied to
// every file this guard walks except `src/i18n/` (whose own dictionary-wide
// scan below is already a superset: any dictionary VALUE containing the
// word, not only this one exact shape).
const EXACT_LITERAL_RE = /['"`]UUID['"`]\s*[,}]/g;

test('no input asks a person for a UUID', () => {
  const hits: string[] = [];

  for (const file of walk(import.meta.dirname)) {
    const rel = relative(ROOT, file);
    if (rel.startsWith(`src${sep}api${sep}`)) continue; // the generated client, not a person-facing surface

    const text = readFileSync(file, 'utf8');

    if (rel.startsWith(`src${sep}i18n${sep}`)) {
      // Any dictionary string value containing the word — every language,
      // not just the ones an earlier pass happened to check by hand.
      for (const re of [/\bUUID\b/gi, /(?<![\p{L}])УУИД(?![\p{L}])/gu]) {
        for (const m of text.matchAll(re)) {
          hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
        }
      }
      continue;
    }

    // Every other source file under `src/` (both `.ts` and `.tsx`): the
    // exact-literal copy-table shape applies regardless of extension.
    for (const m of text.matchAll(EXACT_LITERAL_RE)) {
      hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
    }

    if (file.endsWith('.tsx')) {
      // A doc/code comment mentioning UUID, or crypto.randomUUID(), is not
      // a hit — only what a person actually reads: an attribute literal,
      // literal JSX text between tags, or a JSX child that is itself a bare
      // string expression.
      for (const m of text.matchAll(ATTR_RE)) {
        if (hasUuidWord(m[1])) hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
      }
      for (const m of text.matchAll(JSX_TEXT_RE)) {
        if (hasUuidWord(m[1])) hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
      }
      for (const m of text.matchAll(JSX_EXPR_STRING_RE)) {
        if (hasUuidWord(m[2])) hits.push(`${rel}:${lineAt(text, m.index)}: ${lineTextAt(text, m.index)}`);
      }
    }
  }

  expect(hits).toEqual([]);
});
