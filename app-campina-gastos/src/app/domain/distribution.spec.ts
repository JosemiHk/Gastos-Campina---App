import { describe, expect, it } from 'vitest';
import { calculateDistribution, groupTotals, splitEqual, splitWeighted } from './distribution';
import { parseMoney } from './money';
import { DEFAULT_PARTICIPANTS, RuleParticipants } from './models';

describe('reparto familiar exacto', () => {
  it('deduce Rossana, excluye Gemelas de internet y conserva el céntimo', () => {
    const result = calculateDistribution(
      [
        { service: 'water', amountCents: 9000, status: 'confirmed' },
        { service: 'electricity', amountCents: 18000, status: 'confirmed' },
        { service: 'internet', amountCents: 12000, status: 'confirmed' },
      ],
      2000,
    );
    expect(result.totalCents).toBe(39000);
    expect(groupTotals(result)).toEqual({ twins: 8334, miguel: 14333, jm: 14333, rossana: 2000 });
    expect(
      result.allocations.some((a) => a.service === 'internet' && a.groupCode === 'twins'),
    ).toBe(false);
  });
  it('no considera borradores ni inventa servicios faltantes', () => {
    const result = calculateDistribution(
      [
        { service: 'water', amountCents: 1, status: 'confirmed' },
        { service: 'electricity', amountCents: 100, status: 'draft' },
      ],
      2000,
    );
    expect(result.receiptCount).toBe(1);
    expect(groupTotals(result)).toEqual({ twins: 1, miguel: 0, jm: 0, rossana: 0 });
  });
  it('rechaza luz inferior al aporte y servicios duplicados', () => {
    expect(() =>
      calculateDistribution(
        [{ service: 'electricity', amountCents: 1999, status: 'confirmed' }],
        2000,
      ),
    ).toThrow();
    expect(() =>
      calculateDistribution(
        [
          { service: 'water', amountCents: 1, status: 'confirmed' },
          { service: 'water', amountCents: 2, status: 'confirmed' },
        ],
        2000,
      ),
    ).toThrow();
  });
  it('reparte exactamente y de forma repetible para cualquier remanente', () => {
    for (let cents = 0; cents < 1000; cents++) {
      const parts = splitEqual(cents, ['twins', 'miguel', 'jm']);
      expect(parts.reduce((sum, part) => sum + part.amountCents, 0)).toBe(cents);
      expect(
        Math.max(...parts.map((p) => p.amountCents)) - Math.min(...parts.map((p) => p.amountCents)),
      ).toBeLessThanOrEqual(1);
      expect(parts).toEqual(splitEqual(cents, ['twins', 'miguel', 'jm']));
    }
  });
});
describe('entrada monetaria', () => {
  it('acepta punto o coma sin usar decimales binarios en el cálculo', () => {
    expect(parseMoney('90,01')).toBe(9001);
    expect(parseMoney('0.10')).toBe(10);
    expect(parseMoney('999999.99')).toBe(99999999);
    for (const invalid of ['-2', '0', '1.123', '1e3', 'NaN', '1,000.00', '1000000'])
      expect(parseMoney(invalid)).toBeNull();
  });
});
describe('participantes configurables', () => {
  it('coincide con el caso PostgreSQL cuando los tres grupos pagan internet', () => {
    const result = calculateDistribution(
      [
        { service: 'water', amountCents: 9000, status: 'confirmed' },
        { service: 'electricity', amountCents: 18000, status: 'confirmed' },
        { service: 'internet', amountCents: 12000, status: 'confirmed' },
      ],
      2000,
      { ...DEFAULT_PARTICIPANTS, internet: ['jm', 'twins', 'miguel'] },
    );
    expect(groupTotals(result)).toEqual({ twins: 12334, miguel: 12333, jm: 12333, rossana: 2000 });
  });
  it('un participante recibe el servicio completo y el redondeo no depende del orden de selección', () => {
    const rules: RuleParticipants = {
      ...DEFAULT_PARTICIPANTS,
      water: ['jm'],
      internet: ['jm', 'twins'],
    };
    const result = calculateDistribution(
      [
        { service: 'water', amountCents: 9001, status: 'confirmed' },
        { service: 'internet', amountCents: 101, status: 'confirmed' },
      ],
      2000,
      rules,
    );
    expect(groupTotals(result)).toEqual({ twins: 51, miguel: 0, jm: 9051, rossana: 0 });
  });
  it.each([[], ['jm', 'jm'], ['rossana'], ['unknown']].map((internet) => ({ internet })))(
    'rechaza participantes inválidos: %j',
    ({ internet }) => {
      expect(() =>
        calculateDistribution(
          [{ service: 'internet', amountCents: 100, status: 'confirmed' }],
          2000,
          { ...DEFAULT_PARTICIPANTS, internet } as RuleParticipants,
        ),
      ).toThrow();
    },
  );
});

describe('reparto ponderado', () => {
  const participants = [
    { groupCode: 'twins' as const, weight: 2 },
    { groupCode: 'miguel' as const, weight: 1 },
    { groupCode: 'jm' as const, weight: 1 },
  ];
  it('conserva c�ntimos, proporciones y desempates independientemente del orden', () => {
    for (let cents = 0; cents < 1000; cents++) {
      const parts = splitWeighted(cents, participants);
      expect(parts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(cents);
      expect(parts).toEqual(splitWeighted(cents, [...participants].reverse()));
      parts.forEach((p, i) =>
        expect(Math.abs(p.amountCents - (cents * participants[i].weight) / 4)).toBeLessThan(1),
      );
    }
  });
  it('aplica el ejemplo familiar sin alterar internet ni el aporte', () => {
    const result = calculateDistribution(
      [
        { service: 'water', amountCents: 6850, status: 'confirmed' },
        { service: 'electricity', amountCents: 16730, status: 'confirmed' },
        { service: 'internet', amountCents: 11900, status: 'confirmed' },
      ],
      2000,
      DEFAULT_PARTICIPANTS,
      {
        water: { twins: 2, miguel: 1, jm: 1 },
        electricity: { twins: 2, miguel: 1, jm: 1 },
        internet: { miguel: 1, jm: 1 },
      },
    );
    expect(groupTotals(result)).toEqual({ twins: 10790, miguel: 11346, jm: 11344, rossana: 2000 });
    expect(result.totalCents).toBe(35480);
  });
  it('rechaza pesos y participantes inv�lidos', () => {
    for (const weight of [0, -1, 1.5, 11, NaN, Infinity])
      expect(() => splitWeighted(100, [{ groupCode: 'twins', weight }])).toThrow();
    expect(() => splitWeighted(100, [participants[0], participants[0]])).toThrow();
    expect(() => splitWeighted(100, [])).toThrow();
    expect(() =>
      calculateDistribution(
        [{ service: 'water', amountCents: 100, status: 'confirmed' }],
        0,
        DEFAULT_PARTICIPANTS,
        { water: { twins: 2 }, electricity: {}, internet: {} },
      ),
    ).toThrow();
    expect(splitWeighted(99999999, participants).reduce((sum, p) => sum + p.amountCents, 0)).toBe(
      99999999,
    );
  });
});
