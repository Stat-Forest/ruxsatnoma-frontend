import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { formatDate } from './format';
import { useStartTask, useTasksList, type TaskOut } from './queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../lib/rowClick';

const PAGE_SIZE = 20;

type TaskStatusFilter = '' | 'assigned' | 'in_progress' | 'done' | 'cancelled';

/** `StatusBadge`'s own `StatusType` enum knows nothing about a task's
 *  statuses — mapped onto the closest colour bucket; the visible TEXT is
 *  always overridden via `label` below, never `StatusBadge`'s own default
 *  copy (Uzbek-only, a different vocabulary). */
const TASK_STATUS_BADGE: Record<string, StatusType> = {
  assigned: 'pending',
  in_progress: 'warning',
  done: 'approved',
  cancelled: 'rejected',
};

const TASK_STATUS_LABEL_KEY: Record<string, string> = {
  assigned: 'inspector.tasks.status.assigned',
  in_progress: 'inspector.tasks.status.inProgress',
  done: 'inspector.tasks.status.done',
  cancelled: 'inspector.tasks.status.cancelled',
};

const KIND_LABEL_KEY: Record<string, string> = {
  pre_approval_visit: 'inspector.tasks.kind.preApprovalVisit',
  permit_inspection: 'inspector.tasks.kind.permitInspection',
};

/** `TaskOut.status`/`.kind` are plain `string` on the wire (no enum in the
 *  contract) — an unrecognised value (a future kind/status this list has
 *  never seen) falls back to the raw code rather than crashing or rendering
 *  a translation-key placeholder to the operator. */
function labelOr(map: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

function referenceLine(task: TaskOut, t: (key: string) => string): string | null {
  if (task.permit_id) return `${t('inspector.tasks.permitRefLabel')} ${task.permit_id.slice(0, 8)}`;
  if (task.application_id) return `${t('inspector.tasks.applicationRefLabel')} ${task.application_id.slice(0, 8)}`;
  if (task.contour_id) return `${t('inspector.tasks.contourRefLabel')} ${task.contour_id.slice(0, 8)}`;
  return null;
}

function TaskCard({ task }: { task: TaskOut }) {
  const { me } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();
  const navigate = useNavigate();
  const startTask = useStartTask();

  // `POST /tasks/{id}/start` requires `assigned_to == self`, unconditionally
  // — no permission bypasses it (service.py), so this button is hidden for
  // anyone else even if they can see the task via `view_any`.
  const canStart = !!me && task.status === 'assigned' && task.assigned_to === me.user.id;
  const reference = referenceLine(task, t);

  return (
    <div
      {...clickableRowProps(() => navigate(`/inspections/tasks/${task.id}`))}
      className={`bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2 ${CLICKABLE_ROW_CLASS}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[#1A1F24]">{labelOr(KIND_LABEL_KEY, task.kind, t)}</p>
          <p className="text-xs text-[#5A646D] mt-0.5">
            {t('inspector.tasks.dueAtLabel')} {formatDate(task.due_at)}
          </p>
          {reference && <p className="text-xs text-[#5A646D] mt-0.5 font-mono">{reference}</p>}
        </div>
        <StatusBadge
          status={TASK_STATUS_BADGE[task.status] ?? 'info'}
          label={labelOr(TASK_STATUS_LABEL_KEY, task.status, t)}
          size="sm"
          showIcon={false}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button size="touch" variant="outline" fullWidth onClick={() => navigate(`/inspections/tasks/${task.id}`)}>
          {t('inspector.tasks.openButton')}
        </Button>
        {canStart && (
          <Button
            size="touch"
            variant="primary"
            fullWidth
            isLoading={startTask.isPending}
            onClick={() => startTask.mutate(task.id)}
          >
            {t('inspector.tasks.startButton')}
          </Button>
        )}
      </div>
      {startTask.isError && startTask.variables === task.id && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {startTask.error instanceof ApiError ? errorText(startTask.error) : ''}
        </p>
      )}
    </div>
  );
}

/**
 * С15/С16 — the inspector's own assigned tasks; `InspectionsPage`'s default
 * tab (what the inspector opens this screen FOR, day to day). `useTasksList`
 * narrows to "my own" server-side for a plain inspector
 * (`service.py::list_tasks`) — the status filter and pagination here are
 * just the UI around that.
 */
export function TasksTab({ active }: { active: boolean }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [status, setStatus] = useState<TaskStatusFilter>('');
  const [page, setPage] = useState(1);

  const filters = { status: status || undefined, page, page_size: PAGE_SIZE };
  const list = useTasksList(filters, { enabled: active });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4" data-testid="inspector-tasks-tab">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Select
            touchSize
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatusFilter);
              setPage(1);
            }}
            options={[
              { value: '', label: t('inspector.tasks.status.all') },
              { value: 'assigned', label: t('inspector.tasks.status.assigned') },
              { value: 'in_progress', label: t('inspector.tasks.status.inProgress') },
              { value: 'done', label: t('inspector.tasks.status.done') },
              { value: 'cancelled', label: t('inspector.tasks.status.cancelled') },
            ]}
          />
        </div>
        <ExportXlsxButton path="/api/v1/inspections/tasks" query={filters} className="w-full sm:w-auto sm:ml-auto" />
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('inspector.tasks.loadError')}
        </div>
      )}

      {list.isLoading ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.tasks.loading')}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">{t('inspector.tasks.empty')}</div>
      ) : (
        <div className="space-y-3">
          {list.data!.items.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {list.data && list.data.total > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
      )}
    </div>
  );
}
