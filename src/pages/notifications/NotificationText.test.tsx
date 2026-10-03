import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotificationText } from './NotificationText';

describe('NotificationText', () => {
  it('sets the application number from params apart inside the text', () => {
    render(<NotificationText text="Ariza RX-2026-000016 qabul qilindi." params={{ application_number: 'RX-2026-000016' }} />);
    const number = screen.getByTestId('notification-number');
    expect(number).toHaveTextContent('RX-2026-000016');
    expect(number.className).toContain('text-[#2E7D4F]');
    expect(number.parentElement).toHaveTextContent('Ariza RX-2026-000016 qabul qilindi.');
  });

  it('highlights a permit number the same way', () => {
    render(<NotificationText text="Ruxsatnoma A № 000003 bekor qilindi." params={{ permit_number: 'A № 000003' }} />);
    expect(screen.getByTestId('notification-number')).toHaveTextContent('A № 000003');
  });

  it('leaves the text alone when params carry no number or the text lacks it', () => {
    const { container, rerender } = render(<NotificationText text="Ariza RX-2026-000016 qabul qilindi." params={{}} />);
    expect(screen.queryByTestId('notification-number')).toBeNull();
    expect(container).toHaveTextContent('Ariza RX-2026-000016 qabul qilindi.');
    rerender(<NotificationText text="Hisob-kitob qayta hisoblandi." params={{ application_number: 'RX-2026-000016' }} />);
    expect(screen.queryByTestId('notification-number')).toBeNull();
    expect(container).toHaveTextContent('Hisob-kitob qayta hisoblandi.');
  });
});
