import { inject, Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RuntimeConfig } from './config';
import { Database } from '../data-access/database.types';
@Injectable({ providedIn: 'root' })
export class Supabase {
  private readonly config = inject(RuntimeConfig);
  private instance: SupabaseClient<Database> | null = null;
  private initialization: Promise<void> | null = null;
  get configured(): boolean {
    return this.config.value() !== null;
  }
  get client(): SupabaseClient<Database> {
    if (!this.instance)
      throw new Error('El acceso al hogar aún no está habilitado. Contacta al administrador.');
    return this.instance;
  }
  initialize(): Promise<void> {
    return (this.initialization ??= this.create());
  }
  private async create(): Promise<void> {
    const config = this.config.value();
    if (!config)
      throw new Error('El acceso al hogar aún no está habilitado. Contacta al administrador.');
    const { createClient } = await import('@supabase/supabase-js');
    this.instance = createClient<Database>(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
}
