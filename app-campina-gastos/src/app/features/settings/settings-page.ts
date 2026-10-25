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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { HouseholdStore } from '../../data-access/household-store';
import {
  EditablePaymentGroup,
  GroupCode,
  PaymentGroup,
  RegularGroupCode,
  RuleParticipants,
  ServiceCode,
  SERVICES,
  TransferAccount,
} from '../../domain/models';
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
const memberControl = (name = '') =>
  new FormControl(name, {
    nonNullable: true,
    validators: [trimmedRequired, Validators.maxLength(80)],
  });
function groupForm(group: PaymentGroup, rules: RuleParticipants) {
  return new FormGroup({
    code: new FormControl(group.code, { nonNullable: true }),
    name: memberControl(group.name),
    members: new FormArray(group.members.map(memberControl)),
    services: new FormGroup({
      water: new FormControl(
        rules.water.some((code) => code === group.code),
        { nonNullable: true },
      ),
      electricity: new FormControl(
        rules.electricity.some((code) => code === group.code),
        {
          nonNullable: true,
        },
      ),
      internet: new FormControl(
        rules.internet.some((code) => code === group.code),
        {
          nonNullable: true,
        },
      ),
    }),
  });
}
@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, MatButtonModule, Icon, RouterLink],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly store = inject(HouseholdStore);
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly services = SERVICES;
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
    groups: new FormArray<ReturnType<typeof groupForm>>([]),
  });
  readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  get accounts() {
    return this.form.controls.accounts;
  }
  get groups() {
    return this.form.controls.groups;
  }
  groupLabel(code: GroupCode): string {
    this.values();
    return (
      this.groups.controls
        .find((group) => group.controls.code.value === code)
        ?.controls.name.value.trim() || this.store.groupName(code)
    );
  }
  selectedParticipants(service: ServiceCode): RuleParticipants[ServiceCode] {
    this.values();
    return this.groups.controls
      .filter(
        (group) =>
          group.controls.code.value !== 'rossana' &&
          group.controls.services.controls[service].value,
      )
      .map((group) => group.controls.code.value as RegularGroupCode);
  }
  participantNames(service: ServiceCode): string {
    return this.selectedParticipants(service)
      .map((code) => this.groupLabel(code))
      .join(', ');
  }
  addMember(index: number): void {
    const members = this.groups.at(index).controls.members;
    if (members.length >= 10) return;
    members.push(memberControl());
    this.form.markAsDirty();
    this.store.hasUnsavedChanges.set(true);
  }
  removeMember(groupIndex: number, index: number): void {
    const members = this.groups.at(groupIndex).controls.members;
    if (members.length <= 1) return;
    members.removeAt(index);
    this.form.markAsDirty();
    this.store.hasUnsavedChanges.set(true);
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
      this.groups.clear();
      for (const group of data?.groups ?? [])
        this.groups.push(
          groupForm(
            this.store.closed()
              ? {
                  ...group,
                  name: this.store.groupName(group.code),
                  members: this.store.groupMembers(group.code),
                }
              : group,
            this.store.participants(),
          ),
        );
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
    const groups: EditablePaymentGroup[] = this.groups
      .getRawValue()
      .map(({ code, name, members }) => ({
        code,
        name: name.trim(),
        members: members.map((name) => name.trim()),
      }));
    const participants: RuleParticipants = {
      water: this.selectedParticipants('water'),
      electricity: this.selectedParticipants('electricity'),
      internet: this.selectedParticipants('internet'),
    };
    if (
      this.store.editableGroups() &&
      (Object.values(participants).some((codes) => !codes.length) ||
        new Set(groups.map((group) => group.name.toLocaleLowerCase())).size !== groups.length ||
        groups.some(
          (group) =>
            new Set(group.members.map((name) => name.toLocaleLowerCase())).size !==
            group.members.length,
        ))
    ) {
      this.error.set(
        'Selecciona al menos un grupo por servicio y evita nombres o integrantes repetidos.',
      );
      return;
    }
    const rulesChanged = this.services.some(
      (service) =>
        JSON.stringify(participants[service.code]) !==
        JSON.stringify(this.store.participants()[service.code]),
    );
    if (
      (fixed !== this.store.fixedContributionCents() || rulesChanged) &&
      (this.store.calculation()?.receiptCount ?? 0) > 0 &&
      !(await this.confirm.ask({
        title: 'Actualizar el reparto del mes',
        message: `Se recalcularán las cuotas de ${monthLabel(this.store.selectedMonth())} con los grupos seleccionados y un aporte fijo de ${formatMoney(fixed)}. Los pagos recibidos se conservarán. Revisa las diferencias antes de compartir el resumen.`,
        action: 'Guardar y recalcular',
      }))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.store.editableGroups())
        await this.store.saveHouseholdSettings(
          fixed,
          this.accounts.getRawValue(),
          groups,
          participants,
        );
      else await this.store.saveSettings(fixed, this.accounts.getRawValue());
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
