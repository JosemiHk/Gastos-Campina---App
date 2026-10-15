import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { HouseholdStore } from '../../data-access/household-store';
import { BillingPeriod, GroupCode } from '../../domain/models';
import { formatMoney, monthLabel } from '../../domain/money';
import { groupTotals } from '../../domain/distribution';
import { Icon } from '../../shared/ui/icon';
@Component({
  selector: 'app-history-page',
  imports: [RouterLink, MatButtonModule, Icon],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  readonly store = inject(HouseholdStore);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly year = signal(this.store.selectedMonth().slice(0, 4));
  readonly years = computed(() =>
    [
      ...new Set([
        this.store.selectedMonth().slice(0, 4),
        this.year(),
        ...(this.store.data()?.periods.map((p) => p.month.slice(0, 4)) ?? []),
      ]),
    ]
      .sort()
      .reverse(),
  );
  readonly periods = computed(
    () => this.store.data()?.periods.filter((p) => p.month.startsWith(this.year())) ?? [],
  );
  readonly total = computed(() =>
    this.periods().reduce((sum, p) => sum + (p.calculation?.totalCents ?? 0), 0),
  );
  readonly chart = computed(() =>
    this.periods()
      .filter((p) => (p.calculation?.receiptCount ?? 0) > 0)
      .slice()
      .reverse(),
  );
  readonly max = computed(() =>
    Math.max(1, ...this.chart().map((p) => p.calculation?.totalCents ?? 0)),
  );
  readonly average = computed(() =>
    this.chart().length ? Math.round(this.total() / this.chart().length) : 0,
  );
  shortMonth(month: string): string {
    return new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${month}T12:00:00Z`),
    );
  }
  groups(period: BillingPeriod): { code: GroupCode; name: string; amount: number }[] {
    const totals = groupTotals(period.calculation);
    return (this.store.data()?.groups ?? [])
      .filter(
        (g) =>
          g.kind === 'regular' ||
          period.calculation?.allocations.some((a) => a.groupCode === g.code),
      )
      .map((g) => ({
        code: g.code,
        name: period.calculation?.groupNames?.[g.code] ?? g.name,
        amount: totals[g.code],
      }));
  }
  paidCount(period: BillingPeriod): string {
    const groups = this.groups(period).filter((g) => g.amount > 0);
    const paid = groups.filter(
      (g) =>
        period.payments
          .filter((p) => p.groupCode === g.code && !p.voidedAt)
          .reduce((sum, p) => sum + p.amountCents, 0) >= g.amount,
    ).length;
    return `${paid}/${groups.length} aportes recibidos`;
  }
}
