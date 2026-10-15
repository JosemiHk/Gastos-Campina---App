import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '../../core/auth';
import { AuthPage } from './auth-page';
describe('pantallas de acceso', () => {
  const auth = {
    pendingEmail: signal('familia@example.test'),
    requestedAt: signal(0),
    maskedEmail: () => 'f***a@example.test',
    send: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn(),
    verifyLink: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'acceso', component: AuthPage, data: { mode: 'login' } },
          { path: 'acceso/verificar', component: AuthPage, data: { mode: 'verify' } },
          { path: 'acceso/recuperar', component: AuthPage, data: { mode: 'recover' } },
          { path: 'acceso/enlace-enviado', component: AuthPage, data: { mode: 'sent' } },
        ]),
        { provide: Auth, useValue: auth },
      ],
    });
  });
  it('valida el correo antes de solicitar un código y abre verificación', async () => {
    const harness = await RouterTestingHarness.create('/acceso');
    const page = await harness.navigateByUrl('/acceso', AuthPage);
    page.email.setValue('correo-invalido');
    await page.submitEmail();
    expect(auth.send).not.toHaveBeenCalled();
    page.email.setValue('familia@example.test');
    await page.submitEmail();
    harness.detectChanges();
    expect(auth.send).toHaveBeenCalledWith('familia@example.test');
    expect(harness.routeNativeElement?.textContent).toContain('Introduce tu código');
  });
  it('admite pegar los seis dígitos y comunica un código vencido', async () => {
    auth.verify.mockRejectedValue(new Error('Token has expired'));
    const harness = await RouterTestingHarness.create('/acceso/verificar');
    const page = await harness.navigateByUrl('/acceso/verificar', AuthPage);
    page.paste(
      {
        preventDefault: vi.fn(),
        clipboardData: { getData: () => '12 34 56' },
      } as unknown as ClipboardEvent,
      0,
    );
    harness.detectChanges();
    expect(page.code()).toBe('123456');
    await page.verify();
    harness.detectChanges();
    expect(auth.verify).toHaveBeenCalledWith('123456');
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain(
      'venció',
    );
  });
  it('recupera el acceso con un enlace sin pedir una contraseña', async () => {
    const harness = await RouterTestingHarness.create('/acceso/recuperar');
    const page = await harness.navigateByUrl('/acceso/recuperar', AuthPage);
    page.email.setValue('familia@example.test');
    await page.submitEmail();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Enlace de acceso en camino');
    expect(harness.routeNativeElement?.querySelector('input[type="password"]')).toBeNull();
  });
});
