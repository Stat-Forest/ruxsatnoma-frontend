/**
 * С15/С16 — the inspector's own inspection acts (`GET /inspections/acts`,
 * `view_any` sees the zone, everyone else only `inspector_id == self` —
 * `service.py`), paginated the same way `TasksTab.tsx` (task 2) already
 * is. A "New inspection" button opens `ActFormPage` with NO query params —
 * the "activity without a permit" entry point the backend contract names
 * (`task_id`/`permit_id`/`application_id` all unset, a `gps` fix required
 * instead, `service.py`'s own create-time rule) — gated on
 * `inspections.acts.write`, since a `view_any`-only holder (e.g.
 * `executor_head`) can see this tab but `POST /acts` would refuse them.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { ApiError } from '../../api/errors';
import { formatDateTime } from './format';
import { INSPECTIONS_ACTS_WRITE } from './permissions';
import { useActsList, type ActOut } from './queries';

const PAGE_SIZE = 20;

type ResultFilter = '' | 'compliant' | 'warning' | 'violation';

/** Reuses `ActFormPage`'s own `result.*` copy (task 4) — the same three
 *  values, no reason for a second translation of the same words. */
const RESULT_LABEL_KEY: Record<string, string> = {
  compliant: 'inspector.actForm.result.compliant',
  warning: 'inspector.actForm.result.warning',
  violation: 'inspector.actForm.result.violation',
};

const RESULT_BADGE: Record<string, StatusType> = {
  compliant: 'approved',
  warning: 'warning',
  violation: 'rejected',
};

/** `ActOut.status`/`.result` are plain `string` on the wire — an
 *  unrecognised value falls back to the raw code rather than crashing or
 *  showing a translation-key placeholder. */
function labelOr(map: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

function ActRow({ act }: { act: ActOut }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[#1A1F24]">{formatDateTime(act.occurred_at)}</p>
          <p className="text-xs text-[#5A646D] mt-0.5 font-mono">{act.id.slice(0, 8)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={act.status === 'draft' ? 'draft' : 'approved'}
            label={act.status === 'draft' ? t('inspector.acts.status.draft') : t('inspector.acts.status.signed')}
            size="sm"
            showIcon={false}
          />
          {act.result && (
            <StatusBadge
              status={RESULT_BADGE[act.result] ?? 'info'}
              label={labelOr(RESULT_LABEL_KEY, act.result, t)}
              size="sm"
              showIcon={false}
            />
          )}
        </div>
      </div>
      <Button size="touch" variant="outline" fullWidth onClick={() => navigate(`/inspections/acts/${act.id}`)}>
        {t('inspector.acts.openButton')}
      </Button>
    </div>
  );
}

export function ActsTab({ active }: { active: boolean }) {
  const t = useT();
  const { me } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultFilter>('');
  const [page, setPage] = useState(1);

  const canCreate = !!me?.permissions.includes(INSPECTIONS_ACTS_WRITE);
  const list = useActsList({ result: result || undefined, page, page_size: PAGE_SIZE }, { enabled: active });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4" data-testid="inspector-acts-tab">
      {canCreate && (
        <div className="space-y-1">
          <Button
            size="touch"
            variant="primary"
            fullWidth
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/inspections/acts/new')}
          >
            {t('inspector.acts.newButton')}
          </Button>
          <p className="text-xs text-[#5A646D]">{t('inspector.acts.newButtonHint')}</p>
        </div>
      )}

      <div className="max-w-xs">
        <Select
          touchSize
          value={result}
          onChange={(e) => {
            setResult(e.target.value as ResultFilter);
            setPage(1);
          }}
          options={[
            { value: '', label: t('inspector.acts.status.all') },
            { value: 'compliant', label: t('inspector.actForm.result.compliant') },
            { value: 'warning', label: t('inspector.actForm.result.warning') },
            { value: 'violation', label: t('inspector.actForm.result.violation') },
          ]}
        />
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : t('inspector.acts.loadError')}
        </div>
      )}

      {list.isLoading ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.acts.loading')}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">{t('inspector.acts.empty')}</div>
      ) : (
        <div className="space-y-3">
          {list.data!.items.map((act) => (
            <ActRow key={act.id} act={act} />
          ))}
        </div>
      )}

      {list.data && list.data.total > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
      )}
    </div>
  );
}
