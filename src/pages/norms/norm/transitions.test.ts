import { NORM_ACTIONS, NORM_EDITABLE_STATUSES, actionsFor } from './transitions';

test('every status offers exactly the transitions leaving it and no others', () => {
  expect(actionsFor('draft').map((s) => s.action)).toEqual(['submit-review', 'archive']);
  expect(actionsFor('review').map((s) => s.action)).toEqual(['return-to-draft', 'approve']);
  expect(actionsFor('approved').map((s) => s.action)).toEqual(['return-to-review', 'publish']);
  expect(actionsFor('published').map((s) => s.action)).toEqual(['archive']);
  expect(actionsFor('archived')).toEqual([]);
});

test('archive is reachable from draft and published only — never review or approved', () => {
  const archiveSources = NORM_ACTIONS.filter((s) => s.action === 'archive').map((s) => s.from);
  expect(archiveSources.sort()).toEqual(['draft', 'published']);
});

test('review is reachable from both draft and approved, via two distinct actions', () => {
  const toReview = NORM_ACTIONS.filter((s) => s.to === 'review');
  expect(toReview).toHaveLength(2);
  expect(toReview.map((s) => s.action).sort()).toEqual(['return-to-review', 'submit-review']);
  expect(toReview.find((s) => s.action === 'submit-review')?.from).toBe('draft');
  expect(toReview.find((s) => s.action === 'return-to-review')?.from).toBe('approved');
});

test('a norm may be edited only in draft or review, matching update_norm', () => {
  expect(NORM_EDITABLE_STATUSES).toEqual(['draft', 'review']);
});
