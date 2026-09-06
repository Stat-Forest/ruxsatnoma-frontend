import { describe, expect, test } from 'vitest';
import { reportDocumentBytes, reportDocumentJson } from './reportDocument';

describe('reportDocumentJson', () => {
  test('matches app/modules/reports/service.py::_report_bytes byte for byte', () => {
    const json = reportDocumentJson({
      reportId: 'r1000000-0000-4000-8000-000000000001',
      formId: 'f1000000-0000-4000-8000-000000000001',
      organizationId: 'o1000000-0000-4000-8000-000000000001',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      versionNo: 1,
      data: {
        generated_at: '2026-02-01T10:00:00+00:00',
        rows: [{ total_amount: '100.00', paid_amount: '50.00' }],
      },
    });
    expect(json).toBe(
      '{"data":{"generated_at":"2026-02-01T10:00:00+00:00","rows":[{"paid_amount":"50.00","total_amount":"100.00"}]},"form_id":"f1000000-0000-4000-8000-000000000001","organization_id":"o1000000-0000-4000-8000-000000000001","period_end":"2026-01-31","period_start":"2026-01-01","report_id":"r1000000-0000-4000-8000-000000000001","version_no":1}',
    );
  });

  test('sorts object keys recursively, preserves array order, and renders null', () => {
    const json = reportDocumentJson({
      reportId: 'r2',
      formId: 'f2',
      organizationId: 'o2',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      versionNo: 2,
      data: { rows: [{ b: 1, a: null }, { z: 'x', a: 'y' }] },
    });
    expect(json).toBe(
      '{"data":{"rows":[{"a":null,"b":1},{"a":"y","z":"x"}]},"form_id":"f2","organization_id":"o2","period_end":"2026-02-28","period_start":"2026-02-01","report_id":"r2","version_no":2}',
    );
  });
});

describe('reportDocumentBytes', () => {
  test('returns the UTF-8 bytes of reportDocumentJson', () => {
    const input = {
      reportId: 'r3', formId: 'f3', organizationId: 'o3',
      periodStart: '2026-03-01', periodEnd: '2026-03-31', versionNo: 1,
      data: {},
    };
    const bytes = reportDocumentBytes(input);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe(reportDocumentJson(input));
  });
});
