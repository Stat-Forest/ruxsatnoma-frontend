/**
 * The server's caps on query-string parameters a user types into
 * (`backend/app/core/schemas.py`, stage 19). An input carries the cap as its
 * `maxLength`, so the text stops there instead of coming back as a 422 — the
 * search box on /my/permits accepted 1 000 characters and answered
 * "validation failed" (2026-09-25).
 */
export const SEARCH_MAX_LENGTH = 200; // `?q=` on every list — SEARCH_MAX_LENGTH
export const APPLICATION_NUMBER_MAX_LENGTH = 64; // `/applications?number` — NUMBER_MAX_LENGTH
export const PERMIT_QR_MAX_LENGTH = 128; // `/public/permits/check?qr`
