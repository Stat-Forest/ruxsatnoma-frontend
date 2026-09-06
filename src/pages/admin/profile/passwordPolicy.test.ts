import { passwordPolicyFailures } from './passwordPolicy';

test('a password shorter than eight characters fails on length', () => {
  expect(passwordPolicyFailures('Aa1!')).toContain('length');
});

test('each missing character class is reported on its own', () => {
  expect(passwordPolicyFailures('alllowercase1!')).toEqual(['uppercase']);
  expect(passwordPolicyFailures('ALLUPPERCASE1!')).toEqual(['lowercase']);
  expect(passwordPolicyFailures('NoDigitsHere!')).toEqual(['digit']);
  expect(passwordPolicyFailures('NoSpecial123')).toEqual(['special']);
});

test('a password meeting every rule reports nothing', () => {
  expect(passwordPolicyFailures('Adirli#Fuqr6390')).toEqual([]);
});

test('a non-ASCII letter still counts as a letter, not as a special character', () => {
  // The backend's classes are the regex ones — `[A-Za-z]` for letters and
  // `[^A-Za-z0-9]` for "special". A Cyrillic or Latin-extended letter falls
  // into "special" there, so it must here too, or the form would accept a
  // password the server then refuses.
  expect(passwordPolicyFailures('Paroļabc123ĀĒ')).toEqual([]);
});
