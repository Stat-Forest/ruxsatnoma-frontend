import { NavLink } from 'react-router';
import { useT } from '../i18n/useT';
import { visibleNav } from './navigation';

interface NavProps {
  me: { permissions: string[]; is_superuser: boolean };
  /** Called after a link is activated — the drawer uses this to close itself. */
  onNavigate?: () => void;
}

/**
 * The link list shared by the persistent desktop sidebar and the mobile
 * drawer (`AppShell`) — one component, two containers. Touch target height is
 * 44px (`h-11`) everywhere, not just in the drawer, since the same markup
 * renders in both.
 */
export function Nav({ me, onNavigate }: NavProps) {
  const t = useT();
  const items = visibleNav(me);

  return (
    <ul className="space-y-1 px-3 py-4">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-semibold transition-colors ${
                isActive ? 'bg-[#F0F7F1] text-[#2E7D4F]' : 'text-[#1A1F24] hover:bg-[#F8F9FA]'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
