/**
 * react-query bindings for H9, in the style of `src/pages/permits/queries.ts`:
 * the wrappers live in `./api`, the caching policy lives here, and the screen
 * imports only hooks.
 *
 * The list keeps `placeholderData: (previous) => previous` so paging and
 * filtering swap the rows without the table collapsing to its loading state
 * between pages.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveTemplate,
  createTemplate,
  listTemplates,
  supersedeTemplate,
  type TemplateIn,
  type TemplateListParams,
} from './api';

const ROOT_KEY = ['admin', 'notification-templates'] as const;

export function useTemplatesList(params: TemplateListParams) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'list', params],
    queryFn: () => listTemplates(params),
    placeholderData: (previous) => previous,
  });
}

export function useCreateTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TemplateIn) => createTemplate(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

/** The UPDATE mutation. Named after what it does to the register — the old
 *  version survives, the answer is a new one. */
export function useSupersedeTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, body }: { templateId: string; body: TemplateIn }) =>
      supersedeTemplate(templateId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useArchiveTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => archiveTemplate(templateId),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}
