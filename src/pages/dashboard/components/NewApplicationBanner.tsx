import { useNavigate } from 'react-router';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { useT } from '../../../i18n/useT';

/**
 * The applicant's way into the wizard from the home screen. Filing is the one
 * thing a citizen comes here to do, and before this banner the only route to
 * it was the "My applications" menu entry — a figure-only home screen with no
 * action on it. It sits between the tiles and the charts so it is the first
 * thing below the numbers, without pushing the numbers down.
 */
export function NewApplicationBanner({ t }: { t: ReturnType<typeof useT> }) {
  const navigate = useNavigate();
  return (
    <section
      data-testid="new-application-banner"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-2xl p-4 sm:px-6"
    >
      <div className="flex items-start gap-3 min-w-0">
        <FilePlus2 className="w-6 h-6 text-[#2E7D4F] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#23653F] leading-snug">{t('dash.newApp.title')}</h2>
          <p className="text-xs sm:text-sm text-[#3E6B4E] mt-1 leading-relaxed">{t('dash.newApp.hint')}</p>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}
        onClick={() => navigate('/my/applications/new')}
        className="font-bold cursor-pointer w-full sm:w-auto shrink-0 justify-center"
      >
        {t('cabinet.applications.newApp')}
      </Button>
    </section>
  );
}
