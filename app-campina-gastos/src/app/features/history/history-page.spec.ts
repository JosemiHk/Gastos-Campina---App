import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { HouseholdStore } from '../../data-access/household-store';
import { storeFixture } from '../../../testing/household-fixture';
import { HistoryPage } from './history-page';
describe('historial mensual', () => {
  it('conserva el nombre del cálculo cerrado y cuenta cuatro aportes, no tres recibos', () => {
    const store = storeFixture();
    store.data.update((data) => ({
      ...data,
      groups: data.groups.map((g) => (g.code === 'twins' ? { ...g, name: 'Nombre actual' } : g)),
      periods: data.periods.map((p) => ({
        ...p,
        status: 'closed',
        closedAt: '2026-10-31T12:00:00Z',
        calculation: { ...p.calculation!, groupNames: { twins: 'Gemelas al cierre' } },
      })),
    }));
    TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), { provide: HouseholdStore, useValue: store }],
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.total()).toBe(39000);
    expect(page.groups(store.period()!)[0].name).toBe('Gemelas al cierre');
    expect(page.paidCount(store.period()!)).toBe('0/4 aportes recibidos');
  });
});
