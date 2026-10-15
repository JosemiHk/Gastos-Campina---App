import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RuntimeConfig } from './config';
@Injectable({ providedIn: 'root' })
export class Supabase {
  private readonly config = inject(RuntimeConfig);
  private instance: SupabaseClient | null = null;
  get configured(): boolean { return this.config.value() !== null; }
  get client(): SupabaseClient {
    if (!this.instance) {
      const config = this.config.value();
      if (!config) throw new Error('El acceso al hogar aún no está habilitado. Contacta al administrador.');
      this.instance = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' } });
    }
    return this.instance;
  }
}
