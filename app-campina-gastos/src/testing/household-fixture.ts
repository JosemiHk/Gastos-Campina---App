import { signal, computed } from '@angular/core';
import { vi } from 'vitest';
import { HouseholdData, Receipt } from '../app/domain/models';
import { calculateDistribution, groupTotals } from '../app/domain/distribution';
export function householdFixture() {
  const data: HouseholdData = {
    household: {
      id: '10000000-0000-4000-a000-000000000001',
      name: 'Hogar de prueba',
      fixedContributionCents: 2000,
    },
    role: 'admin',
    groups: [
      {
        id: '1',
        code: 'twins',
        name: 'Gemelas',
        members: ['Amy', 'Annie'],
        kind: 'regular',
        sortOrder: 0,
      },
      {
        id: '2',
        code: 'miguel',
        name: 'Miguel',
        members: ['Denis Miguel'],
        kind: 'regular',
        sortOrder: 1,
      },
      { id: '3', code: 'jm', name: 'JM', members: ['José Miguel'], kind: 'regular', sortOrder: 2 },
      {
        id: '4',
        code: 'rossana',
        name: 'Rossana',
        members: ['Rossana'],
        kind: 'special',
        sortOrder: 3,
      },
    ],
    accounts: [],
    periods: [],
  };
  const receipts: Receipt[] = (['water', 'electricity', 'internet'] as const).map(
    (service, index) => ({
      id: `20000000-0000-4000-a000-00000000000${index}`,
      service,
      amountCents: [9000, 18000, 12000][index],
      status: 'confirmed',
      dueDate: null,
      issueDate: null,
      filePath: null,
      fileName: null,
      fileSize: null,
      fileType: null,
      createdAt: '2026-10-01T12:00:00Z',
    }),
  );
  data.periods = [
    {
      id: '30000000-0000-4000-a000-000000000001',
      month: '2026-10-01',
      status: 'open',
      revision: 3,
      fixedContributionCents: 2000,
      receipts,
      calculation: { ...calculateDistribution(receipts, 2000), id: 'run' },
      payments: [],
      activity: [],
      closedAt: null,
    },
  ];
  return data;
}
export function storeFixture(empty = false) {
  const initial = householdFixture();
  if (empty) initial.periods = [];
  const data = signal(initial);
  const selectedMonth = signal('2026-10-01');
  const period = computed(() => data().periods.find((p) => p.month === selectedMonth()) ?? null);
  const calculation = computed(() => period()?.calculation ?? null);
  return {
    data,
    selectedMonth,
    period,
    calculation,
    receipts: computed(() => period()?.receipts ?? []),
    totals: computed(() => groupTotals(calculation())),
    isAdmin: computed(() => data().role === 'admin'),
    closed: computed(() => period()?.status === 'closed'),
    fixedContributionCents: computed(
      () => period()?.fixedContributionCents ?? data().household.fixedContributionCents,
    ),
    hasUnsavedChanges: signal(false),
    saving: signal(false),
    uploading: signal(false),
    loading: signal(false),
    error: signal(''),
    paid: () => 0,
    balance: (code: keyof ReturnType<typeof groupTotals>) => groupTotals(calculation())[code],
    saveReceipt: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    confirmPayment: vi.fn().mockResolvedValue(undefined),
    voidPayment: vi.fn().mockResolvedValue(undefined),
    closePeriod: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
  };
}
