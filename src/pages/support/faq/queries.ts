/**
 * React-query layer for the FAQ tabs, in the style of
 * `src/pages/admin/announcements/queries.ts` — the wrappers themselves live
 * in `./api.ts`, these hooks only decide what is cached, under which key,
 * and what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFaq, listFaqAdmin, listPublicFaq, patchFaq, type FaqIn, type FaqPatch } from './api';

const PUBLIC_LIST_KEY = ['support', 'faq', 'public'] as const;
const ADMIN_LIST_KEY = ['support', 'faq', 'admin', 'list'] as const;

/** The reader tab's one fetch — `category` is `undefined` there; it exists
 *  as a parameter mainly so the wrapper mirrors `listPublicFaq`'s own
 *  signature, since the reader filters the single fetched list client-side
 *  rather than refetching per category. */
export function usePublicFaq(category?: string) {
  return useQuery({
    queryKey: [...PUBLIC_LIST_KEY, category ?? null],
    queryFn: () => listPublicFaq(category),
  });
}

export function useFaqAdmin(status?: string) {
  return useQuery({
    queryKey: [...ADMIN_LIST_KEY, status ?? null],
    queryFn: () => listFaqAdmin(status),
  });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: FaqIn) => createFaq(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_LIST_KEY });
    },
  });
}

/** Backs both the form modal's save and the row-level "Опубликовать"/"В
 *  архив" quick actions — every call site supplies its own `faqId`, so the
 *  mutation itself is not bound to any one row the way
 *  `usePatchAnnouncement(announcementId)` is bound to the open editor. */
export function usePatchFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, body }: { faqId: string; body: FaqPatch }) => patchFaq(faqId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_LIST_KEY });
    },
  });
}
