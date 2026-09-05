/**
 * Fixtures and the MSW handler set shared by this folder's two test files.
 * Kept next to the screen, in the style of `src/pages/dashboard/fixtures.ts`
 * — the shapes are the contract's own (`UserAdminOut`, `RoleAdminOut`,
 * `OrganizationOut`, …), only trimmed to the columns these screens read.
 */
import { http, HttpResponse } from 'msw';

export const ROLE_APPLICANT = 'role-applicant';
export const ROLE_INSPECTOR = 'role-inspector';
export const ROLE_LESHOZ_HEAD = 'role-leshoz-head';

export const ORG_AGENCY = 'org-agency';
export const ORG_BURCHMULLA = 'org-burchmulla';

export const REGION_TASHKENT = 'region-tashkent';
export const DISTRICT_BOSTANLIQ = 'district-bostanliq';

export const USER_KARIMOV = 'user-karimov';
export const USER_SOBIROV = 'user-sobirov';

export const ROLES = [
  {
    id: ROLE_APPLICANT,
    code: 'applicant',
    name: { uz_latn: 'Fuqaro', ru: 'Гражданин' },
    description: null,
    is_system: true,
    status: 'active',
    max_approve_amount: null,
    max_approve_area: null,
    permission_codes: [],
    holders: 1204,
  },
  {
    id: ROLE_INSPECTOR,
    code: 'inspector',
    name: { uz_latn: 'Inspektor', ru: 'Инспектор' },
    description: null,
    is_system: true,
    status: 'active',
    max_approve_amount: null,
    max_approve_area: null,
    permission_codes: ['applications.review'],
    holders: 12,
  },
  {
    id: ROLE_LESHOZ_HEAD,
    code: 'leshoz_head',
    name: { uz_latn: 'Oʻrmon xoʻjaligi rahbari', ru: 'Руководитель лесхоза' },
    description: null,
    is_system: true,
    status: 'active',
    max_approve_amount: null,
    max_approve_area: null,
    permission_codes: ['applications.approve'],
    holders: 3,
  },
];

export const ORGANIZATIONS = [
  {
    id: ORG_AGENCY,
    parent_id: null,
    kind: 'agency',
    code: 'AGENCY',
    name: { uz_latn: 'Oʻrmon xoʻjaligi agentligi', ru: 'Агентство лесного хозяйства' },
    stir: null,
    region_id: null,
    district_id: null,
    status: 'active',
  },
  {
    id: ORG_BURCHMULLA,
    parent_id: ORG_AGENCY,
    kind: 'leshoz',
    code: 'BURCH',
    name: { uz_latn: 'Burchmulla oʻrmon xoʻjaligi', ru: 'Бурчмуллинский лесхоз' },
    stir: null,
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_BOSTANLIQ,
    status: 'active',
  },
];

export const REGIONS = [
  {
    id: REGION_TASHKENT,
    code: '14',
    soato_code: '1727',
    name: { uz_latn: 'Toshkent viloyati', ru: 'Ташкентская область' },
  },
];

export const DISTRICTS = [
  {
    id: DISTRICT_BOSTANLIQ,
    code: '1427',
    soato_code: '1727212',
    name: { uz_latn: 'Boʻstonliq tumani', ru: 'Бостанлыкский район' },
    region_id: REGION_TASHKENT,
  },
];

export interface UserFixture {
  id: string;
  login: string | null;
  full_name: string;
  pinfl: string | null;
  position: string | null;
  role_id: string;
  role_code: string;
  organization_id: string | null;
  region_id: string | null;
  district_id: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  must_change_password: boolean;
  valid_until: string | null;
  last_login_at: string | null;
  created_at: string;
}

export function user(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    id: USER_KARIMOV,
    login: 'a.karimov',
    full_name: 'Karimov Alisher Baxtiyorovich',
    pinfl: '31234567890123',
    position: 'Bosh mutaxassis',
    role_id: ROLE_INSPECTOR,
    role_code: 'inspector',
    organization_id: ORG_BURCHMULLA,
    region_id: REGION_TASHKENT,
    district_id: null,
    phone: null,
    email: null,
    status: 'active',
    must_change_password: false,
    valid_until: null,
    last_login_at: '2026-09-01T09:15:00+05:00',
    created_at: '2026-08-01T09:00:00+05:00',
    ...overrides,
  };
}

export const PERMISSIONS = [
  { code: 'applications.review', description: 'Arizalarni koʻrib chiqish', roles: ['inspector'] },
  { code: 'applications.approve', description: 'Arizani tasdiqlash', roles: ['leshoz_head'] },
  { code: 'permits.issue', description: 'Ruxsatnoma berish', roles: ['leshoz_head'] },
  { code: 'admin.users.manage', description: 'Foydalanuvchilarni boshqarish', roles: [] },
];

export const STATS = {
  total: 34,
  by_status: { active: 30, blocked: 3, deleted: 1 },
  by_role: { inspector: 12, leshoz_head: 3 },
  active_sessions: 7,
};

export function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

/**
 * Every route the screen touches on mount plus the card's own reads. Tests
 * add `server.use(...)` on top for the mutations they assert against — MSW
 * gives precedence to the most recently registered handler.
 */
export function referenceHandlers(users: UserFixture[] = [user()]) {
  return [
    http.get('*/api/v1/admin/users/stats', () => HttpResponse.json(STATS)),
    http.get('*/api/v1/admin/users', () => HttpResponse.json(page(users))),
    http.get('*/api/v1/admin/users/:userId', ({ params }) => {
      const found = users.find((u) => u.id === params.userId);
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ error: { code: 'ERR-SYS-004', message: 'not found' } }, { status: 404 });
    }),
    http.get('*/api/v1/admin/roles', () => HttpResponse.json(ROLES)),
    http.get('*/api/v1/admin/permissions', () => HttpResponse.json(PERMISSIONS)),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json(REGIONS)),
    http.get('*/api/v1/refs/districts', ({ request }) => {
      const regionId = new URL(request.url).searchParams.get('region_id');
      return HttpResponse.json(
        regionId ? DISTRICTS.filter((d) => d.region_id === regionId) : DISTRICTS,
      );
    }),
    // `parent_id` is a STRICT filter: absent means "top level only". The tree
    // walk in `admin/api.ts::listOrganizationTree` depends on exactly this.
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const parentId = new URL(request.url).searchParams.get('parent_id');
      const items = ORGANIZATIONS.filter((o) => (o.parent_id ?? null) === parentId);
      return HttpResponse.json(page(items));
    }),
  ];
}
