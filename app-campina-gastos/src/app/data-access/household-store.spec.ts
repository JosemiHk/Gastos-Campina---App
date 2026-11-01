import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdStore } from './household-store';
import { Supabase } from '../core/supabase';
import { Auth } from '../core/auth';
import { householdFixture } from '../../testing/household-fixture';
import { DEFAULT_PARTICIPANTS } from '../domain/models';
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
  it('envía ambas revisiones al guardar la configuración ampliada', async () => {
    const data = householdFixture();
    data.household.configurationRevision = 7;
    rpc.mockResolvedValue({ data, error: null });
    const store = TestBed.inject(HouseholdStore);
    store.selectedMonth.set('2026-10-01');
    await store.load();
    const groups = data.groups.map(({ code, name, members }) => ({ code, name, members }));
    await store.saveHouseholdSettings(2000, [], groups, DEFAULT_PARTICIPANTS);
    expect(rpc).toHaveBeenCalledWith(
      'save_household_settings',
      expect.objectContaining({
        p_revision: 3,
        p_configuration_revision: 7,
        p_groups: groups,
        p_participants: DEFAULT_PARTICIPANTS,
      }),
    );
  });
  it('mantiene nombres, integrantes y reglas históricos frente a la configuración actual', async () => {
    const data = householdFixture();
    data.groups[0].name = 'Nombre actual';
    data.household.participants = { ...DEFAULT_PARTICIPANTS, internet: ['twins'] };
    data.periods[0].participants = DEFAULT_PARTICIPANTS;
    data.periods[0].calculation!.groupNames = { twins: 'Nombre histórico' };
    data.periods[0].calculation!.groupMembers = { twins: ['Integrante histórico'] };
    rpc.mockResolvedValue({ data, error: null });
    const store = TestBed.inject(HouseholdStore);
    store.selectedMonth.set('2026-10-01');
    await store.load();
    expect(store.groupName('twins')).toBe('Nombre histórico');
    expect(store.groupMembers('twins')).toEqual(['Integrante histórico']);
    expect(store.participants().internet).toEqual(['miguel', 'jm']);
  });
  it('usa los pesos históricos del periodo y envía la RPC ponderada con ambas revisiones', async () => {
    const data = householdFixture();
    const oldWeights = {
      water: { twins: 2, miguel: 1, jm: 1 },
      electricity: { twins: 2, miguel: 1, jm: 1 },
      internet: { miguel: 1, jm: 1 },
    };
    data.periods[0].ruleWeights = oldWeights;
    data.household.ruleWeights = { ...oldWeights, water: { twins: 3, miguel: 1, jm: 1 } };
    data.household.configurationRevision = 8;
    rpc.mockResolvedValue({ data, error: null });
    const store = TestBed.inject(HouseholdStore);
    store.selectedMonth.set('2026-10-01');
    await store.load();
    expect(store.weights()).toEqual(oldWeights);
    expect(store.ruleDescription('water')).toContain('2 de 4 partes');
    await store.saveHouseholdSettings(2000, [], data.groups, DEFAULT_PARTICIPANTS, oldWeights);
    expect(rpc).toHaveBeenCalledWith(
      'save_weighted_household_settings',
      expect.objectContaining({
        p_revision: 3,
        p_configuration_revision: 8,
        p_weights: oldWeights,
      }),
    );
    data.periods[0].ruleWeights = undefined;
    store.data.set(structuredClone(data));
    expect(store.weights().water.twins).toBe(1);
  });
});
