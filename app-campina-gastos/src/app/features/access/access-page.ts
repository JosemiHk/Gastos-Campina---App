import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccessStore } from '../../data-access/access-store';
import { HouseholdStore } from '../../data-access/household-store';
import { HouseholdAccess, HouseholdInvitation, Role } from '../../domain/models';
import { errorMessage } from '../../core/errors';
import { Confirm } from '../../shared/ui/confirm-dialog';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-access-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, Icon],
  templateUrl: './access-page.html',
  styleUrl: './access-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class AccessPage {
  private readonly editor = viewChild<ElementRef<HTMLFormElement>>('editor');
  readonly store = inject(HouseholdStore);
  readonly access = inject(AccessStore);
  private readonly confirm = inject(Confirm);
  private readonly snack = inject(MatSnackBar);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly editing = signal<HouseholdAccess | null>(null);
  readonly invitationId = signal<string>(crypto.randomUUID());
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    role: new FormControl<Role>('member', { nonNullable: true }),
    canReview: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  constructor() {
    this.access.clear();
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.controls.role.value === 'viewer' && this.form.controls.canReview.value)
        this.form.controls.canReview.setValue(false, { emitEvent: false });
      this.store.hasUnsavedChanges.set(this.form.dirty);
    });
    inject(DestroyRef).onDestroy(() => {
      this.access.clear();
      this.store.hasUnsavedChanges.set(false);
    });
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (!this.store.isAdmin() || !this.store.collaborationEnabled()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      await this.access.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async select(member: HouseholdAccess | null, invitation?: HouseholdInvitation): Promise<void> {
    if (this.busy()) return;
    if (
      this.form.dirty &&
      !(await this.confirm.ask({
        title: 'Cambiar de cuenta',
        message: 'Los cambios sin guardar se descartarán.',
        action: 'Continuar',
      }))
    )
      return;
    this.editing.set(member);
    this.invitationId.set(invitation?.id ?? crypto.randomUUID());
    this.form.reset({
      name: member?.name || invitation?.name || '',
      email: member?.email || invitation?.email || '',
      role: member?.role ?? invitation?.role ?? 'member',
      canReview: member?.canReview ?? invitation?.canReview ?? false,
      active: member?.active ?? true,
    });
    if (member || invitation) this.form.controls.email.disable();
    else this.form.controls.email.enable();
    this.store.hasUnsavedChanges.set(false);
    this.error.set('');
    this.editor()?.nativeElement.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    this.editor()
      ?.nativeElement.querySelector<HTMLInputElement>('#access-name')
      ?.focus({ preventScroll: true });
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      !this.form.controls.name.value.trim() ||
      this.busy() ||
      !this.store.isAdmin()
    )
      return;
    const values = this.form.getRawValue();
    const member = this.editing();
    if (
      member &&
      !(await this.confirm.ask({
        title: 'Actualizar acceso',
        message: `Guardar los permisos de ${member.email}${values.active ? '' : '. Esta cuenta dejará de acceder al hogar'}.`,
        action: 'Guardar acceso',
      }))
    )
      return;
    this.busy.set(true);
    this.store.saving.set(true);
    this.error.set('');
    try {
      if (member) await this.access.update(member, { ...values, name: values.name.trim() });
      else
        await this.access.invite({
          id: this.invitationId(),
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role,
          canReview: values.canReview,
        });
      this.form.markAsPristine();
      this.store.hasUnsavedChanges.set(false);
      this.snack.open(member ? 'Acceso actualizado.' : 'Invitación enviada.', 'Cerrar', {
        duration: 4500,
      });
      this.editing.set(null);
      this.invitationId.set(crypto.randomUUID());
      this.form.reset({ role: 'member', active: true });
      this.form.controls.email.enable();
    } catch (e) {
      this.error.set(errorMessage(e));
      await this.refresh();
    } finally {
      this.busy.set(false);
      this.store.saving.set(false);
    }
  }
  async cancel(id: string): Promise<void> {
    if (
      this.busy() ||
      !(await this.confirm.ask({
        title: 'Cancelar invitación',
        message:
          'El correo ya enviado no puede retirarse, pero esta invitación no podrá dar acceso al hogar.',
        action: 'Cancelar invitación',
      }))
    )
      return;
    this.busy.set(true);
    try {
      await this.access.cancel(id);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges() || this.busy()) event.preventDefault();
  }
}
