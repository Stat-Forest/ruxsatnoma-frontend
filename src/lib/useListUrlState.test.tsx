/**
 * A list screen's applied filters and page number live in the URL, not in
 * component state — so leaving for a record's card and coming back (browser
 * Back, or the card's own "back to list" link) lands on the same filtered
 * page. Component state is lost the moment the list unmounts; the URL is not.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useListUrlState } from './useListUrlState';

const DEFAULTS = { status: '', q: '' };

function Probe() {
  const { filters, page, setFilters, setPage, reset } = useListUrlState(DEFAULTS);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <div data-testid="state">{JSON.stringify({ ...filters, page })}</div>
      <div data-testid="url">{location.pathname + location.search}</div>
      <button onClick={() => setFilters({ status: 'NEW' })}>status=NEW</button>
      <button onClick={() => setFilters({ status: '' })}>status=all</button>
      <button onClick={() => setFilters({ q: 'RX' })}>q=RX</button>
      <button onClick={() => setFilters({ q: 'RX', status: 'NEW' })}>same again</button>
      <button onClick={() => setPage(3)}>page=3</button>
      <button onClick={() => setPage(1)}>page=1</button>
      <button onClick={() => reset()}>reset</button>
      <button onClick={() => navigate('/list/42')}>open card</button>
    </div>
  );
}

function Card() {
  const navigate = useNavigate();
  return (
    <div data-testid="card">
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/list" element={<Probe />} />
        <Route path="/list/:id" element={<Card />} />
      </Routes>
    </MemoryRouter>,
  );
}

function state() {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

test('reads filters and page from the URL, falling back to the defaults', () => {
  renderAt('/list?status=NEW&page=2&tab=acts');
  expect(state()).toEqual({ status: 'NEW', q: '', page: 2 });
});

test('a bad page in the URL reads as page 1', () => {
  renderAt('/list?page=zero');
  expect(state().page).toBe(1);
  renderAt('/list?page=-4');
});

test('changing a filter writes it to the URL and goes back to page 1', async () => {
  const user = userEvent.setup();
  renderAt('/list?page=3');
  await user.click(screen.getByText('status=NEW'));
  expect(screen.getByTestId('url')).toHaveTextContent('/list?status=NEW');
  expect(state()).toEqual({ status: 'NEW', q: '', page: 1 });
});

test('a filter set back to its default disappears from the URL; page 1 is never written', async () => {
  const user = userEvent.setup();
  renderAt('/list?status=NEW&q=RX');
  await user.click(screen.getByText('status=all'));
  expect(screen.getByTestId('url')).toHaveTextContent('/list?q=RX');
  await user.click(screen.getByText('page=3'));
  expect(screen.getByTestId('url')).toHaveTextContent('/list?q=RX&page=3');
  await user.click(screen.getByText('page=1'));
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/list\?q=RX$/);
});

test('params the hook does not own (a tab, an arrival filter) survive every write', async () => {
  const user = userEvent.setup();
  renderAt('/list?tab=acts');
  await user.click(screen.getByText('q=RX'));
  await user.click(screen.getByText('page=3'));
  expect(screen.getByTestId('url')).toHaveTextContent('tab=acts');
  await user.click(screen.getByText('reset'));
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/list\?tab=acts$/);
  expect(state()).toEqual({ status: '', q: '', page: 1 });
});

test('a patch that changes nothing leaves the URL (and the page) alone', async () => {
  // A debounced "apply the draft" effect fires on mount with the values it
  // just read from the URL; that must not knock the reader back to page 1.
  const user = userEvent.setup();
  renderAt('/list?status=NEW&q=RX&page=2');
  await user.click(screen.getByText('same again'));
  expect(state().page).toBe(2);
  expect(screen.getByTestId('url')).toHaveTextContent('page=2');
});

test('filter changes replace the history entry, so Back from the card returns to the final filters', async () => {
  const user = userEvent.setup();
  renderAt('/list');
  await user.click(screen.getByText('status=NEW'));
  await user.click(screen.getByText('q=RX'));
  await user.click(screen.getByText('page=3'));
  await user.click(screen.getByText('open card'));
  expect(screen.getByTestId('card')).toBeInTheDocument();
  // MemoryRouter's history is real: one Back must cross every filter write.
  await user.click(screen.getByText('back'));
  expect(state()).toEqual({ status: 'NEW', q: 'RX', page: 3 });
});
