import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let checks = 0;
const ids = Object.fromEntries(
  ['admin', 'member', 'reviewer', 'viewer', 'outside', 'second', 'invited'].map((name, i) => [
    name,
    `10000000-0000-4000-a000-${String(i + 1).padStart(12, '0')}`,
  ]),
);
async function check(name, action) {
  await action();
  checks++;
  process.stdout.write(`✓ ${name}\n`);
}
async function as(name) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[name]]);
  await db.exec('set role authenticated');
}
const bundle = async () => (await db.query('select public.get_household() as data')).rows[0].data;
const call = async (name, args) =>
  db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args);
const month = '2028-01-01';
let h;
async function period() {
  return (await bundle()).periods.find((p) => p.month === month);
}
async function save(receipt, reason = 'Corrección administrativa') {
  return call('save_receipt', [
    h,
    month,
    (await period())?.revision ?? 0,
    JSON.stringify(receipt),
    reason,
  ]);
}
async function request(receipt, reason = 'Corregir el importe') {
  return call('request_receipt_correction', [
    h,
    month,
    (await period()).revision,
    JSON.stringify(receipt),
    (await period()).receipts.find((r) => r.id === receipt.id).revision,
    reason,
  ]);
}
async function resolve(id, approve = true, reason = '') {
  return call('resolve_receipt_correction', [
    h,
    month,
    (await period()).revision,
    id,
    approve,
    reason,
  ]);
}
const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
try {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$begin end$$;`,
  );
  for (const [name, id] of Object.entries(ids))
    await db.query('insert into auth.users values($1,$2)', [id, `${name}@example.test`]);
  const files = readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const latest = files.find((f) => f.endsWith('_member_access_receipt_reviews.sql'));
  for (const file of files.filter((f) => f !== latest))
    await db.exec(readFileSync(new URL(file, migrationDir), 'utf8'));
  h = (await db.query("select private.provision_household('admin@example.test') as id")).rows[0].id;
  await db.query("select private.provision_household('outside@example.test')");
  await as('admin');
  const water = {
    id: crypto.randomUUID(),
    service: 'water',
    amountCents: 9001,
    status: 'confirmed',
    filePath: null,
    fileName: null,
    fileType: null,
    fileSize: null,
    dueDate: null,
    issueDate: null,
  };
  await call('save_receipt', [h, month, 0, JSON.stringify(water)]);
  const legacy = await period();
  await db.exec('reset role');
  await db.exec(readFileSync(new URL(latest, migrationDir), 'utf8'));
  await as('admin');
  await check('La actualización conserva recibos, cálculos y revisión del mes', async () => {
    const after = await period();
    assert.deepEqual(after.calculation, legacy.calculation);
    assert.equal(after.revision, legacy.revision);
    assert.deepEqual(after.receipts[0], {
      ...legacy.receipts[0],
      revision: 0,
      createdBy: ids.admin,
    });
  });
  await db.exec('reset role');
  for (const [name, role, review] of [
    ['member', 'member', false],
    ['reviewer', 'member', true],
    ['viewer', 'viewer', false],
  ])
    await db.query(
      'insert into public.household_memberships(household_id,user_id,role,can_review,display_name) values($1,$2,$3,$4,$5)',
      [h, ids[name], role, review, name],
    );
  await as('member');
  const electricity = {
    ...water,
    id: crypto.randomUUID(),
    service: 'electricity',
    amountCents: 18000,
  };
  await check(
    'Un integrante registra el recibo faltante y conserva el cálculo exacto',
    async () => {
      await save(electricity);
      assert.equal((await period()).calculation.totalCents, 27001);
    },
  );
  await check(
    'El integrante no puede editar directamente ni cambiar configuración o pagos',
    async () => {
      await assert.rejects(save({ ...water, amountCents: 9999 }));
      await assert.rejects(
        call('save_settings', [h, month, (await period()).revision, 1000, '[]']),
      );
      await assert.rejects(
        call('confirm_payment', [h, month, (await period()).revision, 'twins', 'Yape']),
      );
      await assert.rejects(call('close_period', [h, month, (await period()).revision]));
    },
  );
  await check('Dos intentos de alta del mismo servicio dejan un único recibo', async () => {
    const rev = (await period()).revision;
    const results = await Promise.allSettled([
      call('save_receipt', [
        h,
        month,
        rev,
        JSON.stringify({ ...water, id: crypto.randomUUID(), service: 'internet' }),
      ]),
      call('save_receipt', [
        h,
        month,
        rev,
        JSON.stringify({ ...water, id: crypto.randomUUID(), service: 'internet' }),
      ]),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await period()).receipts.length, 3);
  });
  await check('Una solicitud no altera importes ni el cálculo vigente', async () => {
    const before = await period();
    await request({ ...water, amountCents: 10001 });
    assert.deepEqual(await period(), { ...before, activity: (await period()).activity });
  });
  let correction = (await bundle()).corrections.find((c) => c.status === 'pending');
  await check('Solo hay una solicitud pendiente por recibo', async () => {
    await assert.rejects(request({ ...water, amountCents: 11001 }));
    assert.equal((await bundle()).corrections.filter((c) => c.status === 'pending').length, 1);
  });
  await check('El solicitante no puede resolver su solicitud ni alterar la tabla', async () => {
    await assert.rejects(resolve(correction.id));
    await assert.rejects(db.query("update public.receipt_corrections set status='approved'"));
  });
  await as('reviewer');
  await check('El revisor aprueba una vez y recalcula el mismo recibo', async () => {
    const results = await Promise.allSettled([resolve(correction.id), resolve(correction.id)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await period()).receipts.find((r) => r.id === water.id).amountCents, 10001);
    assert.equal((await period()).receipts.length, 3);
    assert.equal((await period()).calculation.totalCents, 37002);
  });
  await check('El revisor también necesita otro aprobador para sus solicitudes', async () => {
    await request({ ...water, amountCents: 12001 });
    const own = (await bundle()).corrections.find((c) => c.status === 'pending');
    await assert.rejects(resolve(own.id));
  });
  await as('admin');
  correction = (await bundle()).corrections.find((c) => c.status === 'pending');
  await check('Rechazar exige motivo y no cambia el recibo', async () => {
    await assert.rejects(resolve(correction.id, false, ''));
    const before = (await period()).receipts;
    await resolve(correction.id, false, 'El importe del recibo original es correcto');
    assert.deepEqual((await period()).receipts, before);
  });
  await as('member');
  await request({ ...water, amountCents: 15001 });
  await as('admin');
  await check(
    'La edición administrativa queda auditada e invalida propuestas antiguas',
    async () => {
      await assert.rejects(save({ ...water, amountCents: 13001 }, ''));
      await save({ ...water, amountCents: 13001 });
      const data = await bundle();
      assert.equal(
        data.corrections.some((c) => c.status === 'pending'),
        false,
      );
      assert.equal(
        data.corrections.some((c) => c.status === 'stale'),
        true,
      );
      assert.equal(
        data.corrections.some((c) => c.resolutionReason === 'Corrección directa del administrador'),
        true,
      );
    },
  );
  await check('Una versión vieja del recibo no puede originar una nueva propuesta', async () => {
    await assert.rejects(
      call('request_receipt_correction', [
        h,
        month,
        (await period()).revision,
        JSON.stringify(water),
        0,
        'Importe anterior',
      ]),
    );
  });
  await as('member');
  await check('Se valida el adjunto antes de admitir una solicitud', async () => {
    await assert.rejects(
      request({
        ...water,
        filePath: `${h}/2028-01/${crypto.randomUUID()}.pdf`,
        fileType: 'application/pdf',
        fileName: 'recibo.pdf',
        fileSize: 12,
      }),
    );
  });
  await db.exec('reset role');
  const path = `${h}/2028-01/${crypto.randomUUID()}.pdf`;
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'receipts\',$1,\'{"size":12,"mimetype":"application/pdf"}\')',
    [path],
  );
  await as('member');
  await request({
    ...water,
    filePath: path,
    fileType: 'application/pdf',
    fileName: 'recibo.pdf',
    fileSize: 12,
  });
  await check(
    'Los adjuntos propuestos se conservan aunque se intente limpiar archivos',
    async () => {
      await db.query('delete from storage.objects where name=$1', [path]);
      assert.equal(
        (await db.query('select count(*)::int as n from storage.objects where name=$1', [path]))
          .rows[0].n,
        1,
      );
    },
  );
  await as('viewer');
  await check('Consulta no registra, solicita, resuelve ni gestiona accesos', async () => {
    await assert.rejects(save({ ...water, id: crypto.randomUUID() }));
    await assert.rejects(request(water));
    await assert.rejects(resolve(correction.id));
    await assert.rejects(call('get_household_access', [h]));
    assert.equal((await bundle()).canReview, false);
  });
  await as('outside');
  await check('Otro hogar no lee ni modifica correcciones o accesos', async () => {
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.receipt_corrections where household_id=$1',
          [h],
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(call('get_household_access', [h]));
    await assert.rejects(
      call('request_receipt_correction', [h, month, 0, JSON.stringify(water), 0, 'Otro hogar']),
    );
  });
  await as('admin');
  await check('El último administrador no puede desactivarse ni degradarse', async () => {
    for (const [role, active] of [
      ['member', true],
      ['admin', false],
    ])
      await assert.rejects(
        call('update_household_access', [h, ids.admin, 0, 'Administrador', role, false, active]),
      );
  });
  await check(
    'Los permisos se actualizan con revisión y se rechazan cambios antiguos',
    async () => {
      await call('update_household_access', [h, ids.member, 0, 'Integrante', 'member', true, true]);
      await assert.rejects(
        call('update_household_access', [h, ids.member, 0, 'Integrante', 'viewer', false, true]),
      );
    },
  );
  await as('member');
  assert.equal((await bundle()).canReview, true);
  await check('Un revisor no puede concederse permisos de administrador', async () => {
    await assert.rejects(
      call('update_household_access', [h, ids.member, 1, 'Intruso', 'admin', false, true]),
    );
    await assert.rejects(
      call('prepare_household_invitation', [
        h,
        crypto.randomUUID(),
        'second@example.test',
        'Otro',
        'admin',
        false,
      ]),
    );
  });
  await as('admin');
  const invitationId = crypto.randomUUID();
  await check('La invitación admite reintentos controlados y se puede cancelar', async () => {
    await call('prepare_household_invitation', [
      h,
      invitationId,
      'second@example.test',
      'Segundo',
      'member',
      true,
    ]);
    await assert.rejects(
      call('prepare_household_invitation', [
        h,
        invitationId,
        'second@example.test',
        'Segundo',
        'member',
        true,
      ]),
    );
    await call('cancel_household_invitation', [h, invitationId]);
    await assert.rejects(call('complete_household_invitation', [h, invitationId]));
  });
  await check('Una invitación completada no duplica ni sobrescribe permisos', async () => {
    const id = crypto.randomUUID();
    await call('prepare_household_invitation', [
      h,
      id,
      'invited@example.test',
      'Invitado',
      'member',
      true,
    ]);
    await call('complete_household_invitation', [h, id]);
    await assert.rejects(call('complete_household_invitation', [h, id]));
    assert.equal(
      (await call('get_household_access', [h])).rows[0].get_household_access.members.find(
        (m) => m.userId === ids.invited,
      ).canReview,
      true,
    );
  });
  await check('No se traslada una cuenta de otro hogar mediante una invitación', async () => {
    const id = crypto.randomUUID();
    await call('prepare_household_invitation', [
      h,
      id,
      'outside@example.test',
      'Otro',
      'member',
      false,
    ]);
    await assert.rejects(call('complete_household_invitation', [h, id]));
  });
  await call('update_household_access', [h, ids.member, 1, 'Integrante', 'member', false, false]);
  await as('member');
  await check('La desactivación se aplica incluso si la sesión sigue abierta', async () => {
    assert.equal(await bundle(), null);
    await assert.rejects(save(water));
    assert.equal(
      (await db.query('select count(*)::int as n from public.receipt_corrections')).rows[0].n,
      0,
    );
  });
  await as('admin');
  await check('Cerrar el mes invalida solicitudes pendientes y protege su historial', async () => {
    await call('close_period', [h, month, (await period()).revision]);
    assert.equal(
      (await bundle()).corrections.some((c) => c.status === 'pending'),
      false,
    );
    await assert.rejects(request(water));
  });
  await check('Las funciones internas y nuevas operaciones no se exponen a anónimos', async () => {
    const permissions = (
      await db.query(
        "select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('apply_receipt','validate_receipt','lock_receipt_period','receipt_snapshot') and has_function_privilege('authenticated',p.oid,'execute')",
      )
    ).rows;
    assert.deepEqual(permissions, []);
    await db.exec('reset role;set role anon');
    await assert.rejects(call('get_household', []));
    await assert.rejects(call('get_household_access', [h]));
  });
  process.stdout.write(`\n${checks} comprobaciones de colaboración correctas.\n`);
} finally {
  await db.close();
}
