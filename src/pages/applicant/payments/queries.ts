import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  listApplications,
  listClassifierItems,
  listMyInvoices,
  listMyRefunds,
  requestRefund,
  type ApplicationOut,
} from '../api';

export const MY_INVOICES_KEY = ['my-invoices'] as const;
export const MY_REFUNDS_KEY = ['my-refunds'] as const;

export function useMyInvoices(params: { status?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: [...MY_INVOICES_KEY, params],
    queryFn: () =>
      listMyInvoices({
        status: params.status || undefined,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useMyRefunds(params: { status?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: [...MY_REFUNDS_KEY, params],
    queryFn: () =>
      listMyRefunds({
        status: params.status || undefined,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      }),
    placeholderData: (previous) => previous,
  });
}

/** The citizen's own applications, keyed by id — what turns an invoice's
 * `application_id` into a number a person recognises. One page of 100 is a
 * citizen's whole history; the backend scopes "mine" for an applicant caller. */
export function useMyApplicationsIndex() {
  const query = useQuery({
    queryKey: ['my-applications', 'index'],
    queryFn: () => listApplications({ page: 1, page_size: 100 }),
    staleTime: 60 * 1000,
  });
  const index = useMemo(() => {
    const map = new Map<string, ApplicationOut>();
    for (const item of query.data?.items ?? []) map.set(item.id, item);
    return map;
  }, [query.data]);
  return { ...query, index };
}

/** The live `refund_reasons` classifier — the basis select's options and the
 * label a refund row shows for its `basis_item_id`. */
export function useRefundReasons() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'refund_reasons'],
    queryFn: () => listClassifierItems('refund_reasons'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestRefund,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_REFUNDS_KEY });
    },
  });
}
