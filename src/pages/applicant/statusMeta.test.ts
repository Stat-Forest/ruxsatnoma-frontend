import { ALL_STATUSES, APPLICATION_STATUS_STYLE } from './statusMeta';

test('every status has a style, and no two statuses look the same', () => {
  const looks = ALL_STATUSES.map((status) => {
    const style = APPLICATION_STATUS_STYLE[status];
    expect(style, status).toBeDefined();
    return `${style.className}|${style.icon.displayName ?? style.icon.name}`;
  });
  expect(new Set(looks).size).toBe(ALL_STATUSES.length);
});

test('the statuses a citizen sees side by side in the list do not share a colour', () => {
  // The screenshot this palette was made for: all three drew the same blue.
  const colours = (['SUBMITTED', 'IN_REVIEW', 'INVOICED', 'PAID', 'PERMIT_ISSUED'] as const).map(
    (status) => APPLICATION_STATUS_STYLE[status].className,
  );
  expect(new Set(colours).size).toBe(colours.length);
});
