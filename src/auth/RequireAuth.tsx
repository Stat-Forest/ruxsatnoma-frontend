import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Forbidden } from '../components/Forbidden';
import { satisfies } from '../shell/navigation';
import { useAuth } from './useAuth';

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Yuklanmoqda">
      <div className="w-8 h-8 border-4 border-[#E4E7EA] border-t-[#2E7D4F] rounded-full animate-spin" />
    </div>
  );
}

/**
 * Backstop for two "logged in but gated" backend states — both leave the
 * session valid but 403 every route except a couple this stage does not
 * ship yet, so the screens that resolve them belong to a later stage:
 * `must_change_password` (backend: ERR-AUTH-007 on every other route) and
 * `registration_complete === false` (backend: ERR-AUTH-008).
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
  children,
}: {
  permission?: string | readonly string[];
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

  if (me.user.must_change_password) {
    return (
      <BlockingNotice
        testId="must-change-password"
        message="Parolni almashtirish talab qilinadi. Bu funksiya hali mavjud emas — administrator bilan bog'laning."
      />
    );
  }
  if (!me.registration_complete) {
    return (
      <BlockingNotice
        testId="registration-incomplete"
        message="Ro'yxatdan o'tishni yakunlash kerak. Bu funksiya hali mavjud emas — administrator bilan bog'laning."
      />
    );
  }

  // The is_superuser short-circuit is the whole point of the flag: sys_admin
  // passes every gate without consulting codes, including one for a
  // permission added after this session's role/permission grants were read.
  // `satisfies` is the SAME predicate the menu filters with, imported rather
  // than re-implemented: a route whose gate disagreed with its own menu entry
  // would either show a link that refuses, or hide a page the user may open.
  if (!satisfies(permission, me)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
