import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../../data-access/household-store';
import { summaryText } from '../../domain/summary';
import { GroupCode, SERVICES } from '../../domain/models';
import { formatMoney, monthLabel } from '../../domain/money';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-summary-page',
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, Icon],
  templateUrl: './summary-page.html',
  styleUrl: './summary-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryPage {
  readonly store = inject(HouseholdStore);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly services = SERVICES;
  private readonly snack = inject(MatSnackBar);
  readonly format = new FormControl<'both' | 'image' | 'text'>('both', { nonNullable: true });
  readonly voucher = viewChild<ElementRef<HTMLElement>>('voucher');
  readonly imageBusy = signal(false);
  readonly shareBusy = signal(false);
  readonly imageError = signal('');
  readonly cachedFile = signal<File | null>(null);
  readonly text = computed(() => {
    const period = this.store.period();
    return period
      ? summaryText(period, this.store.data()?.groups ?? [], this.store.data()?.accounts ?? [])
      : '';
  });
  readonly groups = computed(
    () =>
      this.store
        .data()
        ?.groups.filter(
          (g) =>
            g.kind === 'regular' ||
            this.store.calculation()?.allocations.some((a) => a.groupCode === g.code),
        ) ?? [],
  );
  private sequence = 0;
  constructor() {
    afterRenderEffect(() => {
      const element = this.voucher()?.nativeElement;
      const signature = JSON.stringify([
        this.store.selectedMonth(),
        this.store.period()?.revision,
        this.store.data()?.accounts,
      ]);
      if (element && this.store.calculation()?.receiptCount)
        void this.prepareImage(element, signature);
    });
  }
  groupName(code: GroupCode): string {
    return (
      this.store.calculation()?.groupNames?.[code] ??
      this.store.data()?.groups.find((g) => g.code === code)?.name ??
      code
    );
  }
  serviceAmount(code: string): number | null {
    return (
      this.store.receipts().find((r) => r.service === code && r.status === 'confirmed')
        ?.amountCents ?? null
    );
  }
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.snack.open('Resumen copiado. Ya puedes pegarlo en WhatsApp.', 'Cerrar', {
        duration: 4500,
      });
    } catch {
      this.snack.open('Selecciona el texto del resumen y cópialo para compartir.', 'Cerrar', {
        duration: 6000,
      });
    }
  }
  async retryImage(): Promise<void> {
    const element = this.voucher()?.nativeElement;
    if (element) await this.prepareImage(element, String(Date.now()));
  }
  private async prepareImage(element: HTMLElement, _signature: string): Promise<void> {
    const sequence = ++this.sequence;
    this.cachedFile.set(null);
    this.imageBusy.set(true);
    this.imageError.set('');
    try {
      await document.fonts.ready;
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(element, {
        width: 540,
        height: Math.max(675, Math.ceil(element.scrollHeight)),
        pixelRatio: 2,
        backgroundColor: '#053931',
        style: { width: '540px', maxWidth: 'none', minHeight: '675px' },
        cacheBust: false,
      });
      if (!blob) throw new Error('No se pudo crear la imagen.');
      if (sequence === this.sequence)
        this.cachedFile.set(
          new File([blob], `campina-gastos-${this.store.selectedMonth().slice(0, 7)}.png`, {
            type: 'image/png',
          }),
        );
    } catch {
      if (sequence === this.sequence)
        this.imageError.set(
          'No pudimos generar la imagen. Puedes copiar el texto o volver a intentarlo.',
        );
    } finally {
      if (sequence === this.sequence) this.imageBusy.set(false);
    }
  }
  download(): void {
    const file = this.cachedFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    this.snack.open('Imagen descargada. Puedes adjuntarla en WhatsApp.', 'Cerrar', {
      duration: 4500,
    });
  }
  async share(): Promise<void> {
    if (this.shareBusy()) return;
    const format = this.format.value;
    const file = this.cachedFile();
    const data: ShareData = { title: `Campiña Gastos · ${monthLabel(this.store.selectedMonth())}` };
    if (format !== 'image') data.text = this.text();
    if (format !== 'text' && file) data.files = [file];
    if (format !== 'text' && !file) {
      this.snack.open('Espera a que la imagen esté lista o elige solo texto.', 'Cerrar', {
        duration: 4500,
      });
      return;
    }
    if (navigator.share && (!data.files || navigator.canShare?.({ files: data.files }))) {
      this.shareBusy.set(true);
      try {
        await navigator.share(data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          this.snack.open(
            'Usa Descargar imagen o Copiar texto para adjuntarlo al chat.',
            'Cerrar',
            { duration: 6500 },
          );
      } finally {
        this.shareBusy.set(false);
      }
    } else if (format === 'text') {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(this.text())}`,
        '_blank',
        'noopener,noreferrer',
      );
    } else {
      this.download();
      if (format === 'both') await this.copy();
    }
  }
}
