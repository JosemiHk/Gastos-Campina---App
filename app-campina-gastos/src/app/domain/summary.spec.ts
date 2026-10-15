import { describe, expect, it } from 'vitest';
import { summaryText } from './summary';
import { calculateDistribution } from './distribution';
import { BillingPeriod, PaymentGroup } from './models';
describe('resumen compartible', () => {
  it('identifica meses parciales y no publica borradores ni datos bancarios inventados', () => {
    const receipts = [
      {
        id: 'r',
        service: 'water' as const,
        amountCents: 9001,
        status: 'confirmed' as const,
        dueDate: null,
        issueDate: null,
        filePath: null,
        fileName: null,
        fileSize: null,
        fileType: null,
        createdAt: '',
      },
    ];
    const period: BillingPeriod = {
      id: 'p',
      month: '2026-10-01',
      status: 'open',
      revision: 1,
      fixedContributionCents: 2000,
      receipts,
      calculation: calculateDistribution(receipts, 2000),
      payments: [],
      activity: [],
      closedAt: null,
    };
    const groups: PaymentGroup[] = [
      { id: 'g', code: 'twins', name: 'Gemelas', members: [], kind: 'regular', sortOrder: 0 },
    ];
    const text = summaryText(period, groups, []);
    expect(text).toContain('RESUMEN PARCIAL');
    expect(text).toContain('30.01');
    expect(text).not.toContain('DATOS PARA TRANSFERIR');
    expect(text).not.toContain('Internet WIN:');
  });
});
