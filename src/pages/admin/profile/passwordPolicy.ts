/**
 * The password policy, mirrored from the server so the form can say what is
 * wrong before a round trip — `app/core/security.py::_POLICY_CHECKS`, which
 * raises `ERR-VAL-001` with a `password_policy` list of exactly these rules.
 *
 * A mirror is a second copy and can drift, so it is kept deliberately literal:
 * the same five regexes, in the same order, and nothing cleverer. The server
 * stays the authority — the form pre-checks, it does not gate. A password this
 * function accepts and the server refuses must still surface the server's
 * refusal rather than being swallowed.
 */
export type PolicyRule = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special';

const RULES: ReadonlyArray<readonly [PolicyRule, RegExp]> = [
  ['length', /.{8,}/],
  ['uppercase', /[A-Z]/],
  ['lowercase', /[a-z]/],
  ['digit', /\d/],
  // Anything that is not an ASCII letter or digit — so a Cyrillic or accented
  // letter satisfies this rule on the server, and must satisfy it here too.
  ['special', /[^A-Za-z0-9]/],
];

export function passwordPolicyFailures(password: string): PolicyRule[] {
  return RULES.filter(([, pattern]) => !pattern.test(password)).map(([rule]) => rule);
}
