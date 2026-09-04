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

export function MyApplicationsPage() {
  return <div data-testid="my-applications-page">Mening arizalarim</div>;
}

export function MyPermitsPage() {
  return <div data-testid="my-permits-page">Mening ruxsatnomalarim</div>;
}

export function ApplicationsPage() {
  return <div data-testid="applications-page">Arizalar</div>;
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

/** B7 — the application wizard (contour, period, activity, price preview, ERI, submit). */
export function ApplicationWizardPage() {
  return (
    <DetailPlaceholder
      testId="application-wizard-page"
      title="Ariza topshirish"
      apiRoutes={[
        'GET /api/v1/gis/contours',
        'POST /api/v1/calculations/preview',
        'POST /api/v1/files',
        'POST /api/v1/applications',
        'PATCH /api/v1/applications/{id}',
        'POST /api/v1/applications/{id}/documents',
        'POST /api/v1/applications/{id}/precheck',
        'POST /api/v1/applications/{id}/submit',
      ]}
    />
  );
}

/** B8 — the applicant's own application card: status, timeline, checks, documents. */
export function MyApplicationCardPage() {
  return (
    <DetailPlaceholder
      testId="my-application-card-page"
      title="Ariza kartochkasi"
      apiRoutes={['GET /api/v1/applications/{id}', 'GET /api/v1/applications/{id}/timeline']}
    />
  );
}

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

/** The application card as staff sees it — take into work, decide, over-limit forwarding. */
export function StaffApplicationCardPage() {
  return (
    <DetailPlaceholder
      testId="staff-application-card-page"
      title="Ariza kartochkasi (xodim)"
      apiRoutes={[
        'GET /api/v1/applications/{id}',
        'GET /api/v1/applications/{id}/timeline',
        'POST /api/v1/applications/{id}/start-review',
        'POST /api/v1/applications/{id}/approve',
        'POST /api/v1/applications/{id}/reject',
      ]}
    />
  );
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
