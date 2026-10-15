import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './settings-page';
import { HouseholdStore } from '../../data-access/household-store';
import { Confirm } from '../../shared/ui/confirm-dialog';
import { storeFixture } from '../../../testing/household-fixture';
describe('configuración del hogar', () => {
  let store: ReturnType<typeof storeFixture>;
  beforeEach(() => {
    store = storeFixture();
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: HouseholdStore, useValue: store },
        { provide: Confirm, useValue: { ask: vi.fn().mockResolvedValue(true) } },
      ],
    });
  });
  it('permite fijar aporte cero y no inventa cuentas bancarias', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.accounts.length).toBe(0);
    page.form.controls.fixed.setValue('0.00');
    await page.save();
    expect(store.saveSettings).toHaveBeenCalledWith(0, []);
  });
  it('rechaza cuentas con campos en blanco antes de enviarlas al servidor', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.addAccount();
    page.accounts.at(0).controls.label.setValue('   ');
    await page.save();
    expect(store.saveSettings).not.toHaveBeenCalled();
    expect(page.form.invalid).toBe(true);
  });
  it('un mes cerrado impide guardar ajustes desde la interfaz', async () => {
    store.data.update((data) => ({
      ...data,
      periods: data.periods.map((p) => ({
        ...p,
        status: 'closed',
        closedAt: '2026-10-31T12:00:00Z',
      })),
    }));
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(store.saveSettings).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
  });
});
