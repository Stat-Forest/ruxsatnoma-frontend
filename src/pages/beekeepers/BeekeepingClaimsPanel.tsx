import { useState } from "react";
import { useLanguage, useT } from "../../i18n/useT";
import { ApiError } from "../../api/errors";
import { useApiErrorText } from "../../i18n/useApiErrorText";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { FormField, Select } from "../../components/ui/FormControls";
import { formatDate, pickName } from "../applicant/format";
import { statusLabel, type ApplicationStatus } from "../staff/format";
import { useBeekeepingClaims } from "./queries";
import type { BeekeepingClaimStatus, BenefitClaimMonitorOut } from "./api";

const PAGE_SIZE = 20;

/** The statuses worth a filter on a monitoring list: filed, being decided,
 * and the two ends of the road. Everything else (invoiced, paid, expired
 * unpaid, closed, archived) reads fine under "all". */
const FILTER_STATUSES: BeekeepingClaimStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "PERMIT_ISSUED",
  "REJECTED",
];

const VERIFICATION_BADGE_CLASS: Record<string, string> = {
  verified: "bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]",
  pending: "bg-[#FFF7E6] text-[#7A4B00] border-[#F5DCA8]",
  rejected: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  not_required: "bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]",
};

/**
 * Ruling #217 — the Union's own monitoring: every application in the
 * country that claims `beekeeping_union_member`, with the claim's fate and
 * the application's status, read-only. Odilxon: «у ўз кабинетида уюшмага
 * асалари боқиш учун рухсат олганлар тўғрисида маълумотни мониторинг
 * қилади». The registrar holds no application read code, so nothing here
 * links into a card — the row IS everything the role may see.
 */
export function BeekeepingClaimsPanel() {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [status, setStatus] = useState<BeekeepingClaimStatus | "">("");
  const [page, setPage] = useState(1);

  const list = useBeekeepingClaims({
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<BenefitClaimMonitorOut>[] = [
    {
      key: "number",
      header: t("beekeepers.claims.col.number"),
      accessor: (row) => (
        <span className="font-mono text-xs">{row.number ?? "—"}</span>
      ),
    },
    {
      key: "applicant",
      header: t("beekeepers.claims.col.applicant"),
      accessor: (row) => row.applicant_name,
    },
    {
      key: "certificateNo",
      header: t("beekeepers.claims.col.certificateNo"),
      accessor: (row) => (
        <span className="font-mono text-xs">
          {row.benefit_certificate_no ?? "—"}
        </span>
      ),
    },
    {
      key: "organization",
      header: t("beekeepers.claims.col.organization"),
      accessor: (row) => pickName(row.organization_name, lang) || "—",
    },
    {
      key: "period",
      header: t("beekeepers.claims.col.period"),
      accessor: (row) =>
        `${formatDate(row.period_from)} — ${formatDate(row.period_to)}`,
    },
    {
      key: "verification",
      header: t("beekeepers.claims.col.verification"),
      accessor: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${VERIFICATION_BADGE_CLASS[row.benefit_verification_status] ?? VERIFICATION_BADGE_CLASS.not_required}`}
        >
          {t(
            `beekeepers.claims.verification.${row.benefit_verification_status}`,
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: t("beekeepers.claims.col.status"),
      accessor: (row) => statusLabel(row.status as ApplicationStatus, lang),
    },
  ];

  return (
    <div className="space-y-5" data-testid="beekeeping-claims-panel">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label={t("beekeepers.claims.filters.status")}>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as BeekeepingClaimStatus | "");
                setPage(1);
              }}
              options={[
                { value: "", label: t("beekeepers.filters.all") },
                ...FILTER_STATUSES.map((value) => ({
                  value,
                  label: statusLabel(value as ApplicationStatus, lang),
                })),
              ]}
              data-testid="beekeeping-claims-filter-status"
            />
          </FormField>
        </div>
      </div>

      {list.error && (
        <div
          className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]"
          role="alert"
        >
          {list.error instanceof ApiError
            ? errorText(list.error)
            : t("beekeepers.loadError")}
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        emptyTitle={t("beekeepers.claims.empty")}
        emptyDescription=""
        pagination={{
          currentPage: page,
          totalPages,
          onPageChange: setPage,
          totalRecords: total,
        }}
      />
    </div>
  );
}
