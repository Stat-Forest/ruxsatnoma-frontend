/**
 * С15/С16 — one assigned task: what it is, where it points, and the three
 * transitions the backend actually allows from here (`service.py`):
 * `assigned -> in_progress|cancelled`, `in_progress -> done|cancelled`. No
 * button renders for a transition not in that table (house rule).
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/FormControls';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { INSPECTIONS_TASKS_MANAGE } from './permissions';
import { formatDate } from './format';
import {
  useCancelTask,
  useEligibleInspectors,
  useReassignTask,
  useStartTask,
  useTask,
  type TaskOut,
} from './queries';

const KIND_LABEL_KEY: Record<string, string> = {
  pre_approval_visit: 'inspector.tasks.kind.preApprovalVisit',
  permit_inspection: 'inspector.tasks.kind.permitInspection',
};
const STATUS_LABEL_KEY: Record<string, string> = {
  assigned: 'inspector.tasks.status.assigned',
  in_progress: 'inspector.tasks.status.inProgress',
  done: 'inspector.tasks.status.done',
  cancelled: 'inspector.tasks.status.cancelled',
};

function labelOr(map: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-[#F0F2F4] last:border-0 text-sm">
      <dt className="text-[#5A646D]">{label}</dt>
      <dd className="font-semibold text-[#1A1F24] text-right">{value}</dd>
    </div>
  );
}

/**
 * The handover dialog (stage 7.6, ruling R6/#138): hand this task to another
 * inspector without discarding it the way `cancel` does (finding F4, second
 * shape — until this stage the only way off a task was `cancel`, which loses
 * the due date and the trail).
 *
 * The candidate list (`useEligibleInspectors`) is already narrowed to the
 * organization the backend's own zone check will accept, so a cross-
 * organization pick is not something the operator can even select here —
 * they never reach `ERR-ACL-002` by being refused. The currently assigned
 * inspector is dropped from the list: reassigning to the same person is not
 * a handover.
 */
