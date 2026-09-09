import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Stepper, type StepItem } from './Navigation';

const STEPS: StepItem[] = [
  { id: 1, title: 'Faoliyat turi', description: 'Foydalanish turi' },
  { id: 2, title: 'Maydon', description: 'Kontur va davr' },
  { id: 3, title: 'Parametrlar', description: 'Miqdor va narx' },
  { id: 4, title: 'Hujjatlar', description: 'Ilova qilinadigan fayllar' },
  { id: 5, title: 'Yuborish', description: 'Tekshiruv va E-imzo' },
];

describe('Stepper', () => {
  it('renders all step titles and active step on step 1', () => {
    render(<Stepper steps={STEPS} currentStep={1} />);

    // Active step details rendered in both desktop and mobile views
    expect(screen.getAllByText('Faoliyat turi').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Foydalanish turi').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('updates active step display when currentStep changes', () => {
    render(<Stepper steps={STEPS} currentStep={3} />);

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.getAllByText('Parametrlar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Miqdor va narx').length).toBeGreaterThanOrEqual(1);
  });

  it('allows clicking previous completed steps when onStepClick is provided', async () => {
    const handleClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={3} onStepClick={handleClick} />);

    const step1Buttons = screen.getAllByLabelText('1: Faoliyat turi');
    expect(step1Buttons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(step1Buttons[0]);
    expect(handleClick).toHaveBeenCalledWith(1);
  });

  it('disables clicking future steps', async () => {
    const handleClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={2} onStepClick={handleClick} />);

    const step4Buttons = screen.getAllByLabelText('4: Hujjatlar');
    expect(step4Buttons[0]).toBeDisabled();
    await userEvent.click(step4Buttons[0]);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // T1's stepper contract: "a step ahead of the furthest one reached stays
  // inert" — furthest reached, not merely "ahead of where I am right now".
  it('keeps a step already reached clickable even after going back further, via maxStepReached', async () => {
    const handleClick = vi.fn();
    // Furthest reached is 4, but currently viewing step 2 — the shape a
    // click on the stepper's own step 1 produces in the real wizard.
    render(<Stepper steps={STEPS} currentStep={2} maxStepReached={4} onStepClick={handleClick} />);

    const step4Buttons = screen.getAllByLabelText('4: Hujjatlar');
    expect(step4Buttons[0]).not.toBeDisabled();
    await userEvent.click(step4Buttons[0]);
    expect(handleClick).toHaveBeenCalledWith(4);
  });

  it('still disables a step beyond maxStepReached, even when it is behind currentStep would otherwise imply', async () => {
    const handleClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={2} maxStepReached={2} onStepClick={handleClick} />);

    const step2Buttons = screen.getAllByLabelText('2: Maydon');
    // currentStep itself stays enabled (it always was, id <= reachable).
    expect(step2Buttons[0]).not.toBeDisabled();
    const step3Buttons = screen.getAllByLabelText('3: Parametrlar');
    expect(step3Buttons[0]).toBeDisabled();
    await userEvent.click(step3Buttons[0]);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
