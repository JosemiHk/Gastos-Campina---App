import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdStore } from './household-store';
import { Supabase } from '../core/supabase';
import { Auth } from '../core/auth';
import { householdFixture } from '../../testing/household-fixture';
describe('estado y persistencia del hogar', () => {
  const rpc = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: Supabase, useValue: { client: { rpc } } },
        { provide: Auth, useValue: { user: signal({ id: 'admin' }) } },
      ],
    });
  });
  it('envía la revisión esperada y recarga el resultado canónico', async () => {
    rpc.mockResolvedValue({ data: householdFixture(), error: null });
    const store = TestBed.inject(HouseholdStore);
    store.selectedMonth.set('2026-10-01');
    await store.load();
    await store.confirmPayment('twins', 'Yape');
    expect(rpc).toHaveBeenCalledWith('confirm_payment', {
      p_household: householdFixture().household.id,
      p_month: '2026-10-01',
      p_revision: 3,
      p_group: 'twins',
      p_method: 'Yape',
    });
    expect(rpc.mock.calls.at(-1)?.[0]).toBe('get_household');
  });
  it('un error no modifica cuotas ni deja la operación bloqueada', async () => {
    rpc.mockResolvedValueOnce({ data: householdFixture(), error: null });
    const store = TestBed.inject(HouseholdStore);
    store.selectedMonth.set('2026-10-01');
    await store.load();
    rpc.mockResolvedValueOnce({ data: null, error: new Error('Conflicto de revisión') });
    await expect(store.closePeriod()).rejects.toThrow();
    expect(store.closed()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.totals().twins).toBe(8334);
  });
});
