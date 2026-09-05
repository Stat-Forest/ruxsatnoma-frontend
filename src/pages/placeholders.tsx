import { ApplicationsListPage } from './staff/ApplicationsListPage';
import { StaffApplicationCard } from './staff/StaffApplicationCard';

/**
 * Trivial placeholders — ruling R3. `navigation.test.tsx`'s last test asserts that
 * every `NAVIGATION` entry points at a route that exists, so each of the eleven
 * entries needs a routed page; `/admin/users` reuses the existing `UsersPage`.
 * Each of these is replaced by a real screen as stages 6.1-6.5 land — nothing
 * about the route table or `NAVIGATION` changes shape when that happens.
 */
// B1/C3 — real screen for the applicant, the same placeholder body as before
// for every other role (`src/pages/dashboard/DashboardPage.tsx` holds both
// branches and the reasoning for the split). Re-exported rather than defined
// here for the same reason `MyApplicationsPage` below is.
export { DashboardPage } from './dashboard/DashboardPage';

// B6 — real screen, Track 2 (the applicant's path). Re-exported rather than
// defined here so `routes.tsx`'s import list needs no change and the other
// parallel tracks' own placeholder bodies below stay untouched.
export { MyApplicationsPage } from './applicant/MyApplicationsPage';

// Track 4 — real screen: the applicant's own permit list
// (`src/pages/permits/MyPermitsPage.tsx`). Re-exported rather than defined
// here for the same reason `MyApplicationsPage` above is.
export { MyPermitsPage } from './permits/MyPermitsPage';

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

// Track 4 — real screen: the staff permit registry
// (`src/pages/permits/PermitsPage.tsx`).
export { PermitsPage } from './permits/PermitsPage';

export function NotificationsPage() {
  return <div data-testid="notifications-page">Bildirishnomalar</div>;
}

export function ProfilePage() {
  return <div data-testid="profile-page">Profil</div>;
}

// B7/B8 — real screens, Track 2 (the applicant's path). Re-exported rather
// than defined here, same reasoning as `MyApplicationsPage` above.
export { ApplicationWizardPage } from './applicant/wizard/ApplicationWizardPage';
export { MyApplicationCardPage } from './applicant/MyApplicationCardPage';

/** B9 — invoice and payment through Payme (Track 4 — real screen). */
export { MyInvoicePage } from './MyInvoicePage';

/** B10 — the applicant's own permit: view, download PDF, sign with ERI (Track 4 — real screen). */
export { MyPermitPage } from './MyPermitPage';

/** Track 3 — the staff application card (`src/pages/staff/StaffApplicationCard.tsx`):
 * take into work, checks, GIS conclusion, calculation, documents, history and
 * the decide/reject actions with the over-limit forward rendered honestly. */
export function StaffApplicationCardPage() {
  return <StaffApplicationCard />;
}

/** The permit document as staff sees it — issue, download PDF, the 3+1 ERI signatures (Track 4 — real screen). */
export { PermitDocumentPage } from './PermitDocumentPage';
