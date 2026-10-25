import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdLive } from './household-live';
import { HouseholdStore } from './household-store';
import { Supabase } from '../core/supabase';
import { storeFixture } from '../../testing/household-fixture';

describe('avisos del hogar', () => {
  let store: ReturnType<typeof storeFixture>;
  let changed: () => void;
  const removeChannel = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store = storeFixture();
    store.data.update((data) => ({ ...data, accessEnabled: true, currentUserId: 'user' }));
    const channel = {
      on: vi.fn().mockImplementation((_event, _filter, callback) => {
        changed = callback;
        return channel;
      }),
      subscribe: vi.fn().mockImplementation(() => channel),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: HouseholdStore, useValue: store },
        {
          provide: Supabase,
          useValue: { client: { channel: vi.fn().mockReturnValue(channel), removeChannel } },
        },
      ],
    });
    TestBed.inject(HouseholdLive);
    TestBed.tick();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('agrupa avisos y recarga cuando no hay cambios sin guardar', async () => {
    changed();
    changed();
    await vi.advanceTimersByTimeAsync(300);
    expect(store.load).toHaveBeenCalledTimes(1);
  });
  it('preserva el formulario y muestra aviso mientras se está escribiendo', async () => {
    store.hasUnsavedChanges.set(true);
    changed();
    await vi.advanceTimersByTimeAsync(300);
    expect(store.load).not.toHaveBeenCalled();
    expect(store.externalChanges()).toBe(true);
    expect(store.hasUnsavedChanges()).toBe(true);
  });
  it('no compite con un guardado o subida en curso', async () => {
    store.saving.set(true);
    changed();
    await vi.advanceTimersByTimeAsync(300);
    expect(store.load).not.toHaveBeenCalled();
  });
  it('retira las suscripciones al destruirse', () => {
    TestBed.resetTestingModule();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
  it('no vuelve a suscribirse por cada recarga del mismo hogar', () => {
    store.data.update((data) => ({ ...data }));
    TestBed.tick();
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
