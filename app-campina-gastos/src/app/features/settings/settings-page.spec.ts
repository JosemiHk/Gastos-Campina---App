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
  function enableEditor() {
    store.data.update((data) => ({
      ...data,
      household: { ...data.household, configurationRevision: 2 },
    }));
  }
  it('guarda nombres, integrantes y participantes desde los controles del formulario', async () => {
    enableEditor();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const name = fixture.nativeElement.querySelector('#group-name-0') as HTMLInputElement;
    name.value = ' Familia norte ';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const internet = fixture.nativeElement.querySelector(
      '#group-service-0-internet',
    ) as HTMLInputElement;
    internet.click();
    page.addMember(0);
    page.groups.at(0).controls.members.at(2).setValue(' Clara ');
    fixture.detectChanges();
    expect(store.hasUnsavedChanges()).toBe(true);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(store.saveHouseholdSettings).toHaveBeenCalledWith(
      2000,
      [],
      expect.arrayContaining([
        { code: 'twins', name: 'Familia norte', members: ['Amy', 'Annie', 'Clara'] },
      ]),
      expect.objectContaining({ internet: ['twins', 'miguel', 'jm'] }),
    );
    expect(store.saveSettings).not.toHaveBeenCalled();
  });
  it('rechaza un servicio sin grupos y nombres repetidos sin enviar cambios', async () => {
    enableEditor();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.groups.controls.forEach((group) =>
      group.controls.services.controls.internet.setValue(false),
    );
    await page.save();
    expect(page.error()).toContain('al menos un grupo');
    expect(store.saveHouseholdSettings).not.toHaveBeenCalled();
  });
  it('cancelar el recálculo conserva el formulario y los pagos', async () => {
    enableEditor();
    const confirm = TestBed.inject(Confirm);
    vi.mocked(confirm.ask).mockResolvedValue(false);
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.groups.at(0).controls.services.controls.internet.setValue(true);
    page.form.markAsDirty();
    store.hasUnsavedChanges.set(true);
    await page.save();
    expect(confirm.ask).toHaveBeenCalled();
    expect(store.saveHouseholdSettings).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(true);
  });
  it('un integrante mínimo permanece y el perfil consulta no puede editar', async () => {
    enableEditor();
    store.data.update((data) => ({ ...data, role: 'viewer' }));
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.removeMember(1, 0);
    expect(page.groups.at(1).controls.members.length).toBe(1);
    await page.save();
    expect(store.saveHouseholdSettings).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#group-name-0')).toBeNull();
  });
  it('edita personas, confirma el mes y rechaza decimales antes de guardar', async () => {
    enableEditor();
    store.data.update((data) => ({
      ...data,
      household: {
        ...data.household,
        ruleWeights: {
          water: { twins: 1, miguel: 1, jm: 1 },
          electricity: { twins: 1, miguel: 1, jm: 1 },
          internet: { miguel: 1, jm: 1 },
        },
      },
    }));
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const input = fixture.nativeElement.querySelector('#weight-0-water') as HTMLInputElement;
    input.value = '1.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await page.save();
    expect(store.saveHouseholdSettings).not.toHaveBeenCalled();
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    page.groups.at(0).controls.weights.controls.electricity.setValue(2);
    await page.save();
    expect(TestBed.inject(Confirm).ask).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('octubre de 2026') }),
    );
    expect(store.saveHouseholdSettings).toHaveBeenCalledWith(
      2000,
      [],
      expect.any(Array),
      expect.any(Object),
      {
        water: { twins: 2, miguel: 1, jm: 1 },
        electricity: { twins: 2, miguel: 1, jm: 1 },
        internet: { miguel: 1, jm: 1 },
      },
    );
  });
  it('cancelar un cambio de personas no envía ajustes', async () => {
    enableEditor();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    fixture.componentInstance.groups.at(0).controls.weights.controls.water.setValue(2);
    vi.mocked(TestBed.inject(Confirm).ask).mockResolvedValue(false);
    await fixture.componentInstance.save();
    expect(store.saveHouseholdSettings).not.toHaveBeenCalled();
  });
  it('un peso inválido deja de bloquear el formulario al excluir ese servicio', () => {
    enableEditor();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const group = fixture.componentInstance.groups.at(0);
    group.controls.weights.controls.water.setValue(1.5);
    expect(fixture.componentInstance.form.invalid).toBe(true);
    group.controls.services.controls.water.setValue(false);
    expect(fixture.componentInstance.form.invalid).toBe(false);
  });
});
