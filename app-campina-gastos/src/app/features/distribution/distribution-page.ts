import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../../data-access/household-store';
import { formatMoney, monthLabel } from '../../domain/money';
import { SERVICES, ServiceCode } from '../../domain/models';
import { Icon } from '../../shared/ui/icon';
import { GroupCards } from '../../shared/ui/group-cards';
import { Confirm } from '../../shared/ui/confirm-dialog';
import { errorMessage } from '../../core/errors';
@Component({
  selector: 'app-distribution-page',
  imports: [RouterLink, MatButtonModule, Icon, GroupCards],
  templateUrl: './distribution-page.html',
  styleUrl: './distribution-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DistributionPage {
  readonly store = inject(HouseholdStore);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly services = SERVICES;
  readonly closing = signal(false);
  private readonly confirm = inject(Confirm);
  private readonly snack = inject(MatSnackBar);
  receipt(service: ServiceCode) {
    return this.store.receipts().find((r) => r.service === service && r.status === 'confirmed');
  }
  async close(): Promise<void> {
    if (
      !(await this.confirm.ask({
        title: `Cerrar ${monthLabel(this.store.selectedMonth())}`,
        message:
          'Se guardará la liquidación definitiva. Después del cierre no podrás modificar los recibos ni las reglas de este mes. Los aportes pendientes podrán seguir registrándose.',
        action: 'Cerrar mes',
      }))
    )
      return;
    this.closing.set(true);
    try {
      await this.store.closePeriod();
      this.snack.open('Mes cerrado. La liquidación quedó protegida.', 'Cerrar', { duration: 5000 });
    } catch (error) {
      this.snack.open(errorMessage(error), 'Cerrar', { duration: 7000 });
    } finally {
      this.closing.set(false);
    }
  }
}
