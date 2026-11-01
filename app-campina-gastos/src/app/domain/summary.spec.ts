import { describe, expect, it } from 'vitest';
import { summaryText } from './summary';
import { calculateDistribution } from './distribution';
import { BillingPeriod, PaymentGroup } from './models';
import { householdFixture } from '../../testing/household-fixture';
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
  it('el resumen utiliza nombres históricos y el número real de participantes', () => {
    const data = householdFixture();
    const period = data.periods[0];
    period.participants = {
      water: ['jm'],
      electricity: ['twins', 'jm'],
      internet: ['miguel', 'jm'],
    };
    period.calculation!.groupNames = { twins: 'Familia anterior', rossana: 'Aporte anterior' };
    data.groups[0].name = 'Familia actual';
    const text = summaryText(period, data.groups, []);
    expect(text).toContain('Familia anterior');
    expect(text).not.toContain('Familia actual');
    expect(text).toContain('de Aporte anterior; el saldo se divide entre 2 grupos.');
  });
  it('explica las proporciones guardadas aunque la composición actual cambie', () => {
    const data = householdFixture();
    const period = data.periods[0];
    period.ruleWeights = {
      water: { twins: 2, miguel: 1, jm: 1 },
      electricity: { twins: 2, miguel: 1, jm: 1 },
      internet: { miguel: 1, jm: 1 },
    };
    period.calculation!.groupNames = { twins: 'Grupo histórico' };
    const text = summaryText(period, data.groups, []);
    expect(text).toContain('Grupo histórico: 2 de 4 partes');
    expect(text).toContain('Internet:');
  });
});
