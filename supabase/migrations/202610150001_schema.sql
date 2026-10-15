-- Browser clients have read access through RLS; financial writes only use guarded RPCs.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  currency text not null default 'PEN' check (currency = 'PEN'),
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now()
);
create table public.household_memberships (
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'viewer')),
  active boolean not null default true,
  primary key (household_id, user_id)
);
create index memberships_user_idx on public.household_memberships(user_id, household_id) where active;
create table public.payment_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  code text not null check (code in ('twins', 'miguel', 'jm', 'rossana')),
  name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('regular', 'special')),
  sort_order integer not null check (sort_order between 0 and 100),
  unique(household_id, code), unique(household_id, id)
);
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  group_id uuid not null,
  name text not null check (length(name) between 1 and 80),
  foreign key(household_id, group_id) references public.payment_groups(household_id, id)
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  code text not null check (code in ('water', 'electricity', 'internet')),
  name text not null,
  unique(household_id, code), unique(household_id, id)
);
create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  fixed_contribution_cents integer not null default 2000 check (fixed_contribution_cents between 0 and 99999999),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(household_id, id)
);
alter table public.households add column default_rule_id uuid;
alter table public.households add constraint households_default_rule_fk foreign key(id, default_rule_id) references public.rule_versions(household_id, id);
create table public.rule_participants (
  household_id uuid not null references public.households(id),
  rule_version_id uuid not null,
  service_id uuid not null,
  group_id uuid not null,
  primary key(rule_version_id, service_id, group_id),
  foreign key(household_id, rule_version_id) references public.rule_versions(household_id, id),
  foreign key(household_id, service_id) references public.services(household_id, id),
  foreign key(household_id, group_id) references public.payment_groups(household_id, id)
);
create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  month date not null check (extract(day from month) = 1 and month between date '2020-01-01' and date '2100-12-01'),
  status text not null default 'open' check (status in ('open','closed')),
  revision integer not null default 0 check (revision >= 0),
  rule_version_id uuid not null,
  current_calculation_id uuid,
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  unique(household_id, month), unique(household_id, id),
  foreign key(household_id, rule_version_id) references public.rule_versions(household_id,id),
  check ((status = 'closed') = (closed_at is not null))
);
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  period_id uuid not null,
  service_id uuid not null,
  amount_cents integer not null check (amount_cents between 1 and 99999999),
  status text not null check(status in ('draft','confirmed')),
  due_date date,
  issue_date date,
  file_path text,
  file_name text,
  file_size integer check(file_size between 1 and 10485760),
  file_type text check(file_type in ('image/jpeg','image/png','application/pdf')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(household_id, period_id) references public.billing_periods(household_id,id),
  foreign key(household_id, service_id) references public.services(household_id,id),
  unique(period_id,service_id), unique(household_id,id),
  check ((file_path is null and file_name is null and file_size is null and file_type is null) or (file_path is not null and file_name is not null and file_size is not null and file_type is not null))
);
create index receipts_period_idx on public.receipts(period_id);
create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  period_id uuid not null,
  algorithm_version integer not null default 1,
  inputs jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  foreign key(household_id,period_id) references public.billing_periods(household_id,id),
  unique(household_id,id), unique(period_id,id)
);
alter table public.billing_periods add constraint periods_calculation_fk foreign key(id,current_calculation_id) references public.calculation_runs(period_id,id);
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  calculation_id uuid not null,
  receipt_id uuid not null,
  group_id uuid not null,
  amount_cents integer not null check(amount_cents >= 0),
  remainder_cents integer not null default 0 check(remainder_cents in (0,1)),
  foreign key(household_id,calculation_id) references public.calculation_runs(household_id,id),
  foreign key(household_id,receipt_id) references public.receipts(household_id,id),
  foreign key(household_id,group_id) references public.payment_groups(household_id,id),
  unique(calculation_id,receipt_id,group_id)
);
create index allocations_run_idx on public.allocations(calculation_id);
create table public.payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  period_id uuid not null,
  group_id uuid not null,
  amount_cents integer not null check(amount_cents > 0),
  method text not null check(method in ('Yape','Plin','Transferencia','Efectivo','Otro')),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  foreign key(household_id,period_id) references public.billing_periods(household_id,id),
  foreign key(household_id,group_id) references public.payment_groups(household_id,id),
  check ((voided_at is null and voided_by is null and void_reason is null) or (voided_at is not null and voided_by is not null and length(trim(void_reason)) between 3 and 300))
);
create index payments_period_idx on public.payment_confirmations(period_id,group_id);
create table public.transfer_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  kind text not null check(kind in ('yape','plin','bank')),
  label text not null check(length(label) between 1 and 60),
  holder text not null check(length(holder) between 1 and 100),
  number text not null check(length(number) between 1 and 60),
  cci text not null default '' check(length(cci) <= 30)
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  period_id uuid,
  description text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(household_id,period_id) references public.billing_periods(household_id,id)
);
create index activity_period_idx on public.activity_events(period_id,created_at desc);

create function private.is_member(p_household uuid, p_admin boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_memberships where household_id=p_household and user_id=(select auth.uid()) and active and (not p_admin or role='admin'));
$$;
revoke all on function private.is_member(uuid,boolean) from public, anon;
grant execute on function private.is_member(uuid,boolean) to authenticated;

do $$ declare t text; begin
  foreach t in array array['households','household_memberships','payment_groups','group_members','services','rule_versions','rule_participants','billing_periods','receipts','calculation_runs','allocations','payment_confirmations','transfer_accounts','activity_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t='households' then
      execute format('create policy read_member on public.%I for select to authenticated using (private.is_member(id))',t);
    else
      execute format('create policy read_member on public.%I for select to authenticated using (private.is_member(household_id))',t);
    end if;
  end loop;
end $$;

-- Only run by an operator in the SQL editor, after creating a confirmed Auth user.
create function private.provision_household(p_admin_email text, p_name text default 'Hogar Campiña') returns uuid
language plpgsql security definer set search_path = '' as $$
declare h uuid; u uuid; r uuid; g uuid;
begin
  select id into u from auth.users where lower(email)=lower(trim(p_admin_email));
  if u is null then raise exception 'Crea primero el usuario autorizado en Supabase Auth.'; end if;
  if exists(select 1 from public.household_memberships where user_id=u and active) then raise exception 'El usuario ya tiene un hogar.'; end if;
  insert into public.households(name) values(p_name) returning id into h;
  insert into public.household_memberships values(h,u,'admin',true);
  insert into public.payment_groups(household_id,code,name,kind,sort_order) values (h,'twins','Gemelas','regular',0),(h,'miguel','Miguel','regular',1),(h,'jm','JM','regular',2),(h,'rossana','Rossana','special',3);
  insert into public.group_members(household_id,group_id,name) select h,id,unnest(case code when 'twins' then array['Amy','Annie'] when 'miguel' then array['Denis Miguel'] when 'jm' then array['José Miguel'] else array['Rossana'] end) from public.payment_groups where household_id=h;
  insert into public.services(household_id,code,name) values(h,'water','Agua'),(h,'electricity','Luz'),(h,'internet','Internet WIN');
  insert into public.rule_versions(household_id,created_by) values(h,u) returning id into r;
  insert into public.rule_participants(household_id,rule_version_id,service_id,group_id)
    select h,r,s.id,pg.id from public.services s cross join public.payment_groups pg where s.household_id=h and pg.household_id=h and pg.kind='regular' and (s.code<>'internet' or pg.code<>'twins');
  update public.households set default_rule_id=r where id=h;
  return h;
end $$;
revoke all on function private.provision_household(text,text) from public,anon,authenticated;
