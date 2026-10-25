-- Review branch only. Additive upgrade; do not reset an existing household.
alter table public.household_memberships drop constraint household_memberships_role_check;
alter table public.household_memberships add constraint household_memberships_role_check check(role in ('admin','member','viewer'));
alter table public.household_memberships add column can_review boolean not null default false;
alter table public.household_memberships add column display_name text not null default '' check(length(display_name)<=80);
alter table public.household_memberships add column revision integer not null default 0;
alter table public.household_memberships add constraint membership_review_role check(not can_review or role in ('admin','member'));
alter table public.receipts add column revision integer not null default 0;

create function private.can_register(p_household uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.household_memberships where household_id=p_household and user_id=auth.uid() and active and role in ('admin','member'));
$$;
create function private.can_review(p_household uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.household_memberships where household_id=p_household and user_id=auth.uid() and active and (role='admin' or (role='member' and can_review)));
$$;
revoke all on function private.can_register(uuid),private.can_review(uuid) from public,anon;
grant execute on function private.can_register(uuid),private.can_review(uuid) to authenticated;

create table public.receipt_corrections (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
  period_id uuid not null, receipt_id uuid not null, base_revision integer not null,
  before_data jsonb not null, proposed_data jsonb not null,
  reason text not null check(length(trim(reason)) between 3 and 300),
  kind text not null default 'request' check(kind in ('request','direct')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','stale')),
  requested_by uuid not null references auth.users(id), requested_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id), resolved_at timestamptz, resolution_reason text,
  foreign key(household_id,period_id) references public.billing_periods(household_id,id),
  foreign key(household_id,receipt_id) references public.receipts(household_id,id),
  check ((status='pending')=(resolved_at is null)),
  constraint correction_separate_reviewer check (status<>'approved' or (resolved_by is not null and ((kind='request' and resolved_by<>requested_by) or (kind='direct' and resolved_by=requested_by)))),
  check(kind<>'direct' or status='approved'),
  check (status<>'rejected' or coalesce(length(trim(resolution_reason)),0) between 3 and 300)
);
create unique index correction_pending_receipt_idx on public.receipt_corrections(receipt_id) where status='pending';
create index correction_household_period_idx on public.receipt_corrections(household_id,period_id,requested_at desc);
alter table public.receipt_corrections enable row level security;
revoke all on public.receipt_corrections from public,anon,authenticated;
grant select on public.receipt_corrections to authenticated;
create policy correction_read on public.receipt_corrections for select to authenticated using(private.is_member(household_id));

