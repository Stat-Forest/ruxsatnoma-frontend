/**
 * React-query layer for the legal-documents register, in the style of
 * `announcements/queries.ts` — the wrappers live in `./api.ts`, these hooks
 * only decide what is cached, under which key, and what a mutation
 * invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveLegalDocument,
  createLegalDocument,
  getLegalDocument,
  listLegalDocuments,
  patchLegalDocument,
  publishLegalDocument,
  type LegalDocumentCreateIn,
  type LegalDocumentListParams,
  type LegalDocumentPatchIn,
} from './api';

const LIST_KEY = ['admin', 'legal-documents', 'list'] as const;

export function useLegalDocumentsList(params: LegalDocumentListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listLegalDocuments(params),
    placeholderData: (previous) => previous,
  });
}

/** Only fires once a row is actually being edited: the form reads the row from
 *  the route rather than trusting the list's copy, which may be a page old. */
export function useLegalDocument(docId: string | null) {
  return useQuery({
    queryKey: ['admin', 'legal-documents', 'one', docId],
    queryFn: async () => {
      if (!docId) throw new Error('useLegalDocument called without an id');
      return getLegalDocument(docId);
    },
    enabled: docId !== null,
  });
}

export function useCreateLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LegalDocumentCreateIn) => createLegalDocument(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function usePatchLegalDocument(docId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LegalDocumentPatchIn) => {
      if (!docId) throw new Error('usePatchLegalDocument called without an id');
      return patchLegalDocument(docId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'legal-documents', 'one', docId] });
    },
  });
}

export function usePublishLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => publishLegalDocument(docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useArchiveLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => archiveLegalDocument(docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
