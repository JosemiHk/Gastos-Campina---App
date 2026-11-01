import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Auth } from '../core/auth';
import { errorMessage } from '../core/errors';
import { Supabase } from '../core/supabase';
import { equalWeights, ruleDescription, groupTotals } from '../domain/distribution';
import {
  DEFAULT_PARTICIPANTS,
  EditablePaymentGroup,
  GroupCode,
  HouseholdData,
  ReceiptInput,
  RuleParticipants,
  RuleWeights,
  ServiceCode,
  TransferAccount,
} from '../domain/models';
import { monthNow } from '../domain/money';
import { Json } from './database.types';

@Injectable({ providedIn: 'root' })
export class HouseholdStore {
  private readonly backend = inject(Supabase);
  private readonly auth = inject(Auth);
  readonly data = signal<HouseholdData | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly selectedMonth = signal(monthNow());
  readonly hasUnsavedChanges = signal(false);
  readonly participants = computed(
    () =>
      this.period()?.participants ?? this.data()?.household.participants ?? DEFAULT_PARTICIPANTS,
  );
  readonly weights = computed(() =>
    this.period()
      ? (this.period()?.ruleWeights ??
        this.calculation()?.ruleWeights ??
        equalWeights(this.participants()))
      : (this.data()?.household.ruleWeights ?? equalWeights(this.participants())),
  );
  readonly editableWeights = computed(() => this.data()?.household.ruleWeights !== undefined);
  readonly editableGroups = computed(
    () => this.data()?.household.configurationRevision !== undefined,
  );
  readonly period = computed(
    () => this.data()?.periods.find((p) => p.month === this.selectedMonth()) ?? null,
  );
  readonly receipts = computed(() => this.period()?.receipts ?? []);
  readonly calculation = computed(() => this.period()?.calculation ?? null);
  readonly totals = computed(() => groupTotals(this.calculation()));
  readonly isAdmin = computed(() => this.data()?.role === 'admin');
  readonly closed = computed(() => this.period()?.status === 'closed');
  readonly fixedContributionCents = computed(
    () =>
      this.period()?.fixedContributionCents ??
      this.data()?.household.fixedContributionCents ??
      2000,
  );
  private loadId = 0;
  constructor() {
    effect(() => {
      if (!this.auth.user()) {
        this.loadId++;
        this.data.set(null);
        this.error.set('');
      }
    });
  }
  async load(): Promise<void> {
    const request = ++this.loadId;
    this.loading.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.backend.client.rpc('get_household');
      if (error) throw error;
      if (request !== this.loadId) return;
      if (
        data !== null &&
        (!data ||
          typeof data !== 'object' ||
          Array.isArray(data) ||
          !('household' in data) ||
          !Array.isArray(data['groups']) ||
          !Array.isArray(data['periods']) ||
          !Array.isArray(data['accounts']) ||
          !['admin', 'viewer'].includes(String(data['role'])))
      )
        throw new Error('Los datos del hogar no son válidos.');
      this.data.set(data as unknown as HouseholdData | null);
    } catch (error) {
      if (request === this.loadId) this.error.set(errorMessage(error));
    } finally {
      if (request === this.loadId) this.loading.set(false);
    }
  }
  paid(code: GroupCode): number {
    return (
      this.period()
        ?.payments.filter((p) => p.groupCode === code && !p.voidedAt)
        .reduce((sum, p) => sum + p.amountCents, 0) ?? 0
    );
  }
  balance(code: GroupCode): number {
    return this.totals()[code] - this.paid(code);
  }
  groupName(code: GroupCode): string {
    return (
      this.calculation()?.groupNames?.[code] ??
      this.data()?.groups.find((group) => group.code === code)?.name ??
      code
    );
  }
  groupMembers(code: GroupCode): string[] {
    return (
      this.calculation()?.groupMembers?.[code] ??
      this.data()?.groups.find((group) => group.code === code)?.members ??
      []
    );
  }
  participantNames(service: ServiceCode): string {
    return this.participants()
      [service].map((code) => this.groupName(code))
      .join(', ');
  }
  ruleDescription(service: ServiceCode): string {
    return ruleDescription(service, this.participants(), this.weights(), (code) =>
      this.groupName(code),
    );
  }
  serviceRule(service: ServiceCode): string {
    const weights = this.weights()[service];
    const codes = this.participants()[service];
    const unequal = codes.some((code) => (weights[code] ?? 1) !== 1);
    const text = unequal
      ? `Por personas · ${codes.reduce((sum, code) => sum + (weights[code] ?? 1), 0)} partes`
      : `Entre ${codes.length} ${codes.length === 1 ? 'grupo' : 'grupos'}`;
    return service === 'electricity' ? `Aporte fijo + ${text.toLowerCase()}` : text;
  }
  private args() {
    const household = this.data()?.household.id;
    if (!household || !this.isAdmin())
      throw new Error('No tienes permiso para modificar este hogar.');
    return {
      p_household: household,
      p_month: this.selectedMonth(),
      p_revision: this.period()?.revision ?? 0,
    };
  }
  async saveReceipt(receipt: ReceiptInput): Promise<void> {
    const args = this.args();
    await this.mutate(() =>
      this.backend.client.rpc('save_receipt', { ...args, p_receipt: receipt as unknown as Json }),
    );
  }
  async closePeriod(): Promise<void> {
    const args = this.args();
    await this.mutate(() => this.backend.client.rpc('close_period', args));
  }
  async confirmPayment(code: GroupCode, method: string): Promise<void> {
    const args = this.args();
    await this.mutate(() =>
      this.backend.client.rpc('confirm_payment', { ...args, p_group: code, p_method: method }),
    );
  }
  async voidPayment(id: string, reason: string): Promise<void> {
    const args = this.args();
    await this.mutate(() =>
      this.backend.client.rpc('void_payment', { ...args, p_payment: id, p_reason: reason }),
    );
  }
  async saveSettings(fixed: number, accounts: TransferAccount[]): Promise<void> {
    const args = this.args();
    await this.mutate(() =>
      this.backend.client.rpc('save_settings', {
        ...args,
        p_fixed: fixed,
        p_accounts: accounts as unknown as Json,
      }),
    );
  }
  async saveHouseholdSettings(
    fixed: number,
    accounts: TransferAccount[],
    groups: EditablePaymentGroup[],
    participants: RuleParticipants,
    weights?: RuleWeights,
  ): Promise<void> {
    const args = this.args();
    const revision = this.data()?.household.configurationRevision;
    if (revision === undefined) throw new Error('La edición de grupos aún no está habilitada.');
    await this.mutate(() =>
      this.backend.client.rpc(
        weights ? 'save_weighted_household_settings' : 'save_household_settings',
        {
          ...args,
          ...(weights ? { p_weights: weights as unknown as Json } : {}),
          p_configuration_revision: revision,
          p_fixed: fixed,
          p_accounts: accounts as unknown as Json,
          p_groups: groups as unknown as Json,
          p_participants: participants as unknown as Json,
        },
      ),
    );
  }
  private async mutate(action: () => PromiseLike<{ error: unknown }>): Promise<void> {
    if (this.saving()) throw new Error('Espera a que termine la operación actual.');
    this.saving.set(true);
    try {
      const { error } = await action();
      if (error) throw error;
      this.hasUnsavedChanges.set(false);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
