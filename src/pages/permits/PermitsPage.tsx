import { PermitsListPage } from './PermitsListPage';

/**
 * The staff permit registry — `GET /permits`, gated on `permits.view_any`
 * (`shell/navigation.ts`'s own entry for `/permits`). Was a bare placeholder
 * (`src/pages/placeholders.tsx`); this is the real screen the "Ruxsatnomalar"
 * menu entry had never been given.
 */
export function PermitsPage() {
  return <PermitsListPage variant="staff" />;
}
