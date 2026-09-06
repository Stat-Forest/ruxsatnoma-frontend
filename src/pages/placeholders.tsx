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

// F1-F4 — real screen, Track F1 of the stage 4+6 fleet (`./gis/GisPage.tsx`):
// contour map (draw/edit/split), the version lifecycle, geodata import and
// the restriction/protection/fire-ban layers. Re-exported rather than
// defined here for the same reason `MyApplicationsPage` above is.
export { GisPage } from './gis/GisPage';

// F5-F7 — the real screen (`src/pages/norms/NormsPage.tsx`), re-exported
// rather than defined here for the same reason `MyApplicationsPage` is.
export { NormsPage } from './norms/NormsPage';

/** Track F3 — the accountant's whole workspace (screens G1–G5, real screen). */
export { AccountantWorkspace as InvoicesPage } from './accountant/AccountantWorkspace';

// Track 4 — real screen: the staff permit registry
// (`src/pages/permits/PermitsPage.tsx`).
export { PermitsPage } from './permits/PermitsPage';

// C4 — the real screen (`src/pages/notifications/NotificationsPage.tsx`),
// re-exported rather than defined here for the same reason
// `MyApplicationsPage` is.
export { NotificationsPage } from './notifications/NotificationsPage';

// C5 — the real screen (`src/pages/admin/profile/ProfilePage.tsx`), re-exported
// rather than defined here for the same reason `MyApplicationsPage` is.
export { ProfilePage } from './admin/profile/ProfilePage';

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

// J2 (stage 6.7) — the central apparatus's reporting screens, С20 (real
// screen: `src/pages/reports/ReportsPage.tsx`). Re-exported rather than
// defined here for the same reason `MyApplicationsPage` above is.
export { ReportsPage } from './reports/ReportsPage';

/** J2 (stage 6.7) — one report's own lifecycle page (real screen). */
export { ReportDetailPage } from './ReportDetailPage';
