/**
 * The one place this application leaves its own origin, behind a seam a test
 * can replace. `window.location` is a non-configurable own property in jsdom,
 * so `vi.spyOn(window, 'location', 'get')` either throws `Cannot redefine
 * property` or really navigates the test environment.
 */
export const navigation = {
  assign: (url: string) => window.location.assign(url),
};
