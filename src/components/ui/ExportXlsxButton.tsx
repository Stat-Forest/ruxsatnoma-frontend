/**
 * Stage 13 (ruling #204): the export button every register renders — the
 * registers only, since ruling #207 took it off the settings, content and
 * personal screens; it sits last in the filter row, hugging the right edge
 * (`ml-auto` from the screen), and reads «Yuklab olish» / «Экспорт».
 *
 * A screen hands it the list route and the SAME query object its list
 * request uses (filters, search — paging keys are stripped downstream), and
 * nothing else: the file is built on the server from the same service call
 * the screen reads, so what the file holds is what the screen would show,
 * page after page. The UI language picks the header language.
 *
 * Renders its own feedback under the button — the truncation warning
 * (ruling R3: the server never refuses past the cap, it cuts and says so)
 * and the refusal message — so a screen adds one line, not three states.
 */
import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useLanguage, useT } from '../../i18n/useT';
import { downloadXlsx, exportLang, type ExportQuery, type ExportResult } from '../../lib/xlsxExport';
import { Alert } from './Feedback';
import { Button } from './button';

export interface ExportXlsxButtonProps {
  /** The list route, e.g. `/api/v1/applications` — the export is its `/export.xlsx` sibling. */
  path: string;
  /** The list's own query object, verbatim. */
  query: ExportQuery;
  disabled?: boolean;
  className?: string;
}

export function ExportXlsxButton({ path, query, disabled = false, className }: ExportXlsxButtonProps) {
  const t = useT();
  const { lang } = useLanguage();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setResult(null);
    setError(null);
    try {
      setResult(await downloadXlsx(path, query, exportLang(lang)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('export.error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        isLoading={pending}
        disabled={disabled}
        leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
        data-testid="export-xlsx"
        onClick={() => void handleClick()}
      >
        {t('export.xlsxButton')}
      </Button>
      {result?.truncated && (
        <Alert variant="warning" className="mt-2">
          {t('export.truncated')
            .replace('{rows}', String(result.rows))
            .replace('{total}', String(result.total))}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
