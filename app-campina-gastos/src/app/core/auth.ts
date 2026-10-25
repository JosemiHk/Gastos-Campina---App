import { computed, inject, Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { Supabase } from './supabase';
@Injectable({ providedIn: 'root' })
export class Auth {
  readonly backend = inject(Supabase);
  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);
  readonly pendingEmail = signal(sessionStorage.getItem('campina.auth.email') ?? '');
  readonly requestedAt = signal(Number(sessionStorage.getItem('campina.auth.sentAt') ?? '0'));
  readonly maskedEmail = computed(() => {
    const [name, host] = this.pendingEmail().split('@');
    return host ? `${name.slice(0, 1)}***${name.length > 1 ? name.slice(-1) : ''}@${host}` : '';
  });
  private ready: Promise<void> | null = null;
  ensureReady(): Promise<void> {
    return (this.ready ??= this.initialize());
  }
  private async initialize(): Promise<void> {
    if (this.backend.configured) {
      await this.backend.initialize();
      this.backend.client.auth.onAuthStateChange((_event, session) => {
        this.user.set(session?.user ?? null);
      });
      const { data } = await this.backend.client.auth.getSession();
      this.user.set(data.session?.user ?? null);
    }
    this.initialized.set(true);
  }
  async send(email: string): Promise<void> {
    await this.backend.initialize();
    if (Date.now() - this.requestedAt() < 60_000)
      throw new Error('Espera un minuto antes de reenviar.');
    const normalized = email.trim().toLowerCase();
    const { error } = await this.backend.client.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/acceso/confirmar` },
    });
    // The public flow must not reveal whether an address belongs to this household.
    if (error && !/signups not allowed|user not found/i.test(error.message)) throw error;
    this.pendingEmail.set(normalized);
    this.requestedAt.set(Date.now());
    sessionStorage.setItem('campina.auth.email', normalized);
    sessionStorage.setItem('campina.auth.sentAt', String(this.requestedAt()));
  }
  async verify(token: string): Promise<void> {
    await this.backend.initialize();
    const { data, error } = await this.backend.client.auth.verifyOtp({
      email: this.pendingEmail(),
      token,
      type: 'email',
    });
    if (error) throw error;
    this.user.set(data.user);
    this.clearPending();
  }
  async verifyLink(tokenHash: string, type: 'email' | 'invite' = 'email'): Promise<void> {
    await this.backend.initialize();
    const { data, error } = await this.backend.client.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) throw error;
    this.user.set(data.user);
    this.clearPending();
  }
  async logout(): Promise<void> {
    await this.backend.initialize();
    const { error } = await this.backend.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.user.set(null);
  }
  private clearPending(): void {
    this.pendingEmail.set('');
    sessionStorage.removeItem('campina.auth.email');
  }
}
