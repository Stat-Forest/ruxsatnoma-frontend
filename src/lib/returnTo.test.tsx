/**
 * A card's own "back to list" link returns to the list URL the reader LEFT —
 * filters and page included — not to the bare list path. The list row hands
 * that URL over as router `state`; a card reached from anywhere else (a
 * dashboard, a notification, a pasted link) falls back to the bare path.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { useBackToList, useReturnHereState } from './returnTo';

function List() {
  const state = useReturnHereState();
  return (
    <Link to="/things/42" state={state}>
      open
    </Link>
  );
}

function Card() {
  return <div data-testid="back">{useBackToList('/things')}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/things" element={<List />} />
        <Route path="/things/:id" element={<Card />} />
        <Route path="/elsewhere" element={<Link to="/things/42">open</Link>} />
        <Route path="/spoof" element={<Link to="/things/42" state={{ from: '/admin?x=1' }}>open</Link>} />
      </Routes>
    </MemoryRouter>,
  );
}

test('a card opened from the filtered list goes back to that exact URL', async () => {
  renderAt('/things?status=NEW&page=2');
  await userEvent.setup().click(screen.getByText('open'));
  expect(screen.getByTestId('back')).toHaveTextContent(/^\/things\?status=NEW&page=2$/);
});

test('a card opened from anywhere else goes back to the bare list', async () => {
  renderAt('/elsewhere');
  await userEvent.setup().click(screen.getByText('open'));
  expect(screen.getByTestId('back')).toHaveTextContent(/^\/things$/);
});

test('a card opened directly (no state at all) goes back to the bare list', () => {
  renderAt('/things/42');
  expect(screen.getByTestId('back')).toHaveTextContent(/^\/things$/);
});

test('a `from` that is not this list is ignored — "back to list" never leads somewhere else', async () => {
  renderAt('/spoof');
  await userEvent.setup().click(screen.getByText('open'));
  expect(screen.getByTestId('back')).toHaveTextContent(/^\/things$/);
});
