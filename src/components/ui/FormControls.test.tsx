import { render, screen } from '@testing-library/react';
import { Checkbox } from './FormControls';

test('two Checkboxes without an explicit id get distinct, correctly-linked ids', () => {
  render(
    <>
      <Checkbox label="First" />
      <Checkbox label="Second" />
    </>
  );
  const first = screen.getByLabelText('First') as HTMLInputElement;
  const second = screen.getByLabelText('Second') as HTMLInputElement;

  expect(first.id).toBeTruthy();
  expect(second.id).toBeTruthy();
  expect(first.id).not.toBe(second.id);
});

test("a Checkbox's generated id is stable across re-renders", () => {
  const { getByLabelText, rerender } = render(<Checkbox label="Stable" hint="v1" />);
  const idBefore = (getByLabelText('Stable') as HTMLInputElement).id;

  // Math.random() would mint a fresh id on every render; useId() must not.
  rerender(<Checkbox label="Stable" hint="v2" />);
  const idAfter = (getByLabelText('Stable') as HTMLInputElement).id;

  expect(idAfter).toBe(idBefore);
});
