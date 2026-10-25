import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../../data-access/household-store';
import { ReceiptCorrection, SERVICES } from '../../domain/models';
import { formatMoney, monthLabel } from '../../domain/money';
import { errorMessage } from '../../core/errors';
import { Icon } from '../../shared/ui/icon';
import { Confirm } from '../../shared/ui/confirm-dialog';
import { ReceiptPreview } from '../../shared/ui/file-preview';

@Component({
  selector: 'app-reviews-page',
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, Icon],
  templateUrl: './reviews-page.html',
  styleUrl: './reviews-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class ReviewsPage {
  readonly store = inject(HouseholdStore);
  readonly preview = inject(ReceiptPreview);
  private readonly confirm = inject(Confirm);
  private readonly snack = inject(MatSnackBar);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showHistory = signal(false);
  readonly reason = new FormControl('', { nonNullable: true });
  readonly selected = signal<string | null>(null);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly items = computed(() =>
    this.store
      .corrections()
      .filter(
        (c) =>
          c.month === this.store.selectedMonth() &&
          (this.store.canReview() || c.requestedBy === this.store.currentUserId()) &&
          (this.showHistory() || c.status === 'pending'),
      ),
  );
  readonly labels = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    stale: 'Desactualizada',
  };
  constructor() {
    this.reason.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.store.hasUnsavedChanges.set(this.reason.dirty));
    inject(DestroyRef).onDestroy(() => this.store.hasUnsavedChanges.set(false));
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges() || this.busy()) event.preventDefault();
  }
  service(c: ReceiptCorrection): string {
    return SERVICES.find((s) => s.code === c.proposed.service)?.name ?? 'Servicio';
  }
  canResolve(c: ReceiptCorrection): boolean {
    return (
      this.store.canReview() &&
      c.status === 'pending' &&
      c.requestedBy !== this.store.currentUserId() &&
      !this.store.closed()
    );
  }
  async resolve(c: ReceiptCorrection, approve: boolean): Promise<void> {
    if (this.busy() || !this.canResolve(c)) return;
    const reason = this.reason.value.trim();
    if (!approve && reason.length < 3) {
      this.error.set('Indica el motivo del rechazo.');
      return;
    }
    if (
      !(await this.confirm.ask({
        title: approve ? 'Aprobar corrección' : 'Rechazar corrección',
        message: approve
          ? 'Se actualizará el recibo vigente y se recalculará el reparto. Los aportes ya registrados se conservarán.'
          : 'Se conservará el recibo vigente y se informará el motivo del rechazo.',
        action: approve ? 'Aprobar y recalcular' : 'Rechazar',
      }))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.resolveCorrection(c.id, approve, reason);
      this.selected.set(null);
      this.reason.reset();
      this.snack.open(
        approve ? 'Corrección aprobada y reparto actualizado.' : 'Corrección rechazada.',
        'Cerrar',
        { duration: 4500 },
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
