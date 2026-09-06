/**
 * F5's non-text constants — permission codes and the field-level rules
 * `NormIn`/`NormPatch` enforce server-side, mirroring `params/labels.ts`'s
 * own split (this file: enums/patterns/permission codes; `i18n/ru.ts`/
 * `uz_latn.ts`: copy).
 */
export const NORMS_MANAGE = 'norms.manage';
export const NORMS_APPROVE = 'norms.approve';
export const NORMS_PUBLISH = 'norms.publish';

/** `SeasonWindow.from`/`.to` (`schemas.py::MonthDay`) — an ASCII-digit
 *  `MM-DD` pattern with NO calendar validation of its own (the backend's own
 *  comment: written as `[0-9]` rather than `\d` because Postgres's CHECK
 *  dialect is not Unicode-aware — a lesson about the SERVER's regex choice,
 *  not a reason to validate more strictly here). This form matches the
 *  server's own leniency exactly rather than rejecting a technically-valid
 *  `"13-99"` the API itself would accept. */
export const MONTH_DAY_PATTERN = /^[0-9]{2}-[0-9]{2}$/;

/** `NormIn.yield_c_per_ha` / `NormPatch.yield_c_per_ha`:
 *  `Decimal(ge=0, max_digits=10, decimal_places=4)` — the same shape
 *  `tariffs/coefficient.ts` validates for `TariffIn.coefficient`, with this
 *  field's own bounds. */
export const YIELD_MAX_DIGITS = 10;
export const YIELD_DECIMAL_PLACES = 4;
