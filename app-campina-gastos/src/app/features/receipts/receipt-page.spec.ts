import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptPage } from './receipt-page';
import { HouseholdStore } from '../../data-access/household-store';
import { Files } from '../../data-access/files';
import { ReceiptPreview } from '../../shared/ui/file-preview';
import { storeFixture } from '../../../testing/household-fixture';
describe('registro de recibos', () => {
  let store: ReturnType<typeof storeFixture>;
  beforeEach(() => {
    store = storeFixture(true);
    TestBed.configureTestingModule({
      imports: [ReceiptPage],
      providers: [
        provideRouter([]),
        { provide: HouseholdStore, useValue: store },
        { provide: Files, useValue: { validate: vi.fn(), upload: vi.fn(), removeUnused: vi.fn() } },
        { provide: ReceiptPreview, useValue: { open: vi.fn() } },
      ],
    });
  });
  it('previsualiza luz con deducción y guarda céntimos exactos', async () => {
    const fixture = TestBed.createComponent(ReceiptPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectService('electricity');
    page.form.controls.amount.setValue('180,00');
    fixture.detectChanges();
    expect(page.totals()).toEqual({ twins: 5334, miguel: 5333, jm: 5333, rossana: 2000 });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await page.save('confirmed');
    expect(store.saveReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'electricity',
        amountCents: 18000,
        status: 'confirmed',
        filePath: null,
      }),
    );
  });
  it('bloquea importes inválidos y luz menor al aporte fijo', async () => {
    const fixture = TestBed.createComponent(ReceiptPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectService('electricity');
    page.form.controls.amount.setValue('19.99');
    fixture.detectChanges();
    await page.save('confirmed');
    expect(store.saveReceipt).not.toHaveBeenCalled();
    expect(page.error()).toContain('aporte fijo');
    page.form.controls.amount.setValue('1.234');
    await page.save('confirmed');
    expect(store.saveReceipt).not.toHaveBeenCalled();
  });
  it('un borrador no requiere confirmar el reparto y conserva su estado', async () => {
    const fixture = TestBed.createComponent(ReceiptPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectService('electricity');
    page.form.controls.amount.setValue('10');
    fixture.detectChanges();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await page.save('draft');
    expect(store.saveReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 1000, status: 'draft' }),
    );
  });
  it('el perfil consulta no puede guardar aunque invoque la acción directamente', async () => {
    store.data.update((data) => ({ ...data, role: 'viewer' }));
    const fixture = TestBed.createComponent(ReceiptPage);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.amount.setValue('90');
    await fixture.componentInstance.save('confirmed');
    expect(store.saveReceipt).not.toHaveBeenCalled();
  });
});
