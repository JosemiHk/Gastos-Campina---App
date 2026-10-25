import { computed, DestroyRef, effect, inject, Injectable } from '@angular/core';
import { Supabase } from '../core/supabase';
import { HouseholdStore } from './household-store';

/** Notifications improve freshness; database revisions remain the authority. */
@Injectable({ providedIn: 'root' })
export class HouseholdLive {
  private readonly store = inject(HouseholdStore);
  private readonly backend = inject(Supabase);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscription = computed(() => {
    const id = this.store.data()?.household.id;
    return id && this.store.collaborationEnabled() ? `${id}:${this.store.currentUserId()}` : '';
  });
  constructor() {
    effect((cleanup) => {
      const identity = this.subscription();
      if (!identity) return;
      const [household, user] = identity.split(':');
      const changed = () => this.changed();
      const channel = this.backend.client
        .channel(`household:${household}:${user}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'billing_periods',
            filter: `household_id=eq.${household}`,
          },
          changed,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'receipt_corrections',
            filter: `household_id=eq.${household}`,
          },
          changed,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'household_memberships',
            filter: `user_id=eq.${user}`,
          },
          changed,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') this.changed();
        });
      cleanup(() => {
        clearTimeout(this.timer);
        void this.backend.client.removeChannel(channel);
      });
    });
    const focus = () => {
      if (!this.store.hasUnsavedChanges()) this.changed();
    };
    window.addEventListener('focus', focus);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      window.removeEventListener('focus', focus);
    });
  }
  private changed(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.store.data() || this.store.saving() || this.store.uploading()) return;
      if (this.store.hasUnsavedChanges()) this.store.externalChanges.set(true);
      else void this.store.load();
    }, 250);
  }
}
