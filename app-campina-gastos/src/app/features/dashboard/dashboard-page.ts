import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { HouseholdStore } from '../../data-access/household-store';
import { formatMoney, monthLabel } from '../../domain/money';
import { SERVICES, ServiceCode } from '../../domain/models';
import { Icon } from '../../shared/ui/icon';
import { GroupCards } from '../../shared/ui/group-cards';
import { ReceiptPreview } from '../../shared/ui/file-preview';
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, MatButtonModule, Icon, GroupCards, DatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly store = inject(HouseholdStore);
  readonly preview = inject(ReceiptPreview);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly services = SERVICES;
  receipt(service: ServiceCode) {
    return this.store.receipts().find((r) => r.service === service);
  }
  count(): number {
    return this.store.calculation()?.receiptCount ?? 0;
  }
}
