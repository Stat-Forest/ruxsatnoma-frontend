/**
 * Staff FAQ management (`faq-admin` tab) — visible only once `SupportPage`
 * has already gated it on `help.faq.manage`; this component does not
 * re-check the permission itself, the same way `AccountantWorkspace`'s own
 * tabs don't re-check `payments.view`/`.confirm` internally either.
 *
 * `GET /admin/help/faq` returns a bare list, not a `Page` envelope
 * (`help.admin_router::list_faq`) — no pagination component here.
 */
import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickName } from '../format';
import type { FaqOut, FaqStatus } from './api';
import { FaqFormModal } from './FaqFormModal';
import { useFaqAdmin, usePatchFaq } from './queries';

const FAQ_STATUSES: FaqStatus[] = ['draft', 'published', 'archived'];

const STATUS_META: Record<FaqStatus, { labelKey: string; className: string }> = {
  draft: { labelKey: 'support.faq.admin.statusDraft', className: 'bg-[#F1F2F3] text-[#5A646D]' },
  published: { labelKey: 'support.faq.admin.statusPublished', className: 'bg-[#F0F7F1] text-[#166534]' },
  archived: { labelKey: 'support.faq.admin.statusArchived', className: 'bg-[#FFFBEB] text-[#92400E]' },
};

function isFaqStatus(value: string): value is FaqStatus {
  return FAQ_STATUSES.includes(value as FaqStatus);
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const meta = isFaqStatus(status) ? STATUS_META[status] : null;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta?.className ?? 'bg-[#F1F2F3] text-[#5A646D]'}`}>
      {label}
    </span>
  );
}

export function FaqAdminTab() {
  const t = useT();
  const { lang } = useLanguage();
  const [status, setStatus] = useState<FaqStatus | ''>('');
  const [editing, setEditing] = useState<{ faq: FaqOut | null } | null>(null);

  const list = useFaqAdmin(status || undefined);
  const patch = usePatchFaq();
  const items = list.data ?? [];

  return (
    <div className="space-y-5" data-testid="faq-admin-tab">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-bold text-[#1A1F24]">{t('support.faq.admin.title')}</h2>
          <p className="mt-1 text-xs text-[#5A646D]">{t('support.faq.admin.subtitle')}</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({ faq: null })}>
          {t('support.faq.admin.create')}
        </Button>
      </div>

      <div className="max-w-xs">
        <FormField label={t('support.faq.admin.filterStatus')} htmlFor="faq-admin-status-filter">
          <Select
            id="faq-admin-status-filter"
            data-testid="faq-admin-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as FaqStatus | '')}
            options={[
              { value: '', label: t('support.common.all') },
              ...FAQ_STATUSES.map((s) => ({ value: s, label: t(STATUS_META[s].labelKey) })),
            ]}
          />
        </FormField>
      </div>

      {list.error && (
        <div role="alert" data-testid="faq-admin-error" className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : t('support.faq.admin.loadFailed')}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E7EA] bg-[#F8F9FA] text-[11px] font-bold uppercase text-[#5A646D]">
                <th className="p-3">{t('support.faq.admin.colQuestion')}</th>
                <th className="p-3">{t('support.faq.admin.colCategory')}</th>
                <th className="p-3">{t('support.faq.admin.colStatus')}</th>
                <th className="p-3">{t('support.faq.admin.colSort')}</th>
                <th className="p-3 text-right">{t('support.faq.admin.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" /> {t('support.common.loading')}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#5A646D]" data-testid="faq-admin-empty">
                    {t('support.faq.admin.empty')}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} data-testid={`faq-admin-row-${item.id}`} data-status={item.status} className="align-top hover:bg-[#F8F9FA]">
                    <td className="p-3">
                      <span className="block max-w-[320px] truncate text-[#1A1F24]" title={pickName(item.question, lang)}>
                        {pickName(item.question, lang)}
                      </span>
                    </td>
                    <td className="p-3 text-[#5A646D]">{item.category ?? '—'}</td>
                    <td className="p-3">
                      <StatusPill status={item.status} label={isFaqStatus(item.status) ? t(STATUS_META[item.status].labelKey) : item.status} />
                    </td>
                    <td className="p-3 text-[#5A646D]">{item.sort_order}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing({ faq: item })}>
                          {t('support.common.edit')}
                        </Button>
                        {item.status !== 'published' && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={patch.isPending}
                            onClick={() => patch.mutate({ faqId: item.id, body: { status: 'published' } })}
                          >
                            {t('support.faq.admin.actionPublish')}
                          </Button>
                        )}
                        {item.status !== 'archived' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            isLoading={patch.isPending}
                            onClick={() => patch.mutate({ faqId: item.id, body: { status: 'archived' } })}
                          >
                            {t('support.faq.admin.actionArchive')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <FaqFormModal faq={editing.faq} onClose={() => setEditing(null)} />}
    </div>
  );
}
