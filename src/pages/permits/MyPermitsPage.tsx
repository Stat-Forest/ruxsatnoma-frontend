import { PermitsListPage } from './PermitsListPage';

/**
 * The applicant's own permit list — `GET /permits`, scoped server-side to
 * the caller's own applicant ids (`permits/service.py::list_permits`), so no
 * `applicant_id` filter is sent from here. Was a bare placeholder
 * (`src/pages/placeholders.tsx`); this is the real screen the "Mening
 * ruxsatnomalarim" menu entry (`/my/permits`) was routed to but never had.
 */
export function MyPermitsPage() {
  return <PermitsListPage variant="applicant" />;
}
