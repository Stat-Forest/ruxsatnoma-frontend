/**
 * H7 — system settings.
 *
 * The screen exists to answer one question at a glance: which of the
 * system's parameters have been moved off the value the system shipped with.
 * Everything else on it serves that — the amber rail and pill on a changed
 * row, the default printed beside the current value, the grouping by the
 * key's own prefix.
 *
 * Two properties of the contract shape the whole implementation:
 *
 *  - `SettingOut.value` and `.default` are `unknown`. There is no per-key
 *    type anywhere in the schema, so the editor is inferred from the value's
 *    RUNTIME type: boolean → checkbox, number → numeric input, string → text
 *    input, anything else (object, array) → a textarea holding JSON that is
 *    parsed on save. A value of `null` carries no shape at all, so that one
 *    case falls back to the default's type, which does.
 *
 *  - There is no reset route. `PUT /admin/settings/{key}` is the entire write
 *    surface, so a "reset" button would have to send the default back as an
 *    ordinary value while pretending to be something else. Instead the
 *    default is printed next to the current value, in a form that can be
 *    typed back in, and the banner says so.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox, Input, Textarea } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { LABELS, type uz_latn } from './labels';
import type { SettingOut } from './api';
import { useSettings, useUpdateSetting } from './queries';

type Copy = Record<keyof typeof uz_latn, string>;

type EditorKind = 'boolean' | 'number' | 'string' | 'json';

/**
 * The editor follows the current value's runtime type — that is the only
 * type information the contract offers. `null` and `undefined` are the one
 * exception: they describe no shape, so the default (which is a real value
 * for every key that has one) decides instead, and a key that is null on
 * both sides lands in the JSON editor, where `null` is expressible.
 */
function editorKind(value: unknown, fallback: unknown): EditorKind {
  const source = value ?? fallback;
  switch (typeof source) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    default:
      return 'json';
  }
}

/** The value as the editor's initial text — raw for a string (a user editing
 *  a series should see `A`, not `"A"`), pretty JSON for a structure. */
function toEditorText(value: unknown, kind: EditorKind): string {
  if (kind === 'string') return typeof value === 'string' ? value : '';
  if (kind === 'number') return typeof value === 'number' ? String(value) : '';
  return JSON.stringify(value ?? null, null, 2);
}

/** The value as it is DISPLAYED beside the row — always JSON, so that `10`
 *  and `"10"` cannot look alike on a screen whose whole subject is types. */
function toDisplayText(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? 'null' : json;
}

type ParseResult = { value: unknown } | { error: string };

