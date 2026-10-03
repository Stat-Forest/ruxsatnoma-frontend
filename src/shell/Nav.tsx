import { NavLink } from 'react-router';
import { useT } from '../i18n/useT';
import { visibleNav } from './navigation';

interface NavProps {
  me: { permissions: string[]; is_superuser: boolean };
  /** Called after a link is activated — the drawer uses this to close itself. */
  onNavigate?: () => void;
  collapsed?: boolean;
}

/**
 * The link list shared by the persistent desktop sidebar and the mobile
 * drawer (`AppShell`) — one component, two containers. Touch target height is
 * at least 44px (`min-h-11`) everywhere, not just in the drawer, since the same markup
 * renders in both. A long label wraps rather than truncates.
 */
export function Nav({ me, onNavigate, collapsed = false }: NavProps) {
  const t = useT();
  const items = visibleNav(me);

  return (
    <ul className={`space-y-1 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            aria-label={collapsed ? t(item.labelKey) : undefined}
            title={collapsed ? t(item.labelKey) : undefined}
            className={({ isActive }) =>
              `flex items-center min-h-11 py-2 rounded-xl text-sm font-semibold transition-colors ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              } ${
                isActive ? 'bg-[#F0F7F1] text-[#2E7D4F]' : 'text-[#1A1F24] hover:bg-[#F8F9FA]'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="min-w-0 break-words leading-tight">{t(item.labelKey)}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
