import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../../data-access/household-store';
import { Files, UploadedFile } from '../../data-access/files';
import { calculateDistribution, groupTotals } from '../../domain/distribution';
import { formatMoney, monthLabel, parseMoney } from '../../domain/money';
import { GROUP_ORDER, GroupCode, Receipt, ServiceCode, SERVICES } from '../../domain/models';
import { Icon } from '../../shared/ui/icon';
import { ReceiptPreview } from '../../shared/ui/file-preview';
import { errorMessage } from '../../core/errors';

@Component({
  selector: 'app-receipt-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, Icon],
  templateUrl: './receipt-page.html',
  styleUrl: './receipt-page.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptPage {
  readonly store = inject(HouseholdStore);
  readonly previewFile = inject(ReceiptPreview);
  private readonly files = inject(Files);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly editing = computed(
    () => this.store.receipts().find((r) => r.id === this.query().get('recibo')) ?? null,
  );
  readonly notFound = computed(() => !!this.query().get('recibo') && !this.editing());
  readonly form = new FormGroup({
    service: new FormControl<ServiceCode>('water', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [
        (control: AbstractControl) =>
          parseMoney(String(control.value)) === null ? { money: true } : null,
      ],
    }),
    dueDate: new FormControl('', { nonNullable: true }),
    issueDate: new FormControl('', { nonNullable: true }),
  });
  readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly file = signal<File | null>(null);
  readonly removeFile = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly services = SERVICES;
  readonly money = formatMoney;
  readonly monthLabel = monthLabel;
  readonly groupOrder = GROUP_ORDER;
  private receiptId: string = crypto.randomUUID();
  readonly duplicate = computed(() => {
    this.value();
    return !this.editing()
      ? (this.store.receipts().find((r) => r.service === this.form.controls.service.value) ?? null)
      : null;
  });
  readonly simulation = computed(() => {
    this.value();
    const cents = parseMoney(this.form.controls.amount.value);
    if (cents === null) return { calculation: null, error: '' };
    try {
      return {
        calculation: calculateDistribution(
          [{ service: this.form.controls.service.value, amountCents: cents, status: 'confirmed' }],
          this.store.fixedContributionCents(),
        ),
        error: '',
      };
    } catch (error) {
      return { calculation: null, error: errorMessage(error) };
    }
  });
  readonly totals = computed(() => groupTotals(this.simulation().calculation));
  readonly existingFileName = computed(
    () => this.file()?.name ?? (!this.removeFile() ? this.editing()?.fileName : null),
  );
  readonly selectedService = computed(() => {
    this.value();
    return SERVICES.find((s) => s.code === this.form.controls.service.value)!;
  });
  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.store.hasUnsavedChanges.set(this.form.dirty));
    effect(() => {
      this.store.selectedMonth();
      const existing = this.editing();
      this.receiptId = existing?.id ?? crypto.randomUUID();
      this.form.reset({
        service: existing?.service ?? 'water',
        amount: existing ? (existing.amountCents / 100).toFixed(2) : '',
        dueDate: existing?.dueDate ?? '',
        issueDate: existing?.issueDate ?? '',
      });
      if (existing) this.form.controls.service.disable();
      else this.form.controls.service.enable();
      this.file.set(null);
      this.removeFile.set(false);
      this.error.set('');
      this.store.hasUnsavedChanges.set(false);
    });
    inject(DestroyRef).onDestroy(() => this.store.hasUnsavedChanges.set(false));
  }
  selectService(code: ServiceCode): void {
    if (this.editing()) return;
    this.form.controls.service.setValue(code);
    this.form.markAsDirty();
    this.store.hasUnsavedChanges.set(true);
  }
  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.files.validate(file);
      this.file.set(file);
      this.removeFile.set(false);
      this.store.hasUnsavedChanges.set(true);
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error));
    }
    input.value = '';
  }
  clearFile(): void {
    this.file.set(null);
    this.removeFile.set(true);
    this.store.hasUnsavedChanges.set(true);
  }
  async save(status: 'draft' | 'confirmed'): Promise<void> {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.busy() ||
      this.duplicate() ||
      !this.store.isAdmin() ||
      this.store.closed()
    )
      return;
    if (status === 'confirmed' && this.simulation().error) {
      this.error.set(this.simulation().error);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    let uploaded: UploadedFile | null = null;
    const month = this.store.selectedMonth();
    try {
      const file = this.file();
      if (file) {
        this.store.uploading.set(true);
        uploaded = await this.files.upload(file, this.store.data()!.household.id, month);
        this.store.uploading.set(false);
      }
      const existing = this.editing();
      const values = this.form.getRawValue();
      await this.store.saveReceipt({
        id: this.receiptId,
        service: values.service,
        amountCents: parseMoney(values.amount)!,
        status,
        dueDate: values.dueDate || null,
        issueDate: values.issueDate || null,
        filePath: uploaded?.filePath ?? (!this.removeFile() ? existing?.filePath : null) ?? null,
        fileName: uploaded?.fileName ?? (!this.removeFile() ? existing?.fileName : null) ?? null,
        fileSize: uploaded?.fileSize ?? (!this.removeFile() ? existing?.fileSize : null) ?? null,
        fileType: uploaded?.fileType ?? (!this.removeFile() ? existing?.fileType : null) ?? null,
      });
      this.form.markAsPristine();
      this.store.hasUnsavedChanges.set(false);
      this.snack.open(
        status === 'draft' ? 'Borrador guardado.' : 'Recibo guardado y reparto actualizado.',
        'Cerrar',
        { duration: 4000 },
      );
      await this.router.navigate([status === 'draft' ? '/resumen' : '/calculo'], {
        queryParams: { mes: month.slice(0, 7) },
      });
    } catch (error) {
      this.error.set(errorMessage(error));
      if (uploaded) await this.files.removeUnused(uploaded.filePath).catch(() => undefined);
    } finally {
      this.busy.set(false);
      this.store.uploading.set(false);
    }
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges() || this.busy()) event.preventDefault();
  }
  hasGroup(code: GroupCode): boolean {
    return this.simulation().calculation?.allocations.some((a) => a.groupCode === code) ?? false;
  }
  hasRemainders(): boolean {
    return this.simulation().calculation?.allocations.some((a) => a.remainderCents > 0) ?? false;
  }
  groupName(code: GroupCode): string {
    return this.store.data()?.groups.find((g) => g.code === code)?.name ?? code;
  }
  historicalReceipt(): Receipt | undefined {
    return this.store
      .data()
      ?.periods.filter((p) => p.month < this.store.selectedMonth())
      .sort((a, b) => b.month.localeCompare(a.month))
      .flatMap((p) =>
        p.receipts.filter(
          (r) => r.service === this.form.controls.service.value && r.status === 'confirmed',
        ),
      )[0];
  }
}
