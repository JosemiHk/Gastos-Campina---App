import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from './auth';
import { Supabase } from './supabase';
describe('acceso privado sin contraseña', () => {
  const signInWithOtp = vi.fn();
  const verifyOtp = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Supabase,
          useValue: {
            configured: true,
            initialize: async () => undefined,
            client: { auth: { signInWithOtp, verifyOtp } },
          },
        },
      ],
    });
  });
  it('normaliza el correo y deshabilita el alta automática', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const auth = TestBed.inject(Auth);
    await auth.send(' Familia@Example.com ');
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'familia@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );
    expect(auth.maskedEmail()).toBe('f***a@example.com');
    await expect(auth.send('familia@example.com')).rejects.toThrow();
  });
  it('no revela si el correo está autorizado', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } });
    await expect(TestBed.inject(Auth).send('unknown@example.com')).resolves.toBeUndefined();
  });
  it('verifica el código con Supabase y borra el correo pendiente', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
    const auth = TestBed.inject(Auth);
    await auth.send('familia@example.com');
    await auth.verify('123456');
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'familia@example.com',
      token: '123456',
      type: 'email',
    });
    expect(auth.pendingEmail()).toBe('');
    expect(auth.user()?.id).toBe('user');
  });
});
