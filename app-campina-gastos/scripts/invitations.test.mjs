import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInviteHandler } from '../../supabase/functions/invite-household/handler.ts';

function fixture({
  authenticated = true,
  allowed = true,
  existing = false,
  sendError = false,
  completeError = false,
} = {}) {
  const calls = [];
  const user = {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: 'admin' } : null },
        error: authenticated ? null : {},
      }),
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return name === 'prepare_household_invitation'
        ? {
            data: { email: 'member@example.test', existingUser: existing },
            error: allowed ? null : { message: 'No autorizado.', code: '42501' },
          }
        : { data: null, error: completeError ? { message: 'La invitación ya cambió.' } : null };
    },
  };
  const send = async (kind, options) => {
    calls.push([kind, options]);
    return { data: {}, error: sendError ? { message: 'SMTP password failure' } : null };
  };
  const mail = {
    auth: {
      admin: { inviteUserByEmail: (email, options) => send('invite', { email, ...options }) },
      signInWithOtp: (options) => send('otp', options),
    },
  };
  const handler = createInviteHandler({
    appUrl: 'https://campina.example.test',
    clients: (authorization) => {
      assert.equal(authorization, 'Bearer test-token');
      return { user, mail };
    },
  });
  const request = (body = {}, headers = {}) =>
    new Request('https://functions.example.test/invite-household', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://campina.example.test',
        ...headers,
      },
      body: JSON.stringify({
        householdId: 'household',
        id: 'invitation',
        email: 'Member@example.test',
        name: 'Integrante',
        role: 'member',
        canReview: false,
        ...body,
      }),
    });
  return { handler, calls, request };
}
test('rechaza orígenes ajenos antes de acceder a Auth', async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(f.request({}, { origin: 'https://untrusted.example.test' }))).status,
    403,
  );
  assert.equal(f.calls.length, 0);
});
test('rechaza sesiones ausentes o inválidas antes de enviar correo', async () => {
  for (const auth of [false, true]) {
    const f = fixture({ authenticated: auth });
    const result = await f.handler(f.request({}, auth ? { authorization: '' } : {}));
    assert.equal(result.status, 401);
    assert.equal(f.calls.length, 0);
  }
});
test('consulta no puede usar el servicio administrativo de correo', async () => {
  const f = fixture({ allowed: false });
  assert.equal((await f.handler(f.request())).status, 403);
  assert.deepEqual(
    f.calls.map((c) => c[0]),
    ['prepare_household_invitation'],
  );
});
test('invita con correo normalizado y redirección fija, ignorando redirecciones externas', async () => {
  const f = fixture();
  const response = await f.handler(f.request({ redirectTo: 'https://untrusted.example.test' }));
  assert.equal(response.status, 200);
  assert.deepEqual(
    f.calls.map((c) => c[0]),
    ['prepare_household_invitation', 'invite', 'complete_household_invitation'],
  );
  assert.equal(f.calls[1][1].email, 'member@example.test');
  assert.equal(f.calls[1][1].redirectTo, 'https://campina.example.test/acceso/confirmar');
});
test('una cuenta existente recibe OTP sin modificar su identidad', async () => {
  const f = fixture({ existing: true });
  assert.equal((await f.handler(f.request())).status, 200);
  assert.equal(f.calls[1][0], 'otp');
  assert.equal(f.calls[1][1].options.shouldCreateUser, false);
});
test('un fallo SMTP no activa acceso ni expone mensajes secretos del proveedor', async () => {
  const f = fixture({ sendError: true });
  const response = await f.handler(f.request());
  assert.equal(response.status, 502);
  assert.equal(
    f.calls.some((c) => c[0] === 'complete_household_invitation'),
    false,
  );
  assert.equal((await response.text()).includes('password'), false);
});
test('una cancelación o revocación durante el envío no se informa como éxito', async () => {
  const f = fixture({ completeError: true });
  const response = await f.handler(f.request());
  assert.equal(response.status, 409);
});
test('rechaza permisos no tipados y cuerpos demasiado grandes', async () => {
  for (const data of [{ canReview: 'true' }, { role: 'owner' }, { name: 'x'.repeat(5000) }]) {
    const f = fixture();
    assert.equal((await f.handler(f.request(data))).status, 400);
    assert.equal(f.calls.length, 0);
  }
});
