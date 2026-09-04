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
