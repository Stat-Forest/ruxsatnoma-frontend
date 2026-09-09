import { AlertTriangle, MapPin } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useT, useLanguage } from '../../i18n/useT';
import { pickName } from '../applicant/format';
import { useZoneDistrictName, useZoneOrganizationName, useZoneRegionName } from './queries';

/**
 * Decision #70's consequence, rendered rather than left implicit (task
 * brief's own rule: "a zone field carries its consequence beside it").
 * `me.zone` (`ZoneOut`) decides which invoices `GET /invoices` actually
 * returns — an accountant with `organization_id` set sees one leshoz; an
 * EMPTY zone is not "no restriction shown", it is every leshoz in the
 * country, so that case gets its own warning tone rather than a quiet
 * absence of a banner.
 */
export function ZoneBanner() {
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();

  const zone = me?.zone;
  const organizationId = zone?.organization_id ?? null;
  const regionId = zone?.region_id ?? null;
  const districtId = zone?.district_id ?? null;

  const orgQuery = useZoneOrganizationName(organizationId);
  const regionQuery = useZoneRegionName(regionId);
  const districtQuery = useZoneDistrictName(districtId);

  if (!zone) return null;

  const isRepublicWide = organizationId === null && regionId === null && districtId === null;

  if (isRepublicWide) {
    return (
      <div
        data-testid="zone-banner-republic"
        className="flex items-start gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E] leading-relaxed break-words"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('accountant.zone.republicWarning')}</span>
      </div>
    );
  }

  // Most specific first: an organization (leshoz) narrows further than a
  // district, which narrows further than a region.
  const label = organizationId
    ? (orgQuery.data ? pickName(orgQuery.data.name, lang) : null)
    : districtId
      ? (districtQuery.data ? pickName(districtQuery.data.name, lang) : null)
      : regionId
        ? (regionQuery.data ? pickName(regionQuery.data.name, lang) : null)
        : null;

  return (
    <div
      data-testid="zone-banner-scoped"
      className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] p-3 text-xs text-[#1A1F24] leading-relaxed"
    >
      <MapPin className="h-4 w-4 shrink-0 text-[#5A646D]" />
      <span className="font-semibold text-[#5A646D] shrink-0">{t('accountant.zone.label')}</span>
      <span className="font-semibold break-words">{label ?? t('accountant.common.loading')}</span>
    </div>
  );
}