create table public.household_invitations (
  id uuid primary key, household_id uuid not null references public.households(id),
  email text not null check(email=lower(trim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  display_name text not null check(length(trim(display_name)) between 1 and 80),
  role text not null check(role in ('admin','member','viewer')), can_review boolean not null default false,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  completed_at timestamptz, cancelled_at timestamptz, last_attempt_at timestamptz not null default now(),
  check(not can_review or role in ('admin','member'))
);
create unique index invitation_pending_email_idx on public.household_invitations(household_id,email) where completed_at is null and cancelled_at is null;
create index invitation_creator_idx on public.household_invitations(created_by,created_at desc);
alter table public.household_invitations enable row level security;
revoke all on public.household_invitations from public,anon,authenticated;
grant select on public.household_invitations to authenticated;
create policy invitation_admin_read on public.household_invitations for select to authenticated using(private.is_member(household_id,true));

-- Lock order: membership (shared), period, receipt/correction. Access changes lock
-- the household then memberships; they never take a period lock.
create function private.lock_receipt_period(p_household uuid,p_month date,p_revision integer) returns public.billing_periods
language plpgsql security definer set search_path='' as $$
declare p public.billing_periods;
begin
  perform 1 from public.household_memberships where household_id=p_household and user_id=auth.uid() and active and role in ('admin','member') for share;
  if not found then raise exception 'No autorizado.' using errcode='42501'; end if;
  if p_revision is null or p_revision<0 or p_month is null or extract(day from p_month)<>1 then raise exception 'Periodo inválido.'; end if;
  insert into public.billing_periods(household_id,month,rule_version_id) select id,p_month,default_rule_id from public.households where id=p_household on conflict(household_id,month) do nothing;
  select * into strict p from public.billing_periods where household_id=p_household and month=p_month for update;
  if p.revision<>p_revision then raise exception 'Conflicto de revisión: el mes fue actualizado.' using errcode='40001'; end if;
  if p.status='closed' then raise exception 'El periodo está cerrado.'; end if;
  return p;
end $$;
revoke all on function private.lock_receipt_period(uuid,date,integer) from public,anon,authenticated;

create function private.receipt_snapshot(p_receipt uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',r.id,'service',s.code,'amountCents',r.amount_cents,'status',r.status,'dueDate',r.due_date,'issueDate',r.issue_date,'filePath',r.file_path,'fileName',r.file_name,'fileSize',r.file_size,'fileType',r.file_type,'revision',r.revision)
  from public.receipts r join public.services s on s.id=r.service_id where r.id=p_receipt;
$$;
revoke all on function private.receipt_snapshot(uuid) from public,anon,authenticated;

-- Central validation reused by direct writes and correction requests.
create function private.validate_receipt(p_household uuid,p_month date,p_receipt jsonb) returns void language plpgsql set search_path='' as $$
declare path text; meta jsonb; file_owner text; amount integer;
begin
  if jsonb_typeof(p_receipt) is distinct from 'object' or (p_receipt->>'id')::uuid is null
     or p_receipt->>'status' is null or p_receipt->>'status' not in ('draft','confirmed') then raise exception 'Datos del recibo inválidos.'; end if;
  amount:=(p_receipt->>'amountCents')::integer;
  if amount is null or amount not between 1 and 99999999 then raise exception 'Importe del recibo inválido.'; end if;
  if not exists(select 1 from public.services where household_id=p_household and code=p_receipt->>'service') then raise exception 'Servicio del recibo inválido.'; end if;
  perform nullif(p_receipt->>'dueDate','')::date, nullif(p_receipt->>'issueDate','')::date;
  path:=nullif(p_receipt->>'filePath','');
  if path is not null then
    if split_part(path,'/',1)<>p_household::text or split_part(path,'/',2)<>to_char(p_month,'YYYY-MM') or path like '%..%' or length(path)>250 then raise exception 'Archivo del recibo inválido.'; end if;
    select metadata,owner_id into meta,file_owner from storage.objects where bucket_id='receipts' and name=path;
    if not found then raise exception 'El archivo no se terminó de cargar.'; end if;
    if not private.is_member(p_household,true) and file_owner is distinct from auth.uid()::text and not private.file_in_use(path) then raise exception 'No autorizado para usar este archivo.' using errcode='42501'; end if;
    if (meta->>'size')::bigint is distinct from (p_receipt->>'fileSize')::bigint or meta->>'mimetype' is distinct from p_receipt->>'fileType'
      or p_receipt->>'fileType' not in ('image/jpeg','image/png','application/pdf')
      or (p_receipt->>'fileSize')::integer not between 1 and 10485760
      or coalesce(length(p_receipt->>'fileName'),0) not between 1 and 255 then raise exception 'Los datos del archivo no coinciden.'; end if;
  end if;
end $$;
revoke all on function private.validate_receipt(uuid,date,jsonb) from public,anon,authenticated;

create function private.receipt_version() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
revoke all on function private.receipt_version() from public,anon,authenticated;
create trigger receipt_version before update on public.receipts for each row execute function private.receipt_version();

create function private.expire_corrections() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='receipts' then
    update public.receipt_corrections set status='stale',resolved_at=now(),resolution_reason='El recibo fue actualizado.' where receipt_id=new.id and status='pending';
  elsif new.status='closed' then
    update public.receipt_corrections set status='stale',resolved_at=now(),resolution_reason='El mes fue cerrado.' where period_id=new.id and status='pending';
  end if;
  return new;
end $$;
revoke all on function private.expire_corrections() from public,anon,authenticated;
create trigger receipt_corrections_expire after update on public.receipts for each row execute function private.expire_corrections();
create trigger period_corrections_expire after update of status on public.billing_periods for each row execute function private.expire_corrections();

create function private.apply_receipt(p_household uuid,p_month date,p_revision integer,p_receipt jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; receipt_id uuid; svc uuid; old_receipt public.receipts; path text; file_metadata jsonb;
begin
  p:=private.lock_receipt_period(p_household,p_month,p_revision);
  receipt_id:=(p_receipt->>'id')::uuid;
  if receipt_id is null then raise exception 'Datos del recibo incompletos.'; end if;
  select * into old_receipt from public.receipts where id=receipt_id;
  if old_receipt.id is not null and (old_receipt.household_id<>p_household or old_receipt.period_id<>p.id) then raise exception 'No autorizado.' using errcode='42501'; end if;
  if old_receipt.status='confirmed' and p_receipt->>'status'='draft' then raise exception 'Un recibo confirmado no puede volver a borrador.'; end if;
  select id into svc from public.services where household_id=p_household and code=p_receipt->>'service';
  if svc is null then raise exception 'Servicio del recibo inválido.'; end if;
  path:=nullif(p_receipt->>'filePath','');
  if path is not null then
    if split_part(path,'/',1)<>p_household::text or split_part(path,'/',2)<>to_char(p_month,'YYYY-MM') or path like '%..%' or length(path)>250 then raise exception 'Archivo del recibo inválido.'; end if;
    select metadata into file_metadata from storage.objects where bucket_id='receipts' and name=path;
    if not found then raise exception 'El archivo no se terminó de cargar. Inténtalo otra vez.'; end if;
    if (file_metadata->>'size')::bigint is distinct from (p_receipt->>'fileSize')::bigint or file_metadata->>'mimetype' is distinct from p_receipt->>'fileType' then raise exception 'Los datos del archivo no coinciden.'; end if;
    if length(p_receipt->>'fileName') not between 1 and 255 then raise exception 'Nombre del archivo inválido.'; end if;
  end if;
  insert into public.receipts(id,household_id,period_id,service_id,amount_cents,status,due_date,issue_date,file_path,file_name,file_size,file_type,created_by)
  values(receipt_id,p_household,p.id,svc,(p_receipt->>'amountCents')::integer,p_receipt->>'status',nullif(p_receipt->>'dueDate','')::date,nullif(p_receipt->>'issueDate','')::date,path,case when path is not null then p_receipt->>'fileName' end,case when path is not null then (p_receipt->>'fileSize')::integer end,case when path is not null then p_receipt->>'fileType' end,auth.uid())
  on conflict(id) do update set service_id=excluded.service_id,amount_cents=excluded.amount_cents,status=excluded.status,due_date=excluded.due_date,issue_date=excluded.issue_date,file_path=excluded.file_path,file_name=excluded.file_name,file_size=excluded.file_size,file_type=excluded.file_type,updated_at=now();
  perform private.recalculate(p.id);
  update public.billing_periods set revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,case when p_receipt->>'status'='draft' then 'Borrador guardado: ' else 'Recibo guardado: ' end||(select name from public.services where id=svc),auth.uid());
end $$;


revoke all on function private.apply_receipt(uuid,date,integer,jsonb) from public,anon,authenticated;

drop function public.save_receipt(uuid,date,integer,jsonb);
create function public.save_receipt(p_household uuid,p_month date,p_revision integer,p_receipt jsonb,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.billing_periods; old_receipt public.receipts;
begin
  p:=private.lock_receipt_period(p_household,p_month,p_revision);
  perform private.validate_receipt(p_household,p_month,p_receipt);
  select * into old_receipt from public.receipts where id=(p_receipt->>'id')::uuid;
  if old_receipt.id is not null then
    if not private.is_member(p_household,true) then raise exception 'Solicita una corrección para cambiar este recibo.' using errcode='42501'; end if;
    if coalesce(length(trim(p_reason)),0) not between 3 and 300 then raise exception 'Indica el motivo de la corrección del recibo.'; end if;
    if old_receipt.service_id<>(select id from public.services where household_id=p_household and code=p_receipt->>'service') then raise exception 'No se puede cambiar el servicio del recibo.'; end if;
    insert into public.receipt_corrections(household_id,period_id,receipt_id,base_revision,before_data,proposed_data,reason,status,requested_by,resolved_by,resolved_at,resolution_reason,kind)
      values(p_household,p.id,old_receipt.id,old_receipt.revision,private.receipt_snapshot(old_receipt.id),p_receipt,trim(p_reason),'approved',auth.uid(),auth.uid(),now(),'Corrección directa del administrador','direct');
  end if;
  perform private.apply_receipt(p_household,p_month,p_revision,p_receipt);
end $$;

create function public.request_receipt_correction(p_household uuid,p_month date,p_revision integer,p_receipt jsonb,p_base_revision integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.billing_periods; r public.receipts;
begin
  p:=private.lock_receipt_period(p_household,p_month,p_revision);
  perform private.validate_receipt(p_household,p_month,p_receipt);
  select * into r from public.receipts where id=(p_receipt->>'id')::uuid and household_id=p_household and period_id=p.id for update;
  if not found then raise exception 'No encontramos el recibo.'; end if;
  if p_base_revision is distinct from r.revision then raise exception 'Conflicto de revisión del recibo.' using errcode='40001'; end if;
  if r.service_id<>(select id from public.services where household_id=p_household and code=p_receipt->>'service') then raise exception 'No se puede cambiar el servicio del recibo.'; end if;
  if r.status='confirmed' and p_receipt->>'status'='draft' then raise exception 'Un recibo confirmado no puede volver a borrador.'; end if;
  if coalesce(length(trim(p_reason)),0) not between 3 and 300 then raise exception 'Indica el motivo de la corrección del recibo.'; end if;
  if p_receipt->>'status'='confirmed' and p_receipt->>'service'='electricity' and (p_receipt->>'amountCents')::integer < (select fixed_contribution_cents from public.rule_versions where id=p.rule_version_id) then raise exception 'El recibo de luz debe cubrir el aporte fijo.'; end if;
  insert into public.receipt_corrections(household_id,period_id,receipt_id,base_revision,before_data,proposed_data,reason,requested_by)
    values(p_household,p.id,r.id,r.revision,private.receipt_snapshot(r.id),p_receipt,trim(p_reason),auth.uid());
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,'Corrección de recibo pendiente de revisión',auth.uid());
end $$;

create function public.resolve_receipt_correction(p_household uuid,p_month date,p_revision integer,p_correction uuid,p_approve boolean,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.billing_periods; c public.receipt_corrections; r public.receipts;
begin
  p:=private.lock_receipt_period(p_household,p_month,p_revision);
  if not private.can_review(p_household) then raise exception 'No autorizado.' using errcode='42501'; end if;
  select * into c from public.receipt_corrections where id=p_correction and household_id=p_household and period_id=p.id for update;
  if not found or c.status<>'pending' then raise exception 'La solicitud ya fue resuelta o está desactualizada.'; end if;
  if c.requested_by=auth.uid() then raise exception 'No puedes resolver tu propia solicitud.' using errcode='42501'; end if;
  select * into strict r from public.receipts where id=c.receipt_id for update;
  if r.revision<>c.base_revision then raise exception 'Conflicto de revisión del recibo.' using errcode='40001'; end if;
  if p_approve is null then raise exception 'Solicitud inválida.'; end if;
  if not p_approve and coalesce(length(trim(p_reason)),0) not between 3 and 300 then raise exception 'Indica el motivo del rechazo.'; end if;
  update public.receipt_corrections set status=case when p_approve then 'approved' else 'rejected' end,resolved_by=auth.uid(),resolved_at=now(),resolution_reason=case when p_approve then null else trim(p_reason) end where id=c.id;
  if p_approve then
    perform private.validate_receipt(p_household,p_month,c.proposed_data);
    perform private.apply_receipt(p_household,p_month,p_revision,c.proposed_data);
  end if;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,case when p_approve then 'Corrección de recibo aprobada' else 'Corrección de recibo rechazada' end,auth.uid());
end $$;

-- Keep historical files referenced by any proposal or previous receipt snapshot.
create or replace function private.file_in_use(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.receipts where file_path=p_path)
    or exists(select 1 from public.calculation_runs where inputs->'receipts' @> jsonb_build_array(jsonb_build_object('file_path',p_path)))
    or exists(select 1 from public.receipt_corrections where before_data->>'filePath'=p_path or proposed_data->>'filePath'=p_path);
$$;
drop policy household_receipt_upload on storage.objects;
create policy household_receipt_upload on storage.objects for insert to authenticated with check(bucket_id='receipts' and private.can_register(private.file_household(name)) and name ~ '^[0-9a-f-]{36}/[0-9]{4}-(0[1-9]|1[0-2])/[0-9a-f-]{36}\.(jpg|png|pdf)$' and not exists(select 1 from public.billing_periods where household_id=private.file_household(name) and to_char(month,'YYYY-MM')=split_part(name,'/',2) and status='closed'));
drop policy household_receipt_cleanup on storage.objects;
create policy household_receipt_cleanup on storage.objects for delete to authenticated using(bucket_id='receipts' and private.can_register(private.file_household(name)) and (private.is_member(private.file_household(name),true) or owner_id=(select auth.uid()::text)) and not private.file_in_use(name));

-- Existing financial payload stays stable; only add collaboration fields.
alter function public.get_household() rename to household_base;
alter function public.household_base() set schema private;
revoke all on function private.household_base() from public,anon,authenticated;
create function public.get_household() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare data jsonb; h uuid;
begin
  data:=private.household_base();
  if data is null then return null; end if;
  h:=(data->'household'->>'id')::uuid;
  return data || jsonb_build_object('accessEnabled',true,'canReview',private.can_review(h),'currentUserId',auth.uid(),
    'myName',(select display_name from public.household_memberships where household_id=h and user_id=auth.uid()),
    'periods',coalesce((select jsonb_agg(p || jsonb_build_object('receipts',coalesce((select jsonb_agg(r || jsonb_build_object('revision',rr.revision,'createdBy',rr.created_by)) from jsonb_array_elements(p->'receipts') r join public.receipts rr on rr.id=(r->>'id')::uuid),'[]'::jsonb))) from jsonb_array_elements(data->'periods') p),'[]'::jsonb),
    'corrections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'month',bp.month,'receiptId',c.receipt_id,'kind',c.kind,'resolvedName',(select coalesce(nullif(display_name,''),'Responsable') from public.household_memberships where household_id=c.household_id and user_id=c.resolved_by),'before',c.before_data,'proposed',c.proposed_data,'reason',c.reason,'status',c.status,'requestedBy',c.requested_by,'requestedName',coalesce(nullif(m.display_name,''),'Integrante'),'requestedAt',c.requested_at,'resolvedBy',c.resolved_by,'resolvedAt',c.resolved_at,'resolutionReason',c.resolution_reason) order by c.requested_at desc) from public.receipt_corrections c join public.billing_periods bp on bp.id=c.period_id left join public.household_memberships m on m.household_id=c.household_id and m.user_id=c.requested_by where c.household_id=h),'[]'::jsonb));
end $$;

create function public.get_household_access(p_household uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',m.display_name,'email',u.email,'role',m.role,'canReview',m.can_review,'active',m.active,'revision',m.revision) order by m.display_name,u.email) from public.household_memberships m join auth.users u on u.id=m.user_id where m.household_id=p_household),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'name',display_name,'role',role,'canReview',can_review,'createdAt',created_at) order by created_at desc) from public.household_invitations where household_id=p_household and completed_at is null and cancelled_at is null),'[]'::jsonb));
end $$;

create function public.update_household_access(p_household uuid,p_user uuid,p_revision integer,p_name text,p_role text,p_can_review boolean,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare m public.household_memberships;
begin
  perform 1 from public.households where id=p_household for update;
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  select * into m from public.household_memberships where household_id=p_household and user_id=p_user for update;
  if not found or m.revision is distinct from p_revision then raise exception 'Conflicto de revisión de acceso.' using errcode='40001'; end if;
  if p_role is null or p_role not in ('admin','member','viewer') or p_can_review is null or p_active is null or (p_can_review and p_role='viewer') or coalesce(length(trim(p_name)),0) not between 1 and 80 then raise exception 'Datos de acceso inválidos.'; end if;
  if m.role='admin' and m.active and (p_role<>'admin' or not p_active) and not exists(select 1 from public.household_memberships where household_id=p_household and user_id<>p_user and active and role='admin') then raise exception 'Debe quedar al menos un administrador activo.'; end if;
  update public.household_memberships set display_name=trim(p_name),role=p_role,can_review=p_can_review,active=p_active,revision=revision+1 where household_id=p_household and user_id=p_user;
  insert into public.activity_events(household_id,description,created_by) values(p_household,'Acceso del hogar actualizado',auth.uid());
end $$;

create function public.prepare_household_invitation(p_household uuid,p_id uuid,p_email text,p_name text,p_role text,p_can_review boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.household_invitations; address text:=lower(trim(p_email));
begin
  perform 1 from public.households where id=p_household for update;
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  if p_id is null or coalesce(length(trim(p_name)),0) not between 1 and 80 or p_role is null or p_role not in ('admin','member','viewer') or p_can_review is null or (p_can_review and p_role='viewer') then raise exception 'Datos de invitación inválidos.'; end if;
  if exists(select 1 from public.household_memberships m join auth.users u on u.id=m.user_id where m.household_id=p_household and lower(u.email)=address) then raise exception 'Esta cuenta ya pertenece al hogar. Edita su acceso.'; end if;
  select * into c from public.household_invitations where id=p_id for update;
  if found then
    if c.household_id<>p_household or c.email<>address or c.cancelled_at is not null or c.completed_at is not null or c.role<>p_role or c.can_review<>p_can_review or c.display_name<>trim(p_name) then raise exception 'La invitación ya cambió. Actualiza los datos.'; end if;
    if c.last_attempt_at>now()-interval '60 seconds' then raise exception 'Espera un minuto antes de reenviar la invitación.'; end if;
    update public.household_invitations set last_attempt_at=now() where id=c.id;
  else
    if (select count(*) from public.household_invitations where household_id=p_household and created_at>now()-interval '1 hour')>=10 then raise exception 'Límite de invitaciones alcanzado. Inténtalo más tarde.'; end if;
    insert into public.household_invitations(id,household_id,email,display_name,role,can_review,created_by) values(p_id,p_household,address,trim(p_name),p_role,p_can_review,auth.uid());
  end if;
  return jsonb_build_object('email',address,'existingUser',exists(select 1 from auth.users where lower(email)=address));
end $$;

create function public.complete_household_invitation(p_household uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.household_invitations; u uuid;
begin
  perform 1 from public.households where id=p_household for update;
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  select * into c from public.household_invitations where id=p_id and household_id=p_household for update;
  if not found or c.completed_at is not null or c.cancelled_at is not null then raise exception 'La invitación ya cambió. Actualiza los datos.'; end if;
  select id into u from auth.users where lower(email)=c.email;
  if u is null then raise exception 'La cuenta aún no fue creada por el servicio de invitación.'; end if;
  if exists(select 1 from public.household_memberships where user_id=u) then raise exception 'La cuenta ya tiene un hogar. Revisa su acceso.'; end if;
  insert into public.household_memberships(household_id,user_id,role,active,can_review,display_name) values(p_household,u,c.role,true,c.can_review,c.display_name);
  update public.household_invitations set completed_at=now() where id=c.id;
  insert into public.activity_events(household_id,description,created_by) values(p_household,'Integrante agregado al hogar',auth.uid());
end $$;

create function public.cancel_household_invitation(p_household uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.households where id=p_household for update;
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  update public.household_invitations set cancelled_at=now() where id=p_id and household_id=p_household and completed_at is null and cancelled_at is null;
  if not found then raise exception 'La invitación ya cambió. Actualiza los datos.'; end if;
end $$;

do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_household','save_receipt','request_receipt_correction','resolve_receipt_correction','get_household_access','update_household_access','prepare_household_invitation','complete_household_invitation','cancel_household_invitation') loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='billing_periods') then alter publication supabase_realtime add table public.billing_periods; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='receipt_corrections') then alter publication supabase_realtime add table public.receipt_corrections; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_memberships') then alter publication supabase_realtime add table public.household_memberships; end if;
  end if;
end $$;
