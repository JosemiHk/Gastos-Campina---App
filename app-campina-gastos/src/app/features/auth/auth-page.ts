import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/errors';
import { Brand } from '../../shared/ui/brand';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, Brand, Icon],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mode = this.route.snapshot.data['mode'] as
    'login' | 'verify' | 'recover' | 'sent' | 'callback';
  readonly email = new FormControl(this.auth.pendingEmail(), {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(254)],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly digits = signal(['', '', '', '', '', '']);
  readonly code = computed(() => this.digits().join(''));
  readonly now = signal(Date.now());
  readonly countdown = computed(() =>
    Math.max(0, Math.ceil((this.auth.requestedAt() + 60_000 - this.now()) / 1000)),
  );
  readonly year = new Date().getFullYear();
  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    if (['verify', 'sent'].includes(this.mode) && !this.auth.pendingEmail())
      void this.router.navigateByUrl('/acceso');
  }
  async submitEmail(): Promise<void> {
    this.email.markAsTouched();
    if (this.email.invalid || this.busy()) return;
    await this.run(async () => {
      await this.auth.send(this.email.value);
      await this.router.navigateByUrl(
        this.mode === 'recover' ? '/acceso/enlace-enviado' : '/acceso/verificar',
      );
    });
  }
  async resend(): Promise<void> {
    if (this.countdown() || this.busy()) return;
    await this.run(() => this.auth.send(this.auth.pendingEmail()));
  }
  async verify(): Promise<void> {
    if (!/^\d{6}$/.test(this.code()) || this.busy()) return;
    await this.run(async () => {
      await this.auth.verify(this.code());
      await this.router.navigateByUrl('/resumen');
    });
  }
  async callback(): Promise<void> {
    await this.run(async () => {
      const token = this.route.snapshot.queryParamMap.get('token_hash');
      if (!token) throw new Error('El enlace no es válido o venció.');
      const type = this.route.snapshot.queryParamMap.get('type') ?? 'email';
      if (type !== 'email' && type !== 'invite')
        throw new Error('El enlace no es válido o venció.');
      if (type === 'invite') await this.auth.verifyLink(token, 'invite');
      else await this.auth.verifyLink(token);
      history.replaceState({}, '', '/acceso/confirmar');
      await this.router.navigateByUrl('/resumen');
    });
  }
  digitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    const next = [...this.digits()];
    for (let offset = 0; offset < Math.max(1, value.length) && index + offset < 6; offset++)
      next[index + offset] = value[offset] ?? '';
    this.digits.set(next);
    input.value = next[index];
    if (value && index < 5) this.focusDigit(Math.min(5, index + value.length));
  }
  paste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const value =
      event.clipboardData
        ?.getData('text')
        .replace(/\D/g, '')
        .slice(0, 6 - index) ?? '';
    const next = [...this.digits()];
    [...value].forEach((digit, offset) => (next[index + offset] = digit));
    this.digits.set(next);
    this.focusDigit(Math.min(5, index + value.length));
  }
  key(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) this.focusDigit(index - 1);
    if (event.key === 'ArrowLeft' && index > 0) this.focusDigit(index - 1);
    if (event.key === 'ArrowRight' && index < 5) this.focusDigit(index + 1);
  }
  private focusDigit(index: number): void {
    (document.getElementById(`otp-${index}`) as HTMLInputElement | null)?.focus();
  }
  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
