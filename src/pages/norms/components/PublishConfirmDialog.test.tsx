/**
 * `PublishConfirmDialog` is pure presentation — every test here supplies
 * props directly, no query client and no network, which is exactly what
 * makes it the component task 5's tariffs dialog can reuse unmodified: if
 * these tests still pass unchanged for a caller passing tariff copy and a
 * tariff row's `effective_from`, nothing in this file assumed rule
 * parameters specifically.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishConfirmDialog, type PublishConfirmDialogProps } from './PublishConfirmDialog';

const LABELS: PublishConfirmDialogProps['labels'] = {
  title: 'Publish title',
  question: 'Publish question',
  effectiveFromLabel: 'Effective from',
  retroactiveWarning: 'Retroactive warning text',
  selfPublishWarning: 'Self-publish warning text',
  confirm: 'Confirm',
  cancel: 'Cancel',
  resultTitle: 'Result title',
  resultEmpty: 'No extra warnings',
  close: 'Close',
};

function formatDate(value: string) {
  return value;
}

function baseProps(overrides: Partial<PublishConfirmDialogProps> = {}): PublishConfirmDialogProps {
  return {
    itemLabel: 'coef_sb:qoramol',
    effectiveFrom: '2026-06-01',
    today: '2026-06-01',
    formatDate,
    editedByCallerThisSession: false,
    labels: LABELS,
    isPending: false,
    errorMessage: null,
    result: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

test('R4: no retroactive warning when effective_from is today', () => {
  render(<PublishConfirmDialog {...baseProps({ effectiveFrom: '2026-06-01', today: '2026-06-01' })} />);
  expect(screen.queryByTestId('publish-retroactive-warning')).not.toBeInTheDocument();
});

test('R4: no retroactive warning when effective_from is in the future', () => {
  render(<PublishConfirmDialog {...baseProps({ effectiveFrom: '2026-06-02', today: '2026-06-01' })} />);
  expect(screen.queryByTestId('publish-retroactive-warning')).not.toBeInTheDocument();
});

test('R4: the retroactive warning fires client-side, before the call, for an effective_from in the past', () => {
  render(<PublishConfirmDialog {...baseProps({ effectiveFrom: '2026-05-01', today: '2026-06-01' })} />);
  expect(screen.getByTestId('publish-retroactive-warning')).toHaveTextContent(LABELS.retroactiveWarning);
});

test('R3: no self-publish warning when the caller did not edit this row in this session', () => {
  render(<PublishConfirmDialog {...baseProps({ editedByCallerThisSession: false })} />);
  expect(screen.queryByTestId('publish-self-warning')).not.toBeInTheDocument();
});

test('R3: the self-publish warning fires when the caller edited this row in this session', () => {
  render(<PublishConfirmDialog {...baseProps({ editedByCallerThisSession: true })} />);
  expect(screen.getByTestId('publish-self-warning')).toHaveTextContent(LABELS.selfPublishWarning);
});

test('a resolved error is shown as-is — this component does not interpret it', () => {
  render(<PublishConfirmDialog {...baseProps({ errorMessage: 'ERR-NORM-005: not a draft' })} />);
  expect(screen.getByTestId('publish-dialog-error')).toHaveTextContent('ERR-NORM-005: not a draft');
});

test('confirm calls onConfirm; cancel/close call onClose', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<PublishConfirmDialog {...baseProps({ onConfirm, onClose })} />);

  await user.click(screen.getByTestId('publish-dialog-confirm'));
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await user.click(screen.getByTestId('publish-dialog-cancel'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('ruling R4: after a successful call, the AUTHORITATIVE warnings replace the confirmation view', () => {
  render(
    <PublishConfirmDialog
      {...baseProps({
        result: { item: {}, warnings: [{ code: 'RI-04', message: 'Retroactive per the server' }] },
      })}
    />,
  );

  expect(screen.queryByTestId('publish-confirm-dialog')).not.toHaveTextContent(LABELS.question);
  expect(screen.getByTestId('publish-warning-RI-04')).toHaveTextContent('Retroactive per the server');
  expect(screen.getByTestId('publish-dialog-close')).toBeInTheDocument();
  expect(screen.queryByTestId('publish-dialog-confirm')).not.toBeInTheDocument();
});

test('an empty warnings array is displayed as explicitly empty, not blank', () => {
  render(<PublishConfirmDialog {...baseProps({ result: { item: {}, warnings: [] } })} />);
  expect(screen.getByTestId('publish-result')).toHaveTextContent(LABELS.resultEmpty);
});
