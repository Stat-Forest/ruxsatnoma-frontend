/**
 * H9's editor. One modal for both "new template" and "new version of this
 * template", because they post the same `TemplateIn` body and differ only in
 * the route and in what the header has to say about versions.
 *
 * Two rules the rest of the screen leans on:
 *
 *   1. **Nothing here edits a template in place.** Saving an existing
 *      template calls the supersede route; the version being edited survives
 *      untouched and a new one comes back. The copy says so (`versionNotice`)
 *      and the header carries the version number, so the operator is never
 *      led to believe they are overwriting the text citizens already received.
 *
 *   2. **The server's `warning` is the point of staying open.** The modal
 *      does NOT close on a successful save: the response may carry a
 *      `warning` — a placeholder that will not resolve at send time is the
 *      usual one — and closing on success would throw the only message the
 *      backend has for the author. It is rendered directly above the body
 *      fields, where the offending text is.
 */
import { useState } from 'react';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useCreateTemplate, useSupersedeTemplate } from './queries';
import {
  TEMPLATE_CHANNELS,
  TEMPLATE_LANGUAGES,
  type TemplateChannel,
  type TemplateIn,
  type TemplateOut,
} from './api';
import type { TemplateLabels } from './labels';
import { channelLabel, languageLabel, readLocalized, trimLocalized } from './display';

export interface TemplateEditorProps {
  /** `null` opens the editor on a blank template — version 1 on save. */
  template: TemplateOut | null;
  labels: TemplateLabels;
  onClose: () => void;
}

/** SMS carries no subject line, so offering one would collect text the
 *  channel cannot deliver. `subject` is nullable in the contract precisely
 *  for this case, and an SMS template is saved with `subject: null`. */
function hasSubject(channel: string): boolean {
  return channel !== 'sms';
}

export function TemplateEditor({ template, labels: L, onClose }: TemplateEditorProps) {
  // The template the NEXT save supersedes. After a successful save it becomes
  // the version that just came back, so saving twice in a row builds v2 then
  // v3 rather than forking two v2s off the same parent.
  const [current, setCurrent] = useState<TemplateOut | null>(template);
  const [eventCode, setEventCode] = useState(template?.event_code ?? '');
  const [channel, setChannel] = useState<TemplateChannel>((template?.channel as TemplateChannel) ?? 'inapp');
  const [subject, setSubject] = useState<Record<string, string>>(readLocalized(template?.subject));
  const [body, setBody] = useState<Record<string, string>>(readLocalized(template?.body));
  const [saved, setSaved] = useState<TemplateOut | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const create = useCreateTemplate();
  const supersede = useSupersedeTemplate();
  const isSaving = create.isPending || supersede.isPending;
  const saveError = create.error ?? supersede.error;

  const isCreate = current === null;

  function applySaved(next: TemplateOut) {
    setCurrent(next);
    setSaved(next);
    setEventCode(next.event_code);
    setChannel(next.channel as TemplateChannel);
    setSubject(readLocalized(next.subject));
    setBody(readLocalized(next.body));
  }

  async function submit() {
    const trimmedBody = trimLocalized(body);
    if (!eventCode.trim()) {
      setValidationError(L.eventCodeRequired);
      return;
    }
    if (Object.keys(trimmedBody).length === 0) {
      setValidationError(L.bodyRequired);
      return;
    }
    setValidationError(null);
    setSaved(null);

    const trimmedSubject = trimLocalized(subject);
    const payload: TemplateIn = {
      event_code: eventCode.trim(),
      channel,
      subject: hasSubject(channel) && Object.keys(trimmedSubject).length > 0 ? trimmedSubject : null,
      body: trimmedBody,
    };

    try {
      const next = current
        ? await supersede.mutateAsync({ templateId: current.id, body: payload })
        : await create.mutateAsync(payload);
      applySaved(next);
    } catch {
      // Rendered from the mutation's own `error` below — rethrowing here
      // would surface as an unhandled rejection in the console.
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isCreate ? L.editorTitleCreate : L.editorTitleEdit}
      subtitle={
        isCreate ? L.editorSubtitleCreate : `${current.event_code} · ${channelLabel(current.channel, L)} · ${L.currentVersion} v${current.version}`
      }
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} data-testid="template-close">
            {saved ? L.close : L.cancel}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} isLoading={isSaving} data-testid="template-save">
            {isCreate ? L.saveCreate : L.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="template-editor">
        {!isCreate && (
          <Alert variant="info">
            {L.versionNotice}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={L.fieldEventCode} required helperText={isCreate ? L.eventCodeHint : L.identityLocked}>
            <Input
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
              disabled={!isCreate}
              placeholder="application.submitted"
              className="font-mono"
              data-testid="template-event-code"
            />
          </FormField>
          <FormField label={L.fieldChannel} required>
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value as TemplateChannel)}
              disabled={!isCreate}
              options={TEMPLATE_CHANNELS.map((value) => ({ value, label: channelLabel(value, L) }))}
              data-testid="template-channel"
            />
          </FormField>
        </div>

        {/* The server's verdict on the text below — a warning is a SUCCESSFUL
            save the author still has to look at, so it sits directly above
            the fields it is about rather than in a toast that scrolls away. */}
        {saved?.warning ? (
          <Alert variant="warning" title={L.warningTitle}>
            <span data-testid="template-warning" className="font-mono text-xs break-words">
              {saved.warning}
            </span>
          </Alert>
        ) : saved ? (
          <Alert variant="success" title={L.savedTitle}>
            <span data-testid="template-saved">{`${L.savedText} v${saved.version}`}</span>
          </Alert>
        ) : null}

        {validationError && <Alert variant="danger">{validationError}</Alert>}

        {saveError && (
          <Alert variant="danger" title={L.saveError}>
            <span data-testid="template-save-error">
              {saveError instanceof ApiError ? `${saveError.code}: ${saveError.message}` : String(saveError)}
            </span>
          </Alert>
        )}

        <p className="text-xs text-[#5A646D]">{L.placeholderHint}</p>

        <div className="space-y-3">
          {TEMPLATE_LANGUAGES.map((language) => (
            <div key={language} className="border border-[#E4E7EA] rounded-xl p-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5A646D]">
                {languageLabel(language, L)}
              </div>
              {hasSubject(channel) ? (
                <FormField label={L.subject}>
                  <Input
                    value={subject[language] ?? ''}
                    onChange={(e) => setSubject((s) => ({ ...s, [language]: e.target.value }))}
                    data-testid={`template-subject-${language}`}
                  />
                </FormField>
              ) : (
                <p className="text-xs text-[#5A646D]">{L.noSubjectForSms}</p>
              )}
              <FormField label={L.body}>
                <Textarea
                  value={body[language] ?? ''}
                  onChange={(e) => setBody((b) => ({ ...b, [language]: e.target.value }))}
                  className="font-mono text-xs min-h-[120px]"
                  data-testid={`template-body-${language}`}
                />
              </FormField>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