function parseDraft(kind: EditorKind, text: string, flag: boolean, copy: Copy): ParseResult {
  switch (kind) {
    case 'boolean':
      return { value: flag };
    case 'string':
      return { value: text };
    case 'number': {
      const trimmed = text.trim();
      const parsed = Number(trimmed);
      if (trimmed === '' || !Number.isFinite(parsed)) return { error: copy.invalidNumber };
      return { value: parsed };
    }
    case 'json':
      try {
        return { value: JSON.parse(text) as unknown };
      } catch (error) {
        return { error: `${copy.invalidJson}: ${(error as Error).message}` };
      }
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function SettingRow({ setting, copy }: { setting: SettingOut; copy: Copy }) {
  const errorText = useApiErrorText();
  const kind = editorKind(setting.value, setting.default);
  // Both pieces of draft state are created once, from the value the row
  // arrived with; exactly one of them is read, because `kind` is fixed for
  // the lifetime of a row. Keeping the text of a number/JSON editor as text
  // is deliberate — a half-typed `-` or `{` is not a value yet, and coercing
  // it on every keystroke would fight the person typing it.
  const [text, setText] = useState(() => toEditorText(setting.value, kind));
  const [flag, setFlag] = useState(() => setting.value === true);
  const [parseError, setParseError] = useState<string | null>(null);

  const mutation = useUpdateSetting();

  const draft = parseDraft(kind, text, flag, copy);
  const dirty = 'error' in draft ? true : !sameValue(draft.value, setting.value);
  const inputId = `setting-input-${setting.key}`;

  function save() {
    if ('error' in draft) {
      // Refused locally: nothing is sent, and the row keeps showing the
      // value the server still holds.
      setParseError(draft.error);
      return;
    }
    setParseError(null);
    mutation.mutate({ key: setting.key, value: draft.value });
  }

  function onEdit() {
    // The parse error described a save attempt, not the text now in the box.
    if (parseError) setParseError(null);
    if (mutation.isError) mutation.reset();
  }

  const requestError = mutation.error
    ? mutation.error instanceof ApiError
      ? errorText(mutation.error)
      : copy.saveFailed
    : null;
  const error = parseError ?? requestError;
  const showSaved = mutation.isSuccess && !dirty && !error;

  return (
    <div
      data-testid={`setting-${setting.key}`}
      className={`flex flex-col gap-4 py-5 pl-3 border-l-2 md:flex-row md:items-start md:gap-8 ${
        setting.overridden ? 'border-[#B45309] bg-[#FFFBEB]/40' : 'border-transparent'
      }`}
    >
      <div className="min-w-0 md:w-1/2">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className="font-mono text-sm font-semibold text-[#1A1F24] break-all"
          >
            {setting.key}
          </label>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              setting.overridden
                ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
                : 'border-[#E4E7EA] bg-[#F8F9FA] text-[#5A646D]'
            }`}
          >
            {setting.overridden ? copy.overridden : copy.atDefault}
          </span>
        </div>

        {/* English, straight from the server — this screen does not invent a
            translation for a key it has never seen. */}
        <p className="mt-1 text-xs leading-relaxed text-[#5A646D]">{setting.description}</p>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#5A646D]">
              {copy.currentValue}
            </dt>
            <dd
              data-testid={`setting-current-${setting.key}`}
              className="mt-0.5 font-mono break-all text-[#1A1F24]"
            >
              {toDisplayText(setting.value)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#5A646D]">
              {copy.defaultValue}
            </dt>
            <dd
              data-testid={`setting-default-${setting.key}`}
              className="mt-0.5 font-mono break-all text-[#5A646D]"
            >
              {toDisplayText(setting.default)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex min-w-0 flex-col gap-2 md:w-1/2">
        {kind === 'boolean' ? (
          <Checkbox
            id={inputId}
            label={flag ? copy.enabled : copy.disabled}
            checked={flag}
            onChange={(event) => {
              setFlag(event.target.checked);
              onEdit();
            }}
          />
        ) : kind === 'json' ? (
          <Textarea
            id={inputId}
            value={text}
            spellCheck={false}
            error={Boolean(parseError)}
            className="font-mono text-xs"
            onChange={(event) => {
              setText(event.target.value);
              onEdit();
            }}
          />
        ) : (
          <Input
            id={inputId}
            type={kind === 'number' ? 'number' : 'text'}
            value={text}
            error={Boolean(parseError)}
            onChange={(event) => {
              setText(event.target.value);
              onEdit();
            }}
          />
        )}

        {kind === 'json' && !error && <p className="text-xs text-[#5A646D]">{copy.jsonHint}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="primary"
            data-testid={`setting-save-${setting.key}`}
            disabled={!dirty}
            isLoading={mutation.isPending}
            onClick={save}
          >
            {copy.save}
          </Button>
          {showSaved && (
            <span
              data-testid={`setting-saved-${setting.key}`}
              className="text-xs font-semibold text-[#15803D]"
            >
              {copy.saved}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            data-testid={`setting-error-${setting.key}`}
            className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] p-2 text-xs break-words text-[#991B1B]"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const copy: Copy = LABELS[lang];
  const settings = useSettings();

  const rows = settings.data ?? [];
  const overriddenCount = rows.filter((setting) => setting.overridden).length;

  return (
    <div className="space-y-6 pb-16 font-sans" data-testid="settings-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg font-bold tracking-tight text-[#1A1F24] md:text-xl">{copy.title}</h1>
        <p className="mt-1 text-xs text-[#5A646D] md:text-sm">{copy.subtitle}</p>
      </div>

      <Alert variant="info">{copy.resetHint}</Alert>

      {settings.isError && (
        <div
          role="alert"
          data-testid="settings-error"
          className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
        >
          {settings.error instanceof ApiError ? errorText(settings.error) : copy.loadFailed}
        </div>
      )}

      {settings.isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">
          <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
          {copy.loading}
        </div>
      ) : settings.data && rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">{copy.empty}</div>
      ) : rows.length > 0 ? (
        <div className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs sm:p-6">
          <p className="pb-3 text-xs font-semibold text-[#5A646D]">
            {overriddenCount} {copy.overriddenCount} / {rows.length}
          </p>
          <div className="divide-y divide-[#E4E7EA] border-t border-[#E4E7EA]">
            {rows.map((setting) => (
              <SettingRow key={setting.key} setting={setting} copy={copy} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
