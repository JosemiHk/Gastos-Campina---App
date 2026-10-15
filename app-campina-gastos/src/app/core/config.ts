import { Injectable, signal } from '@angular/core';
export interface BrowserConfig { supabaseUrl: string; supabaseKey: string; }
@Injectable({ providedIn: 'root' })
export class RuntimeConfig {
  readonly value = signal<BrowserConfig | null>(null);
  async load(): Promise<void> {
    try {
      const response = await fetch('/config.json', { cache: 'no-store' });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (data && typeof data === 'object' && 'supabaseUrl' in data && 'supabaseKey' in data && typeof data.supabaseUrl === 'string' && typeof data.supabaseKey === 'string' && data.supabaseUrl && data.supabaseKey) {
        const url = new URL(data.supabaseUrl);
        if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) this.value.set({ supabaseUrl: url.origin, supabaseKey: data.supabaseKey });
      }
    } catch { /* A missing configuration leaves private access unavailable. */ }
  }
}
