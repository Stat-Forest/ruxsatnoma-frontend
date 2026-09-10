import type { KeyboardEvent, MouseEvent } from 'react';

/** Controls that own their own click: a click that lands on one of these
 * inside a clickable row must not also open the row. */
const OWN_CLICK_SELECTOR = 'a,button,input,select,textarea,label,[role="button"],[role="link"],[role="menuitem"]';

/** True when a click on a clickable row should be ignored — it landed on a
 * control of the row's own (the "Ishga olish" button, a checkbox, the
 * number link), or the mouse-up ended a text selection, which means the user
 * was copying, not opening. */
export function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  const control = target?.closest(OWN_CLICK_SELECTOR);
  if (control && e.currentTarget.contains(control)) return true;
  const selection = window.getSelection();
  return !!selection && selection.type === 'Range' && selection.toString().length > 0;
}

/** Classes a clickable row wears; `clickableRowProps` already includes them. */
export const CLICKABLE_ROW_CLASS = 'cursor-pointer focus-visible:outline-none focus-visible:bg-[#F0F7F1]';

/** Wire an entire `<tr>` (or any row element) to open its record: click
 * anywhere on the row, or Enter while the row itself is focused. Spread onto
 * the row and append `className` to the row's own classes. Keep the explicit
 * number link / "Ochish" affordance too — it is what screen readers and
 * middle-click still use. */
export function clickableRowProps(open: () => void) {
  return {
    tabIndex: 0,
    className: CLICKABLE_ROW_CLASS,
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (!shouldIgnoreRowClick(e)) open();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) {
        e.preventDefault();
        open();
      }
    },
  };
}
