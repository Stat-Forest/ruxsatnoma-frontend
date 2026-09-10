import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Forbidden } from '../components/Forbidden';
import { satisfies } from '../shell/navigation';
import { useAuth } from './useAuth';
import { ChangePasswordForm } from '../pages/admin/profile/ChangePasswordForm';
import { CompleteRegistrationGate } from '../pages/cabinet/registration/CompleteRegistrationGate';

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Yuklanmoqda">
      <div className="w-8 h-8 border-4 border-[#E4E7EA] border-t-[#2E7D4F] rounded-full animate-spin" />
    </div>
  );
}

/**
 * Backstop for a "logged in but not going anywhere" backend state that has
 * no screen of its own — a failed session re-check is the one case left
 * (`session-check-failed`, below). `must_change_password` (backend:
 * ERR-AUTH-007) and `registration_complete === false` (backend:
 * ERR-AUTH-008) each render their own resolving form instead — see those
 * branches below.
 */
function BlockingNotice({ testId, message }: { testId: string; message: string }) {
  return (
    <div data-testid={testId} className="min-h-screen flex items-center justify-center px-4 text-center">
      <p className="text-sm text-[#5A646D] max-w-sm">{message}</p>
    </div>
  );
}

export function RequireAuth({
  permission,
  strict,
  children,
}: {
  permission?: string | readonly string[];
  /** The code must be held for real — no superuser bypass (`NavItem.strict`). */
  strict?: boolean;
  children: ReactNode;
}) {
  const { me, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  // A failed session check that is NOT "no session" (ERR-AUTH-002) must not
  // be treated the same as logged-out — that would silently bounce a
  // possibly-still-logged-in user to /login with no visible reason.
  if (authError) {
    return (
      <BlockingNotice
        testId="session-check-failed"
        message="Sessiyani tekshirishda xatolik yuz berdi. Sahifani yangilang yoki keyinroq urinib ko'ring."
      />
    );
  }

  if (!me) return <Navigate to="/login" state={{ next: location.pathname }} replace />;

  // Not a notice any more: only the user themselves can clear this flag
  // (`POST /auth/password/change`), so telling them to contact an
  // administrator was advice that led nowhere — the administrator can issue
  // another one-time password and nothing else. The gate still holds the app
  // shut; what changes is that it now contains the one action that opens it.
  if (me.user.must_change_password) {
    return (
      <div
        data-testid="must-change-password"
        className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#F8F9FA]"
      >
        <div className="w-full max-w-sm bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
          <h1 className="text-base font-bold text-[#1A1F24]">Parolni almashtirish</h1>
          <p className="mt-1 mb-4 text-xs text-[#5A646D] leading-relaxed">
            Davom etish uchun parolni almashtiring. Administrator bergan vaqtinchalik parol bir martalik.
          </p>
          <ChangePasswordForm onChanged={() => window.location.assign('/')} />
        </div>
      </div>
    );
  }
  // No longer a dead end (screen B2): a citizen arriving through OneID for
  // the first time has no `applicants` row yet, and only THEY can create
  // one — an administrator has no route that does it on their behalf. The
  // form's own comment explains why nothing here has to decide where to
  // send the citizen once it succeeds.
  if (!me.registration_complete) {
    return <CompleteRegistrationGate />;
  }

  // The is_superuser short-circuit is the whole point of the flag: sys_admin
  // passes every gate without consulting codes, including one for a
  // permission added after this session's role/permission grants were read.
  // The one exception is a `strict` gate — the citizen's own cabinet, where
  // the superuser has nothing of their own to see (`NavItem.strict`).
  // `satisfies` is the SAME predicate the menu filters with, imported rather
  // than re-implemented: a route whose gate disagreed with its own menu entry
  // would either show a link that refuses, or hide a page the user may open.
  if (!satisfies(permission, me, strict)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
