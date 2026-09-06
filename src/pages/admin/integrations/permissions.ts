/** Mirrors `app/modules/admin/permissions.py` verbatim — verified against
 *  that file, not plan prose (this project's own lesson on permission codes).
 *  The list routes accept EITHER code (`require_any_permission`); only the
 *  two write actions — requeue, discard — require `INTEGRATIONS_MANAGE`. */
export const INTEGRATIONS_VIEW = 'admin.integrations.view';
export const INTEGRATIONS_MANAGE = 'admin.integrations.manage';
