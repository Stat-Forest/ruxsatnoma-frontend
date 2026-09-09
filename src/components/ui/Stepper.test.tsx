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
});
