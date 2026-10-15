import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../../data-access/household-store';
import { GroupCode, ServiceCode, SERVICES } from '../../domain/models';
import { formatMoney } from '../../domain/money';
import { errorMessage } from '../../core/errors';
import { Icon } from './icon';
import { PaymentDialog } from './payment-dialog';
@Component({
  selector: 'app-group-cards',
  imports: [MatButtonModule, Icon],
  templateUrl: './group-cards.html',
  styleUrl: './group-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCards {
  readonly store = inject(HouseholdStore);
  readonly detailed = input(false);
  readonly money = formatMoney;
  readonly services = SERVICES;
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  groupName(code: GroupCode): string {
    return this.store.groupName(code);
  }
  participates(code: GroupCode, service: ServiceCode): boolean {
    return this.store.participants()[service].some((participant) => participant === code);
  }
  amount(code: GroupCode, service: string): number {
    return (
      this.store
        .calculation()
        ?.allocations.filter((a) => a.groupCode === code && a.service === service)
        .reduce((sum, a) => sum + a.amountCents, 0) ?? 0
    );
  }
  hasService(service: string): boolean {
    return this.store.receipts().some((r) => r.status === 'confirmed' && r.service === service);
  }
  visible(code: GroupCode): boolean {
    return code !== 'rossana' || this.hasService('electricity');
  }
  activePayments(code: GroupCode) {
    return this.store.period()?.payments.filter((p) => p.groupCode === code && !p.voidedAt) ?? [];
  }
  async confirm(code: GroupCode): Promise<void> {
    const method = await firstValueFrom(
      this.dialog
        .open<PaymentDialog, unknown, string | null>(PaymentDialog, {
          data: { void: false, name: this.groupName(code), amount: this.store.balance(code) },
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
        })
        .afterClosed(),
    );
    if (!method) return;
    try {
      await this.store.confirmPayment(code, method);
      this.snack.open('Aporte registrado.', 'Cerrar', { duration: 4000 });
    } catch (error) {
      this.snack.open(errorMessage(error), 'Cerrar', { duration: 7000 });
    }
  }
  async voidPayment(id: string, code: GroupCode, amount: number): Promise<void> {
    const reason = await firstValueFrom(
      this.dialog
        .open<PaymentDialog, unknown, string | null>(PaymentDialog, {
          data: { void: true, name: this.groupName(code), amount },
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
        })
        .afterClosed(),
    );
    if (!reason) return;
    try {
      await this.store.voidPayment(id, reason);
      this.snack.open('Confirmación anulada. Se conservó el registro.', 'Cerrar', {
        duration: 4000,
      });
    } catch (error) {
      this.snack.open(errorMessage(error), 'Cerrar', { duration: 7000 });
    }
  }
}
