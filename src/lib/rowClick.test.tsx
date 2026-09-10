import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { clickableRowProps } from './rowClick';

function Table({ open }: { open: () => void }) {
  return (
    <table>
      <tbody>
        <tr data-testid="row" {...clickableRowProps(open)}>
          <td data-testid="plain">RX-1</td>
          <td>
            <button type="button">Ishga olish</button>
            <a href="/x" onClick={(e) => e.preventDefault()}>
              link
            </a>
            <input type="checkbox" aria-label="pick" />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

test('a click anywhere on the row opens it', async () => {
  const open = vi.fn();
  render(<Table open={open} />);
  await userEvent.setup().click(screen.getByTestId('plain'));
  expect(open).toHaveBeenCalledTimes(1);
});

test('a click on a control inside the row is left to that control', async () => {
  const open = vi.fn();
  render(<Table open={open} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ishga olish' }));
  await user.click(screen.getByRole('link', { name: 'link' }));
  await user.click(screen.getByRole('checkbox', { name: 'pick' }));
  expect(open).not.toHaveBeenCalled();
});

test('Enter on the focused row opens it; Enter on an inner control does not double it', async () => {
  const open = vi.fn();
  render(<Table open={open} />);
  const user = userEvent.setup();
  screen.getByTestId('row').focus();
  await user.keyboard('{Enter}');
  expect(open).toHaveBeenCalledTimes(1);
  screen.getByRole('button', { name: 'Ishga olish' }).focus();
  await user.keyboard('{Enter}');
  expect(open).toHaveBeenCalledTimes(1);
});

test('releasing the mouse after selecting text is copying, not opening', async () => {
  const open = vi.fn();
  render(<Table open={open} />);
  const cell = screen.getByTestId('plain');
  const range = document.createRange();
  range.selectNodeContents(cell);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  // Dispatch the bare event: userEvent's own mousedown would clear the selection first.
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(open).not.toHaveBeenCalled();
});

test('the row is focusable and shows a pointer', () => {
  render(<Table open={() => {}} />);
  const row = screen.getByTestId('row');
  expect(row).toHaveAttribute('tabindex', '0');
  expect(row.className).toContain('cursor-pointer');
});
