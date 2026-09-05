/**
 * `ArchiveConfirmDialog` is pure presentation, the same way
 * `PublishConfirmDialog` is — see that file's test header for why this
 * matters for task 5's reuse.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveConfirmDialog } from './ArchiveConfirmDialog';

const LABELS = { title: 'Archive title', question: 'Archive question', confirm: 'Confirm', cancel: 'Cancel' };

test('renders the item identity and wires confirm/cancel to their callbacks', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ArchiveConfirmDialog
      itemLabel="coef_sb:tuya"
      labels={LABELS}
      isPending={false}
      errorMessage={null}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  expect(screen.getByTestId('archive-confirm-dialog')).toHaveTextContent('coef_sb:tuya');
  expect(screen.queryByTestId('archive-dialog-error')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('archive-dialog-confirm'));
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await user.click(screen.getByTestId('archive-dialog-cancel'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a resolved error message is shown as-is', () => {
  render(
    <ArchiveConfirmDialog
      itemLabel="coef_sb:tuya"
      labels={LABELS}
      isPending={false}
      errorMessage="ERR-SYS-000: failed"
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByTestId('archive-dialog-error')).toHaveTextContent('ERR-SYS-000: failed');
});
