import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessPage } from './access-page';
import { AccessStore } from '../../data-access/access-store';
import { HouseholdStore } from '../../data-access/household-store';
import { storeFixture } from '../../../testing/household-fixture';
import { signal } from '@angular/core';
import { Confirm } from '../../shared/ui/confirm-dialog';

describe('gestión de accesos', () => {
  let store: ReturnType<typeof storeFixture>;
  const access = {
    members: signal([]),
    invitations: signal([]),
    clear: vi.fn(),
    load: vi.fn(),
    invite: vi.fn(),
    update: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    access.load.mockResolvedValue(undefined);
    access.invite.mockResolvedValue(undefined);
    store = storeFixture();
    store.data.update((data) => ({ ...data, accessEnabled: true }));
    TestBed.configureTestingModule({
      imports: [AccessPage],
      providers: [
        provideRouter([]),
        { provide: HouseholdStore, useValue: store },
        { provide: AccessStore, useValue: access },
        { provide: Confirm, useValue: { ask: vi.fn().mockResolvedValue(true) } },
      ],
    });
  });
  it('invita con correo normalizado y permisos explícitos', async () => {
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.patchValue({
      name: ' José Miguel ',
      email: 'PERSONAL@example.test',
      role: 'member',
      canReview: true,
    });
    await page.save();
    expect(access.invite).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'José Miguel',
        email: 'personal@example.test',
        role: 'member',
        canReview: true,
      }),
    );
  });
  it('oculta la gestión y no consulta correos desde el perfil integrante', async () => {
    store.data.update((data) => ({ ...data, role: 'member' }));
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Solo para administradores');
    expect(access.load).not.toHaveBeenCalled();
    fixture.componentInstance.form.patchValue({ name: 'Otro', email: 'other@example.test' });
    await fixture.componentInstance.save();
    expect(access.invite).not.toHaveBeenCalled();
  });
  it('no permite invitar con datos inválidos y retira el permiso de revisión al elegir consulta', async () => {
    const page = TestBed.createComponent(AccessPage).componentInstance;
    page.form.patchValue({ name: ' ', email: 'incorrecto', role: 'viewer', canReview: true });
    await page.save();
    expect(access.invite).not.toHaveBeenCalled();
    expect(page.form.controls.canReview.value).toBe(false);
  });
});
