/**
 * The always-visible FAQ reader (`faq` tab, no permission gate). One
 * unfiltered fetch — `usePublicFaq()` with `category` left `undefined` — and
 * then category filtering happens entirely client-side: this is a FAQ, not
 * a paged registry, so a full list in hand is cheap and a second round trip
 * per filter change would not be.
 *
 * `GET /help/faq` already orders by `(sort_order, created_at)`
 * (`help.repo.list_faq`), so the reader never re-sorts what it receives.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FormField, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickName } from '../format';
import type { FaqOut } from './api';
import { usePublicFaq } from './queries';

/** Not a real category code — the `<Select>`'s own "show everything" option,
 *  chosen so it can never collide with a category value the backend hands
 *  back (a free `str | None` column, `help.schemas.FaqOut.category`). */
const ALL_CATEGORIES = '__all__';

interface Group {
  category: string | null;
  items: FaqOut[];
}

/** Groups while preserving the server's own ordering — both across groups
 *  (the first item of a new category decides where its group appears) and
 *  within one. */
function groupByCategory(items: FaqOut[]): Group[] {
  const order: (string | null)[] = [];
  const byCategory = new Map<string | null, FaqOut[]>();
  for (const item of items) {
    const key = item.category ?? null;
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
      order.push(key);
    }
    byCategory.get(key)!.push(item);
  }
  return order.map((category) => ({ category, items: byCategory.get(category)! }));
}

export function FaqReaderTab() {
  const t = useT();
  const { lang } = useLanguage();
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const list = usePublicFaq();
  const items = useMemo(() => list.data ?? [], [list.data]);

  // Distinct, non-null category codes present in THIS fetch — rendered
  // verbatim as they appear in the data (never translated: a category is an
  // operator-typed free-text code, not a fixed vocabulary this UI owns).
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      if (item.category) seen.add(item.category);
    }
    return Array.from(seen);
  }, [items]);

  const filtered = category === ALL_CATEGORIES ? items : items.filter((item) => item.category === category);
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div className="space-y-5" data-testid="faq-reader-tab">
      <div>
        <h2 className="text-base font-bold text-[#1A1F24]">{t('support.faq.reader.title')}</h2>
        <p className="mt-1 text-xs text-[#5A646D]">{t('support.faq.reader.subtitle')}</p>
      </div>

      {categories.length > 0 && (
        <div className="max-w-xs">
          <FormField label={t('support.faq.reader.categoryLabel')} htmlFor="faq-reader-category">
            <Select
              id="faq-reader-category"
              data-testid="faq-reader-category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: ALL_CATEGORIES, label: t('support.faq.reader.categoryAll') },
                ...categories.map((code) => ({ value: code, label: code })),
              ]}
            />
          </FormField>
        </div>
      )}

      {list.error && (
        <div
          role="alert"
          data-testid="faq-reader-error"
          className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
        >
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : t('support.faq.reader.loadFailed')}
        </div>
      )}

      {list.isLoading ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">
          <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" /> {t('support.common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#5A646D]" data-testid="faq-reader-empty">
          {t('support.faq.reader.empty')}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category ?? '__none__'} className="space-y-2">
              {groups.length > 1 && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
                  {group.category ?? t('support.faq.reader.noCategory')}
                </h3>
              )}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <FaqItem key={item.id} item={item} lang={lang} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqItem({ item, lang }: { item: FaqOut; lang: 'uz_latn' | 'ru' }) {
  return (
    <details
      className="rounded-xl border border-[#E4E7EA] bg-white p-4 open:shadow-xs"
      data-testid={`faq-item-${item.id}`}
    >
      <summary className="cursor-pointer text-sm font-semibold text-[#1A1F24] marker:content-none">
        {pickName(item.question, lang)}
      </summary>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#5A646D]">
        {pickName(item.answer, lang)}
      </p>
    </details>
  );
}
