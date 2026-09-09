/**
 * Data layer for the oversight register (Track 3, stage 6.7 J3) — the
 * prosecutor's (and central office's, and leadership's) read-only surface
 * over `GET /oversight/risk-indicators` and `GET /oversight/events`. Both
 * routes are pure readers (`design/01` rule 5, `app/modules/oversight/
 * router.py`'s own docstring): no write of any kind exists in this module,
 * and there is no HTTP entry point for the oversight sweep itself
 * (`app/workers/jobs.py::oversight_sweep` — a 5-minute scheduled job with no
 * route and no registered permission code) — so this file, deliberately,
 * exports no mutation of any kind.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type RiskIndicatorOut = components['schemas']['RiskIndicatorOut'];
export type OversightEventOut = components['schemas']['OversightEventOut'];

/** `RiskIndicatorOut.code` — RI-01..RI-15 (`oversight/schemas.py::
 *  RiskIndicatorCode`). Spelled out by hand for the same reason the backend
 *  schema does: a domain code whose meaning is not documented here, so this
 *  file renders each one raw rather than guessing at a label. */
export type RiskIndicatorCode =
  | 'RI-01'
  | 'RI-02'
  | 'RI-03'
  | 'RI-04'
  | 'RI-05'
  | 'RI-06'
  | 'RI-07'
  | 'RI-08'
  | 'RI-09'
  | 'RI-10'
  | 'RI-11'
  | 'RI-12'
  | 'RI-13'
  | 'RI-14'
  | 'RI-15';

export type RiskIndicatorLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskIndicatorStatus = 'new' | 'in_review' | 'closed';

export interface RiskIndicatorFilters {
  code?: RiskIndicatorCode;
  level?: RiskIndicatorLevel;
  status?: RiskIndicatorStatus;
  object_type?: string;
  period_from?: string;
  period_to?: string;
  page: number;
  page_size: number;
}

function cleanFilters<T extends Record<string, unknown>>(params: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      result[k] = v;
    }
  }
  return result as T;
}

export function useRiskIndicators(filters: RiskIndicatorFilters) {
  const cleanParams = cleanFilters(filters as unknown as Record<string, unknown>) as unknown as RiskIndicatorFilters;
  return useQuery({
    queryKey: ['oversight', 'risk-indicators', cleanParams],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/oversight/risk-indicators', {
        params: { query: cleanParams },
      });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export interface EventFilters {
  event_type?: string;
  object_type?: string;
  period_from?: string;
  period_to?: string;
  page: number;
  page_size: number;
}

export function useEvents(filters: EventFilters) {
  const cleanParams = cleanFilters(filters as unknown as Record<string, unknown>) as unknown as EventFilters;
  return useQuery({
    queryKey: ['oversight', 'events', cleanParams],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/oversight/events', {
        params: { query: cleanParams },
      });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

