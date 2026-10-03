import type { ReactNode } from 'react';

/** The `params` keys under which the backend stores the number a notification
 * is about (`application_number` — `applications/service.py`, `permit_number`
 * — `permits/service.py`, `invoice_number` — `payments/service.py`). */
const NUMBER_KEYS = ['application_number', 'permit_number', 'invoice_number'] as const;

function numberOf(params: Record<string, unknown>): string | null {
  for (const key of NUMBER_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * The notification body with its own number set in bold brand green, so the
 * eye lands on `RX-2026-000016` before the sentence around it. The number is
 * the EXACT string the backend put in `params` — matched as a substring, never
 * guessed from the text with a pattern — so a row whose params carry no number,
 * or whose text does not contain it, renders as plain text.
 */
export function NotificationText({ text, params }: { text: string; params: Record<string, unknown> }) {
  const number = numberOf(params);
  if (!number || !text.includes(number)) return <>{text}</>;
  const parts = text.split(number);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(part);
    if (i < parts.length - 1) {
      nodes.push(
        <span key={i} data-testid="notification-number" className="font-semibold text-[#2E7D4F]">
          {number}
        </span>,
      );
    }
  });
  return <>{nodes}</>;
}
