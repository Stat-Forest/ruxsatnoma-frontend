/** Mirrors `app/modules/inspections/permissions.py` — verified against that
 *  file, not plan prose, per the project's own lesson on permission codes. */
export const INSPECTIONS_TASKS_MANAGE = 'inspections.tasks.manage'; // executor_staff, executor_head
export const INSPECTIONS_ACTS_WRITE = 'inspections.acts.write'; // inspector
export const INSPECTIONS_VIEW_ANY = 'inspections.view_any'; // executor_head, central_admin, leadership, prosecutor
export const INSPECTIONS_CASES_MANAGE = 'inspections.cases.manage'; // executor_head
export const INSPECTIONS_CHECKLISTS_MANAGE = 'inspections.checklists.manage'; // central_admin
