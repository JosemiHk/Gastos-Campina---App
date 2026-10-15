import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi } from 'vitest';
import { HouseholdStore } from '../data-access/household-store';
import { Confirm } from '../shared/ui/confirm-dialog';
import { storeFixture } from '../../testing/household-fixture';
import { unsavedChanges } from './unsaved-guard';
@Component({ template: 'Formulario de prueba' })
class TestForm {}
describe('protección de cambios sin guardar', () => {
  it('intercepta cambios de mes en la URL y bloquea la salida durante una carga', async () => {
    const store = storeFixture();
    const ask = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'formulario',
            component: TestForm,
            canDeactivate: [unsavedChanges],
            runGuardsAndResolvers: 'paramsOrQueryParamsChange',
          },
          { path: 'otro', component: TestForm },
        ]),
        { provide: HouseholdStore, useValue: store },
        { provide: Confirm, useValue: { ask } },
      ],
    });
    await RouterTestingHarness.create('/formulario?mes=2026-10');
    const router = TestBed.inject(Router);
    store.hasUnsavedChanges.set(true);
    expect(await router.navigateByUrl('/formulario?mes=2026-11')).toBe(false);
    expect(router.url).toBe('/formulario?mes=2026-10');
    expect(ask).toHaveBeenCalledTimes(1);
    ask.mockResolvedValue(true);
    expect(await router.navigateByUrl('/formulario?mes=2026-11')).toBe(true);
    store.hasUnsavedChanges.set(false);
    store.uploading.set(true);
    expect(await router.navigateByUrl('/otro')).toBe(false);
  });
});
