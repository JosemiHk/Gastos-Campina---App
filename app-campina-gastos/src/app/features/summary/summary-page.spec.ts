import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SummaryPage } from './summary-page';
import { HouseholdStore } from '../../data-access/household-store';
import { storeFixture } from '../../../testing/household-fixture';
const toBlob = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toBlob }));
describe('exportación del resumen', () => {
  it.each([540, 360])(
    'exporta a 1080px desde una superficie fija aunque la vista mida %ipx',
    async (width) => {
      toBlob.mockClear();
      const size = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
      toBlob.mockResolvedValue(new Blob(['test-only-image'], { type: 'image/png' }));
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { ready: Promise.resolve() },
      });
      TestBed.configureTestingModule({
        imports: [SummaryPage],
        providers: [provideRouter([]), { provide: HouseholdStore, useValue: storeFixture() }],
      });
      const fixture = TestBed.createComponent(SummaryPage);
      fixture.detectChanges();
      await vi.waitFor(() => expect(fixture.componentInstance.cachedFile()).not.toBeNull());
      expect(toBlob).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          width: 540,
          pixelRatio: 2,
          height: 675,
          style: expect.objectContaining({ width: '540px', minHeight: '0' }),
        }),
      );
      expect(toBlob.mock.calls[0][0].parentElement.classList.contains('voucher-export')).toBe(true);
      expect(
        fixture.nativeElement.querySelector('.voucher-export').getAttribute('aria-hidden'),
      ).toBe('true');
      expect(fixture.componentInstance.text()).toContain('83.34');
      expect(fixture.nativeElement.querySelector('.voucher').textContent).toContain('83.34');
      expect(fixture.componentInstance.cachedFile()?.name).toBe('campina-gastos-2026-10.png');
      size.mockRestore();
    },
  );
});
