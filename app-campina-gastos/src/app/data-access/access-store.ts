import { inject, Injectable, signal } from '@angular/core';
import { Supabase } from '../core/supabase';
import { HouseholdStore } from './household-store';
import { HouseholdAccess, HouseholdInvitation, Role } from '../domain/models';

@Injectable({ providedIn: 'root' })
export class AccessStore {
  private readonly backend = inject(Supabase);
  private readonly household = inject(HouseholdStore);
  readonly members = signal<HouseholdAccess[]>([]);
  readonly invitations = signal<HouseholdInvitation[]>([]);
  private householdId(): string {
    const id = this.household.data()?.household.id;
    if (!id || !this.household.isAdmin() || !this.household.collaborationEnabled())
      throw new Error('No autorizado.');
    return id;
  }
  clear(): void {
    this.members.set([]);
    this.invitations.set([]);
  }
  async load(): Promise<void> {
    const id = this.householdId();
    const { data, error } = await this.backend.client.rpc('get_household_access', {
      p_household: id,
    });
    if (error) throw error;
    if (this.household.data()?.household.id !== id || !this.household.isAdmin()) {
      this.clear();
      return;
    }
    const access = data as unknown as {
      members: HouseholdAccess[];
      invitations: HouseholdInvitation[];
    };
    if (!access || !Array.isArray(access.members) || !Array.isArray(access.invitations))
      throw new Error('Datos de acceso inválidos.');
    this.members.set(access.members);
    this.invitations.set(access.invitations);
  }
  async update(
    member: HouseholdAccess,
    changes: { name: string; role: Role; canReview: boolean; active: boolean },
  ): Promise<void> {
    const { error } = await this.backend.client.rpc('update_household_access', {
      p_household: this.householdId(),
      p_user: member.userId,
      p_revision: member.revision,
      p_name: changes.name,
      p_role: changes.role,
      p_can_review: changes.canReview,
      p_active: changes.active,
    });
    if (error) throw error;
    await this.household.load();
    if (this.household.isAdmin()) await this.load();
    else this.clear();
  }
  async invite(invitation: Omit<HouseholdInvitation, 'createdAt'>): Promise<void> {
    const { data, error } = await this.backend.client.functions.invoke('invite-household', {
      body: { householdId: this.householdId(), ...invitation },
    });
    if (error) {
      if ('context' in error && error.context instanceof Response) {
        const details = await error.context.json().catch(() => null);
        if (details?.error) throw new Error(String(details.error));
      }
      throw error;
    }
    if (!data?.ok)
      throw new Error('No se pudo completar la invitación. Revisa su estado antes de reenviar.');
    await this.load();
  }
  async cancel(id: string): Promise<void> {
    const { error } = await this.backend.client.rpc('cancel_household_invitation', {
      p_household: this.householdId(),
      p_id: id,
    });
    if (error) throw error;
    await this.load();
  }
}