function HandoverBlock({ task }: { task: TaskOut }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [selected, setSelected] = useState('');
  const candidates = useEligibleInspectors(task.organization_id);
  const reassign = useReassignTask();

  const options = (candidates.data ?? []).filter((candidate) => candidate.id !== task.assigned_to);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs" data-testid="task-handover-block">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
        {t('inspector.taskDetail.handoverTitle')}
      </p>

      {candidates.error ? (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {candidates.error instanceof ApiError ? errorText(candidates.error) : t('inspector.taskDetail.handoverCandidatesError')}
        </p>
      ) : (
        <Select
          touchSize
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={candidates.isLoading}
          options={[
            { value: '', label: t('inspector.taskDetail.handoverPlaceholder') },
            ...options.map((candidate) => ({ value: candidate.id, label: candidate.full_name })),
          ]}
        />
      )}

      <Button
        size="touch"
        variant="secondary"
        fullWidth
        disabled={selected === ''}
        isLoading={reassign.isPending}
        onClick={() => reassign.mutate({ taskId: task.id, newAssigneeId: selected }, { onSuccess: () => setSelected('') })}
      >
        {t('inspector.taskDetail.handoverButton')}
      </Button>

      {reassign.isError && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {reassign.error instanceof ApiError ? errorText(reassign.error) : ''}
        </p>
      )}
    </div>
  );
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();
  const navigate = useNavigate();

  const taskQuery = useTask(id);
  const startTask = useStartTask();
  const cancelTask = useCancelTask();

  if (taskQuery.isLoading) {
    return (
      <div className="py-16 text-center text-sm text-[#5A646D]" data-testid="task-detail-page">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.taskDetail.loading')}
      </div>
    );
  }

  if (taskQuery.error || !taskQuery.data) {
    return (
      <div className="py-16 text-center text-sm text-[#991B1B]" data-testid="task-detail-page" role="alert">
        {taskQuery.error instanceof ApiError ? errorText(taskQuery.error) : t('inspector.taskDetail.notFound')}
      </div>
    );
  }

  const task = taskQuery.data;
  const canStart = !!me && task.status === 'assigned' && task.assigned_to === me.user.id;
  const canCancel =
    !!me &&
    (me.is_superuser || me.permissions.includes(INSPECTIONS_TASKS_MANAGE)) &&
    task.status !== 'done' &&
    task.status !== 'cancelled';
  // Ruling R6/#138: the SAME rule as `canCancel` above — `TASKS_MANAGE`,
  // allowed from `assigned`/`in_progress`, refused once the task is
  // `done`/`cancelled` (nothing left to hand over). Kept as its own name
  // rather than reused inline so a later divergence between the two rules
  // does not have to be found by reading `canCancel`'s own history.
  const canReassign = canCancel;
  const canStartAct =
    !!me && task.assigned_to === me.user.id && (task.status === 'assigned' || task.status === 'in_progress');

  const actParams = new URLSearchParams();
  actParams.set('task_id', task.id);
  if (task.permit_id) actParams.set('permit_id', task.permit_id);
  if (task.application_id) actParams.set('application_id', task.application_id);

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="task-detail-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{t('inspector.taskDetail.title')}</h1>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <dl>
          <InfoRow label={t('inspector.taskDetail.kindLabel')} value={labelOr(KIND_LABEL_KEY, task.kind, t)} />
          <InfoRow label={t('inspector.taskDetail.statusLabel')} value={labelOr(STATUS_LABEL_KEY, task.status, t)} />
          <InfoRow label={t('inspector.tasks.dueAtLabel')} value={formatDate(task.due_at)} />
          {task.organization_id && (
            <InfoRow label={t('inspector.taskDetail.organizationLabel')} value={task.organization_id.slice(0, 8)} />
          )}
          <InfoRow label={t('inspector.taskDetail.assignedToLabel')} value={task.assigned_to.slice(0, 8)} />
        </dl>
      </div>

      {canReassign && <HandoverBlock task={task} />}

      {(task.permit_id || task.application_id) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {task.permit_id && (
            <Link
              to={`/permits/${task.permit_id}`}
              className="inline-flex items-center justify-center h-12 px-6 text-base font-semibold rounded-md border border-[#767F87] text-[#1A1F24] hover:bg-[#F8F9FA] w-full sm:w-auto"
            >
              {t('inspector.taskDetail.viewPermitButton')}
            </Link>
          )}
          {task.application_id && (
            <Link
              to={`/applications/${task.application_id}`}
              className="inline-flex items-center justify-center h-12 px-6 text-base font-semibold rounded-md border border-[#767F87] text-[#1A1F24] hover:bg-[#F8F9FA] w-full sm:w-auto"
            >
              {t('inspector.taskDetail.viewApplicationButton')}
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {canStart && (
          <Button
            size="touch"
            variant="primary"
            fullWidth
            isLoading={startTask.isPending}
            onClick={() => startTask.mutate(task.id)}
          >
            {t('inspector.taskDetail.startButton')}
          </Button>
        )}
        {canCancel && (
          <Button
            size="touch"
            variant="danger"
            fullWidth
            isLoading={cancelTask.isPending}
            onClick={() => cancelTask.mutate(task.id)}
          >
            {t('inspector.taskDetail.cancelButton')}
          </Button>
        )}
        {canStartAct && (
          <Button
            size="touch"
            variant="success"
            fullWidth
            onClick={() => navigate(`/inspections/acts/new?${actParams.toString()}`)}
          >
            {t('inspector.taskDetail.startActButton')}
          </Button>
        )}
      </div>

      {startTask.isError && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {startTask.error instanceof ApiError ? errorText(startTask.error) : ''}
        </p>
      )}
      {cancelTask.isError && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {cancelTask.error instanceof ApiError ? errorText(cancelTask.error) : ''}
        </p>
      )}
    </div>
  );
}
