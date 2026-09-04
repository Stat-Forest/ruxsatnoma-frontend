import { ApplicationsListPage } from './staff/ApplicationsListPage';
import { StaffApplicationCard } from './staff/StaffApplicationCard';

/**
 * Trivial placeholders — ruling R3. `navigation.test.tsx`'s last test asserts that
 * every `NAVIGATION` entry points at a route that exists, so each of the eleven
 * entries needs a routed page; `/admin/users` reuses the existing `UsersPage`.
 * Each of these is replaced by a real screen as stages 6.1-6.5 land — nothing
 * about the route table or `NAVIGATION` changes shape when that happens.
 */
export function DashboardPage() {
  return <div data-testid="dashboard-page">Bosh sahifa</div>;
}

// B6 — real screen, Track 2 (the applicant's path). Re-exported rather than
// defined here so `routes.tsx`'s import list needs no change and the other
// parallel tracks' own placeholder bodies below stay untouched.
export { MyApplicationsPage } from './applicant/MyApplicationsPage';

export function MyPermitsPage() {
  return <div data-testid="my-permits-page">Mening ruxsatnomalarim</div>;
}

/** Track 3 — the staff worklist (`src/pages/staff/ApplicationsListPage.tsx`). */
export function ApplicationsPage() {
  return <ApplicationsListPage />;
}

export function GisPage() {
  return <div data-testid="gis-page">GIS xaritasi</div>;
}

export function NormsPage() {
  return <div data-testid="norms-page">Me'yorlar</div>;
}

export function InvoicesPage() {
  return <div data-testid="invoices-page">Hisob-fakturalar</div>;
}

export function PermitsPage() {
  return <div data-testid="permits-page">Ruxsatnomalar</div>;
}

export function NotificationsPage() {
  return <div data-testid="notifications-page">Bildirishnomalar</div>;
}

export function ProfilePage() {
  return <div data-testid="profile-page">Profil</div>;
}

/**
 * Detail/action screens (`routes.tsx`'s `DETAIL_ROUTES`) — reached only by
 * following a link from an already-rendered screen, never from the left
 * menu, so unlike the ones above they list the API routes the real screen
 * will call: the next session building it starts from that list instead of
 * re-deriving it from `docs/plans/06-frontend-screens.md`.
 */
function DetailPlaceholder({ testId, title, apiRoutes }: { testId: string; title: string; apiRoutes: string[] }) {
  return (
    <div data-testid={testId}>
      <h1 className="text-lg font-bold text-[#1A1F24]">{title}</h1>
      <ul className="mt-2 text-sm text-[#5A646D] list-disc pl-5">
        {apiRoutes.map((route) => (
          <li key={route}>{route}</li>
        ))}
      </ul>
    </div>
  );
}

// B7/B8 — real screens, Track 2 (the applicant's path). Re-exported rather
// than defined here, same reasoning as `MyApplicationsPage` above.
export { ApplicationWizardPage } from './applicant/wizard/ApplicationWizardPage';
export { MyApplicationCardPage } from './applicant/MyApplicationCardPage';

/** B9 — invoice and payment through Payme. */
export function MyInvoicePage() {
  return (
    <DetailPlaceholder
      testId="my-invoice-page"
      title="Hisob-faktura va to'lov"
      apiRoutes={['GET /api/v1/invoices/{id}', 'POST /api/v1/invoices/{id}/pay-intents']}
    />
  );
}

/** B10 — the applicant's own permit: view, download PDF, sign with ERI. */
export function MyPermitPage() {
  return (
    <DetailPlaceholder
      testId="my-permit-page"
      title="Mening ruxsatnomam"
      apiRoutes={[
        'GET /api/v1/permits/{id}',
        'GET /api/v1/permits/{id}/pdf',
        'POST /api/v1/permits/{id}/signatures',
      ]}
    />
  );
}

/** Track 3 — the staff application card (`src/pages/staff/StaffApplicationCard.tsx`):
 * take into work, checks, GIS conclusion, calculation, documents, history and
 * the decide/reject actions with the over-limit forward rendered honestly. */
export function StaffApplicationCardPage() {
  return <StaffApplicationCard />;
}

/** The permit document as staff sees it — issue, download PDF, the 3+1 ERI signatures. */
export function PermitDocumentPage() {
  return (
    <DetailPlaceholder
      testId="permit-document-page"
      title="Ruxsatnoma hujjati"
      apiRoutes={[
        'GET /api/v1/permits/{id}',
        'GET /api/v1/permits/{id}/pdf',
        'POST /api/v1/applications/{id}/permit',
        'POST /api/v1/permits/{id}/signatures',
      ]}
    />
  );
}
