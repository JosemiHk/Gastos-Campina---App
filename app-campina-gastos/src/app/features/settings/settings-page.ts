import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../../data-access/household-store';
import { TransferAccount } from '../../domain/models';
import { formatMoney, monthLabel, parseMoney } from '../../domain/money';
import { errorMessage } from '../../core/errors';
import { Icon } from '../../shared/ui/icon';
import { Confirm } from '../../shared/ui/confirm-dialog';
const trimmedRequired = (control: AbstractControl) =>
  String(control.value).trim() ? null : { required: true };
function accountForm(account?: TransferAccount) {
  return new FormGroup({
    id: new FormControl(account?.id ?? crypto.randomUUID(), { nonNullable: true }),
    kind: new FormControl<TransferAccount['kind']>(account?.kind ?? 'yape', { nonNullable: true }),
    label: new FormControl(account?.label ?? '', {
      nonNullable: true,
      validators: [trimmedRequired, Validators.maxLength(60)],
    }),
    holder: new FormControl(account?.holder ?? '', {
      nonNullable: true,
      validators: [trimmedRequired, Validators.maxLength(100)],
    }),
    number: new FormControl(account?.number ?? '', {
      nonNullable: true,
      validators: [trimmedRequired, Validators.maxLength(60)],
    }),
    cci: new FormControl(account?.cci ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(30)],
    }),
  });
}
@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, MatButtonModule, Icon],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly store = inject(HouseholdStore);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly snack = inject(MatSnackBar);
  private readonly confirm = inject(Confirm);
  readonly form = new FormGroup({
    fixed: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) =>
          control.value.trim() === '0' ||
          /^0[.,]00?$/.test(control.value.trim()) ||
          parseMoney(control.value) !== null
            ? null
            : { money: true },
      ],
    }),
    accounts: new FormArray<ReturnType<typeof accountForm>>([]),
  });
  get accounts() {
    return this.form.controls.accounts;
  }
  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.store.hasUnsavedChanges.set(this.form.dirty));
    effect(() => {
      this.store.selectedMonth();
      const data = this.store.data();
      this.form.controls.fixed.setValue((this.store.fixedContributionCents() / 100).toFixed(2));
      this.accounts.clear();
      for (const account of data?.accounts ?? []) this.accounts.push(accountForm(account));
      this.form.markAsPristine();
      this.store.hasUnsavedChanges.set(false);
      this.error.set('');
    });
    inject(DestroyRef).onDestroy(() => this.store.hasUnsavedChanges.set(false));
  }
  addAccount(): void {
    if (this.accounts.length >= 5) return;
    this.accounts.push(accountForm());
    this.form.markAsDirty();
    this.store.hasUnsavedChanges.set(true);
  }
  removeAccount(index: number): void {
    this.accounts.removeAt(index);
    this.form.markAsDirty();
    this.store.hasUnsavedChanges.set(true);
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || !this.store.isAdmin() || this.store.closed()) return;
    const fixed = parseMoney(this.form.controls.fixed.value) ?? 0;
    if (
      fixed !== this.store.fixedContributionCents() &&
      (this.store.calculation()?.receiptCount ?? 0) > 0 &&
      !(await this.confirm.ask({
        title: 'Actualizar el aporte de Rossana',
        message: `El aporte cambiará de ${formatMoney(this.store.fixedContributionCents())} a ${formatMoney(fixed)} y se recalcularán las cuotas de ${monthLabel(this.store.selectedMonth())}. Revisa las diferencias si ya recibiste aportes.`,
        action: 'Guardar y recalcular',
      }))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.saveSettings(fixed, this.accounts.getRawValue());
      this.form.markAsPristine();
      this.store.hasUnsavedChanges.set(false);
      this.snack.open('Reglas y datos de transferencia guardados.', 'Cerrar', { duration: 5000 });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges() || this.busy()) event.preventDefault();
  }
}
