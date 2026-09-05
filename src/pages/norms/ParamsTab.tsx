/**
 * Rule parameters — stub for tasks 3 (list/filters) and 4 (create/edit
 * dialog, `norms.params.*` copy). A bare, no-props component on purpose —
 * see `NormsPage.tsx` for why it stays mounted while another tab is active.
 */
export function ParamsTab() {
  return (
    <div
      data-testid="norms-tab-params"
      className="rounded-2xl border border-dashed border-[#E4E7EA] p-8 text-center text-sm text-[#5A646D]"
    >
      Rule parameters screen — tasks 3-4.
    </div>
  );
}
