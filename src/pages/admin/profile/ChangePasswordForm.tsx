import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { FormField, Input } from '../../../components/ui/FormControls';
import { useLanguage } from '../../../i18n/useT';
import { changeOwnPassword } from '../api';
import { LABELS } from './labels';
import { passwordPolicyFailures, type PolicyRule } from './passwordPolicy';

const RULE_LABEL: Record<PolicyRule, keyof typeof LABELS.uz_latn> = {
  length: 'ruleLength',
  uppercase: 'ruleUppercase',
  lowercase: 'ruleLowercase',
  digit: 'ruleDigit',
  special: 'ruleSpecial',
};

const ALL_RULES: PolicyRule[] = ['length', 'uppercase', 'lowercase', 'digit', 'special'];

/**
 * Screen C5 — the only way out of `must_change_password`.
 *
 * An administrator can issue a new one-time password but cannot clear the flag
 * for somebody else, so without this form every account `POST /admin/users`
 * creates is unusable: the backend answers `ERR-AUTH-007` on every route but
 * `GET /auth/me`, and `RequireAuth` used to render a dead end that said the
 * feature did not exist.
 *
 * The policy is checked locally before the request — the same five rules the
 * server enforces — but the server stays the authority: its refusal is
 * surfaced, never swallowed, because the mirror can drift.
 */
export function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const { lang } = useLanguage();
  const t = LABELS[lang] ?? LABELS.uz_latn;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const failures = passwordPolicyFailures(newPassword);
  const mismatch = confirm.length > 0 && confirm !== newPassword;

  const mutation = useMutation({
    mutationFn: () => changeOwnPassword(oldPassword, newPassword),
    onSuccess: onChanged,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    // Both checks are local and both must pass before a request is made — a
    // round trip that can only be refused is a round trip worth not making.
    if (failures.length > 0 || newPassword !== confirm) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4 w-full" noValidate>
      <FormField label={t.oldPassword} required>
        <Input
          data-testid="old-password"
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
      </FormField>

      <FormField label={t.newPassword} required>
        <Input
          data-testid="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </FormField>

      <FormField label={t.confirmPassword} required>
        <Input
          data-testid="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </FormField>

      {/* Every rule is listed from the start, ticking off as it is met, rather
          than appearing only once broken: a requirement a user can read before
          typing is one they do not have to discover by failing. */}
      <div className="rounded-xl bg-[#F8F9FA] border border-[#E4E7EA] px-4 py-3">
        <p className="text-xs font-semibold text-[#5A646D] mb-2">{t.requirements}</p>
        <ul className="space-y-1.5 sm:space-y-1">
          {ALL_RULES.map((rule) => {
            const failed = failures.includes(rule);
            const show = submitted || newPassword.length > 0;
            return (
              <li
                key={rule}
                data-testid={failed && submitted ? `policy-${rule}` : undefined}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  !show
                    ? 'text-[#767F87]'
                    : failed
                    ? 'text-[#B91C1C]'
                    : 'text-[#15803D] font-medium'
                }`}
              >
                {show && !failed ? (
                  <Check className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                ) : show ? (
                  <X className="w-3.5 h-3.5 text-[#B91C1C] shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9AA2A9] shrink-0 mx-1" />
                )}
                <span>{t[RULE_LABEL[rule]]}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {mismatch || (submitted && newPassword !== confirm) ? (
        <p data-testid="mismatch" className="text-xs text-[#B91C1C]">
          {t.mismatch}
        </p>
      ) : null}

      {mutation.isError ? (
        <div data-testid="server-error">
          <Alert variant="danger">{t.serverError}</Alert>
        </div>
      ) : null}

      <Button
        type="submit"
        data-testid="submit"
        disabled={mutation.isPending}
        className="w-full h-11 sm:h-10 text-sm font-semibold cursor-pointer"
      >
        {mutation.isPending ? t.saving : t.submit}
      </Button>
    </form>
  );
}
