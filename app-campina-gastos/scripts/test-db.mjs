import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const admin = '00000000-0000-4000-a000-000000000001';
const viewer = '00000000-0000-4000-a000-000000000002';
const outsider = '00000000-0000-4000-a000-000000000003';
let checks = 0;
const check = (name, action) => async () => {
  await action();
  checks++;
  process.stdout.write(`✓ ${name}\n`);
};
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;
    insert into auth.users values('${admin}','admin@example.test'),('${viewer}','viewer@example.test'),('${outsider}','outside@example.test');`);
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  if (process.argv.includes('--setup')) {
    await db.exec(
      readFileSync(new URL('../../supabase/.temp/setup-campina.sql', import.meta.url), 'utf8'),
    );
  } else {
    for (const file of readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  const household = (
    await db.query(`select private.provision_household('admin@example.test') as id`)
  ).rows[0].id;
  const otherHousehold = (
    await db.query(`select private.provision_household('outside@example.test') as id`)
  ).rows[0].id;
  await db.query(`insert into public.household_memberships values($1,$2,'viewer',true)`, [
    household,
    viewer,
  ]);
  async function asUser(user) {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
    await db.exec('set role authenticated');
  }
  const bundle = async () => (await db.query('select public.get_household() as data')).rows[0].data;
  const save = async (
    service,
    amountCents,
    revision,
    month = '2026-10-01',
    status = 'confirmed',
    id = crypto.randomUUID(),
  ) =>
    db.query('select public.save_receipt($1,$2,$3,$4::jsonb)', [
      household,
      month,
      revision,
      JSON.stringify({ id, service, amountCents, status }),
    ]);
  await asUser(admin);
  await check('El hogar inicial no contiene recibos ni cuentas ficticias', async () => {
    const data = await bundle();
    assert.equal(data.periods.length, 0);
    assert.equal(data.accounts.length, 0);
    assert.equal(data.groups.length, 4);
  })();
  await check('El cierre incompleto se rechaza sin crear un periodo', async () => {
    await assert.rejects(
      db.query('select public.close_period($1,$2,0)', [household, '2026-10-01']),
    );
    assert.equal((await bundle()).periods.length, 0);
  })();
  await save('water', 9000, 0);
  await save('electricity', 18000, 1);
  await save('internet', 12000, 2);
  await check(
    'El cálculo PostgreSQL cuadra al céntimo y conserva las reglas familiares',
    async () => {
      const p = (await bundle()).periods[0];
      assert.equal(p.calculation.totalCents, 39000);
      const totals = { twins: 0, miguel: 0, jm: 0, rossana: 0 };
      for (const a of p.calculation.allocations) totals[a.groupCode] += a.amountCents;
      assert.deepEqual(totals, { twins: 8334, miguel: 14333, jm: 14333, rossana: 2000 });
      assert.equal(
        p.calculation.allocations.some((a) => a.service === 'internet' && a.groupCode === 'twins'),
        false,
      );
    },
  )();
  await check('Una revisión desactualizada no sobrescribe los datos', async () => {
    await assert.rejects(save('water', 10000, 0));
    assert.equal((await bundle()).periods[0].revision, 3);
  })();
  await check('Un servicio duplicado no deja cálculos ni recibos parciales', async () => {
    await assert.rejects(save('water', 10000, 3));
    const p = (await bundle()).periods[0];
    assert.equal(p.revision, 3);
    assert.equal(p.receipts.length, 3);
    assert.equal(p.calculation.totalCents, 39000);
  })();
  await check('Luz menor al aporte fijo revierte toda la operación', async () => {
    await assert.rejects(save('electricity', 1999, 0, '2026-11-01'));
    assert.equal(
      (await bundle()).periods.some((p) => p.month === '2026-11-01'),
      false,
    );
  })();
  await check('Los borradores no participan en el gasto mensual', async () => {
    await save('water', 12345, 0, '2026-09-01', 'draft');
    const p = (await bundle()).periods.find((p) => p.month === '2026-09-01');
    assert.equal(p.calculation.totalCents, 0);
    assert.equal(p.calculation.receiptCount, 0);
  })();
  await asUser(viewer);
  await check('El rol consulta puede leer pero no registrar ni modificar cálculos', async () => {
    assert.equal((await bundle()).role, 'viewer');
    await assert.rejects(save('water', 9000, 0, '2026-12-01'));
    await assert.rejects(db.query('update public.allocations set amount_cents=1'));
  })();
  await asUser(outsider);
  await check('RLS aísla hogares y las RPC rechazan escrituras cruzadas', async () => {
    assert.equal((await bundle()).household.id, otherHousehold);
    assert.equal(
      (await db.query('select * from public.receipts where household_id=$1', [household])).rows
        .length,
      0,
    );
    await assert.rejects(save('water', 9000, 0, '2026-12-01'));
  })();
  await asUser(admin);
  await check('No se permite ejecutar funciones internas desde el navegador', async () => {
    await assert.rejects(db.query(`select private.provision_household('viewer@example.test')`));
    await assert.rejects(db.query('select private.recalculate(id) from public.billing_periods'));
  })();
  await db.query('select public.confirm_payment($1,$2,3,$3,$4)', [
    household,
    '2026-10-01',
    'miguel',
    'Yape',
  ]);
  await check('No se confirma dos veces un aporte completo', async () => {
    await assert.rejects(
      db.query('select public.confirm_payment($1,$2,4,$3,$4)', [
        household,
        '2026-10-01',
        'miguel',
        'Yape',
      ]),
    );
  })();
  await check('Cambiar reglas conserva aportes y crea un cálculo trazable', async () => {
    const before = (await bundle()).periods[0].calculation.id;
    await db.query('select public.save_settings($1,$2,4,2300,$3::jsonb)', [
      household,
      '2026-10-01',
      '[]',
    ]);
    const p = (await bundle()).periods[0];
    assert.notEqual(p.calculation.id, before);
    assert.equal(p.payments[0].amountCents, 14333);
    assert.equal(p.calculation.fixedContributionCents, 2300);
  })();
  await db.query('select public.close_period($1,$2,5)', [household, '2026-10-01']);
  const closedCalculation = JSON.stringify((await bundle()).periods[0].calculation);
  await check('El cierre protege recibos y configuración', async () => {
    const p = (await bundle()).periods[0];
    await assert.rejects(
      save(
        'water',
        10000,
        6,
        '2026-10-01',
        'confirmed',
        p.receipts.find((r) => r.service === 'water').id,
      ),
    );
    await assert.rejects(
      db.query('select public.save_settings($1,$2,6,2000,$3::jsonb)', [
        household,
        '2026-10-01',
        '[]',
      ]),
    );
    assert.equal(JSON.stringify((await bundle()).periods[0].calculation), closedCalculation);
  })();
  await check('Se puede cobrar después del cierre sin alterar el cálculo congelado', async () => {
    await db.query('select public.confirm_payment($1,$2,6,$3,$4)', [
      household,
      '2026-10-01',
      'jm',
      'Transferencia',
    ]);
    assert.equal(JSON.stringify((await bundle()).periods[0].calculation), closedCalculation);
  })();
  await check('La anulación de pago requiere motivo y conserva la evidencia', async () => {
    const payment = (await bundle()).periods[0].payments[0];
    await assert.rejects(
      db.query('select public.void_payment($1,$2,7,$3,$4)', [
        household,
        '2026-10-01',
        payment.id,
        '',
      ]),
    );
    await db.query('select public.void_payment($1,$2,7,$3,$4)', [
      household,
      '2026-10-01',
      payment.id,
      'Confirmación duplicada',
    ]);
    assert.ok((await bundle()).periods[0].payments.find((p) => p.id === payment.id).voidedAt);
  })();
  await check('Storage impide subir a otro hogar o a un mes cerrado', async () => {
    await assert.rejects(
      db.query(`insert into storage.objects(bucket_id,name) values('receipts',$1)`, [
        `${otherHousehold}/2026-11/${crypto.randomUUID()}.jpg`,
      ]),
    );
    await assert.rejects(
      db.query(`insert into storage.objects(bucket_id,name) values('receipts',$1)`, [
        `${household}/2026-10/${crypto.randomUUID()}.jpg`,
      ]),
    );
  })();
  await check(
    'Un archivo autorizado puede adjuntarse y queda protegido contra borrado',
    async () => {
      const path = `${household}/2026-12/${crypto.randomUUID()}.jpg`;
      await db.query(
        `insert into storage.objects(bucket_id,name,metadata) values('receipts',$1,$2::jsonb)`,
        [path, JSON.stringify({ size: 1024, mimetype: 'image/jpeg' })],
      );
      const receipt = {
        id: crypto.randomUUID(),
        service: 'water',
        amountCents: 10000,
        status: 'confirmed',
        filePath: path,
        fileName: 'recibo.jpg',
        fileSize: 1024,
        fileType: 'image/jpeg',
      };
      await db.query('select public.save_receipt($1,$2,0,$3::jsonb)', [
        household,
        '2026-12-01',
        JSON.stringify(receipt),
      ]);
      const deleted = await db.query(`delete from storage.objects where name=$1 returning id`, [
        path,
      ]);
      assert.equal(deleted.rows.length, 0);
    },
  )();
  await db.exec('reset role; set role anon');
  await check('El acceso anónimo no puede leer ni invocar operaciones privadas', async () => {
    await assert.rejects(db.query('select public.get_household()'));
    await assert.rejects(db.query('select * from public.receipts'));
  })();
  process.stdout.write(`\n${checks} comprobaciones PostgreSQL correctas.\n`);
} finally {
  await db.close();
}
