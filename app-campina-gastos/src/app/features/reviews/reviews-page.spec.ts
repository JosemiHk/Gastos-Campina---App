import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsPage } from './reviews-page';
import { HouseholdStore } from '../../data-access/household-store';
import { storeFixture } from '../../../testing/household-fixture';
import { Confirm } from '../../shared/ui/confirm-dialog';
import { ReceiptPreview } from '../../shared/ui/file-preview';
import { ReceiptCorrection } from '../../domain/models';

describe('revisión de correcciones', () => {
  let store: ReturnType<typeof storeFixture>;
  let correction: ReceiptCorrection;
  beforeEach(() => {
    store = storeFixture();
    const receipt = store.receipts()[0];
    correction = {
      id: 'correction',
      month: '2026-10-01',
      receiptId: receipt.id,
      before: receipt,
      proposed: { ...receipt, amountCents: 9500 },
      reason: 'Corregir importe',
      status: 'pending',
      requestedBy: 'other',
      requestedName: 'Integrante',
      requestedAt: '2026-10-01T12:00:00Z',
      resolvedBy: null,
      resolvedAt: null,
      resolutionReason: null,
    };
    store.data.update((data) => ({
      ...data,
      accessEnabled: true,
      currentUserId: 'reviewer',
      role: 'member',
      canReview: true,
      corrections: [correction],
    }));
    TestBed.configureTestingModule({
      imports: [ReviewsPage],
      providers: [
        { provide: HouseholdStore, useValue: store },
        { provide: Confirm, useValue: { ask: vi.fn().mockResolvedValue(true) } },
        { provide: ReceiptPreview, useValue: { open: vi.fn() } },
      ],
    });
  });
  it('muestra ambos importes y aprueba mediante la operación protegida', async () => {
    const fixture = TestBed.createComponent(ReviewsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.replace(/\s/g, '')).toContain('S/90.00');
    expect(fixture.nativeElement.textContent.replace(/\s/g, '')).toContain('S/95.00');
    await fixture.componentInstance.resolve(correction, true);
    expect(store.resolveCorrection).toHaveBeenCalledWith('correction', true, '');
  });
  it('no permite resolver la solicitud propia ni desde una cuenta sin permiso', async () => {
    const page = TestBed.createComponent(ReviewsPage).componentInstance;
    correction.requestedBy = 'reviewer';
    await page.resolve(correction, true);
    expect(store.resolveCorrection).not.toHaveBeenCalled();
    correction.requestedBy = 'other';
    store.data.update((data) => ({ ...data, canReview: false }));
    await page.resolve(correction, true);
    expect(store.resolveCorrection).not.toHaveBeenCalled();
  });
  it('exige motivo para rechazar y respeta la cancelación', async () => {
    const page = TestBed.createComponent(ReviewsPage).componentInstance;
    await page.resolve(correction, false);
    expect(page.error()).toContain('motivo');
    expect(store.resolveCorrection).not.toHaveBeenCalled();
    page.reason.setValue('Importe original correcto');
    vi.mocked(TestBed.inject(Confirm).ask).mockResolvedValue(false);
    await page.resolve(correction, false);
    expect(store.resolveCorrection).not.toHaveBeenCalled();
  });
});
