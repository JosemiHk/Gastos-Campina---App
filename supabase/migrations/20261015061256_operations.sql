create function private.lock_period(p_household uuid,p_month date,p_revision integer,p_allow_closed boolean default false)
returns public.billing_periods language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods;
begin
  if not private.is_member(p_household,true) then raise exception 'No autorizado.' using errcode='42501'; end if;
  if p_revision is null or p_revision < 0 or p_month is null or extract(day from p_month)<>1 then raise exception 'Periodo inválido.'; end if;
  insert into public.billing_periods(household_id,month,rule_version_id) select id,p_month,default_rule_id from public.households where id=p_household on conflict(household_id,month) do nothing;
  select * into strict p from public.billing_periods where household_id=p_household and month=p_month for update;
  if p.revision<>p_revision then raise exception 'Conflicto de revisión: el mes fue actualizado.' using errcode='40001'; end if;
  if p.status='closed' and not p_allow_closed then raise exception 'El periodo está cerrado.'; end if;
  return p;
end $$;

create function private.recalculate(p_period uuid) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; fixed integer; run_id uuid; bill record; participant record; n integer; i integer; base integer; remainder integer; amount integer; total integer:=0; assigned integer; result_data jsonb;
begin
  select * into strict p from public.billing_periods where id=p_period;
  if p.status='closed' then raise exception 'El periodo está cerrado.'; end if;
  select fixed_contribution_cents into strict fixed from public.rule_versions where id=p.rule_version_id;
  insert into public.calculation_runs(household_id,period_id,inputs,result,created_by)
  values(p.household_id,p.id,jsonb_build_object('ruleVersionId',p.rule_version_id,'fixedContributionCents',fixed,'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by s.code) from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id and r.status='confirmed'),'[]'::jsonb),'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.sort_order) from public.payment_groups g where g.household_id=p.household_id),'[]'::jsonb)),'{}'::jsonb,auth.uid()) returning id into run_id;
  for bill in select r.*,s.code from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id and r.status='confirmed' order by s.code loop
    amount:=bill.amount_cents;
    total:=total+amount;
    if bill.code='electricity' then
      if amount<fixed then raise exception 'El recibo de luz debe cubrir el aporte fijo de Rossana.'; end if;
      insert into public.allocations(household_id,calculation_id,receipt_id,group_id,amount_cents) select p.household_id,run_id,bill.id,id,fixed from public.payment_groups where household_id=p.household_id and code='rossana';
      amount:=amount-fixed;
    end if;
    select count(*) into n from public.rule_participants where rule_version_id=p.rule_version_id and service_id=bill.service_id;
    if n=0 then raise exception 'El servicio no tiene grupos participantes.'; end if;
    base:=amount/n; remainder:=amount%n; i:=0;
    for participant in select g.* from public.rule_participants rp join public.payment_groups g on g.id=rp.group_id where rp.rule_version_id=p.rule_version_id and rp.service_id=bill.service_id order by g.sort_order,g.id loop
      insert into public.allocations(household_id,calculation_id,receipt_id,group_id,amount_cents,remainder_cents) values(p.household_id,run_id,bill.id,participant.id,base+case when i<remainder then 1 else 0 end,case when i<remainder then 1 else 0 end);
      i:=i+1;
    end loop;
    select coalesce(sum(amount_cents),0) into assigned from public.allocations where calculation_id=run_id and receipt_id=bill.id;
    if assigned<>bill.amount_cents then raise exception 'La distribución no cuadra con el recibo.'; end if;
  end loop;
  result_data:=jsonb_build_object('id',run_id,'totalCents',total,'receiptCount',(select count(*) from public.receipts where period_id=p.id and status='confirmed'),'fixedContributionCents',fixed,'createdAt',now(),'groupNames',(select jsonb_object_agg(code,name) from public.payment_groups where household_id=p.household_id),'allocations',coalesce((select jsonb_agg(jsonb_build_object('groupCode',g.code,'service',s.code,'amountCents',a.amount_cents,'remainderCents',a.remainder_cents) order by s.code,g.sort_order) from public.allocations a join public.payment_groups g on g.id=a.group_id join public.receipts r on r.id=a.receipt_id join public.services s on s.id=r.service_id where a.calculation_id=run_id),'[]'::jsonb));
  update public.calculation_runs set result=result_data where id=run_id;
  update public.billing_periods set current_calculation_id=run_id where id=p.id;
end $$;

create function public.get_household() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare h public.households; access_role text;
begin
  select hh.*,m.role into h.id,h.name,h.currency,h.timezone,h.created_at,h.default_rule_id,access_role from public.households hh join public.household_memberships m on m.household_id=hh.id where m.user_id=auth.uid() and m.active order by hh.created_at,hh.id limit 1;
  if h.id is null then return null; end if;
  return jsonb_build_object(
    'household',jsonb_build_object('id',h.id,'name',h.name,'fixedContributionCents',(select fixed_contribution_cents from public.rule_versions where id=h.default_rule_id)),
    'role',access_role,
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'code',g.code,'name',g.name,'kind',g.kind,'sortOrder',g.sort_order,'members',coalesce((select jsonb_agg(gm.name order by gm.name) from public.group_members gm where gm.group_id=g.id),'[]'::jsonb)) order by g.sort_order) from public.payment_groups g where g.household_id=h.id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'label',a.label,'holder',a.holder,'number',a.number,'cci',a.cci) order by a.kind,a.label) from public.transfer_accounts a where a.household_id=h.id),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'month',p.month,'status',p.status,'revision',p.revision,'closedAt',p.closed_at,'fixedContributionCents',rv.fixed_contribution_cents,'calculation',cr.result,
      'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'service',s.code,'amountCents',r.amount_cents,'status',r.status,'dueDate',r.due_date,'issueDate',r.issue_date,'filePath',r.file_path,'fileName',r.file_name,'fileSize',r.file_size,'fileType',r.file_type,'createdAt',r.created_at) order by s.code) from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id),'[]'::jsonb),
      'payments',coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'groupCode',g.code,'amountCents',pc.amount_cents,'method',pc.method,'confirmedAt',pc.confirmed_at,'voidedAt',pc.voided_at) order by pc.confirmed_at) from public.payment_confirmations pc join public.payment_groups g on g.id=pc.group_id where pc.period_id=p.id),'[]'::jsonb),
      'activity',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'description',ev.description,'createdAt',ev.created_at) order by ev.created_at desc) from (select * from public.activity_events where period_id=p.id order by created_at desc limit 20) ev),'[]'::jsonb)
    ) order by p.month desc) from public.billing_periods p join public.rule_versions rv on rv.id=p.rule_version_id left join public.calculation_runs cr on cr.id=p.current_calculation_id where p.household_id=h.id),'[]'::jsonb)
  );
end $$;

create function public.save_receipt(p_household uuid,p_month date,p_revision integer,p_receipt jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; receipt_id uuid; svc uuid; old_receipt public.receipts; path text; file_metadata jsonb;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
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

create function public.close_period(p_household uuid,p_month date,p_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
  if (select count(*) from public.receipts where period_id=p.id and status='confirmed')<>3 or p.current_calculation_id is null then raise exception 'Completa los tres recibos antes de cerrar el mes.'; end if;
  update public.billing_periods set status='closed',closed_at=now(),closed_by=auth.uid(),revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,'Mes cerrado: importes y reglas protegidos.',auth.uid());
end $$;

create function public.confirm_payment(p_household uuid,p_month date,p_revision integer,p_group text,p_method text) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; g uuid; owed integer; paid integer;
begin
  p:=private.lock_period(p_household,p_month,p_revision,true);
  select id into g from public.payment_groups where household_id=p_household and code=p_group;
  if g is null then raise exception 'Grupo inválido.'; end if;
  select coalesce(sum(amount_cents),0) into owed from public.allocations where calculation_id=p.current_calculation_id and group_id=g;
  select coalesce(sum(amount_cents),0) into paid from public.payment_confirmations where period_id=p.id and group_id=g and voided_at is null;
  if owed<=paid then raise exception 'No hay importe pendiente para este grupo.'; end if;
  insert into public.payment_confirmations(household_id,period_id,group_id,amount_cents,method,confirmed_by) values(p_household,p.id,g,owed-paid,p_method,auth.uid());
  update public.billing_periods set revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,'Aporte confirmado: '||(select name from public.payment_groups where id=g)||' ('||p_method||').',auth.uid());
end $$;

create function public.void_payment(p_household uuid,p_month date,p_revision integer,p_payment uuid,p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods;
begin
  p:=private.lock_period(p_household,p_month,p_revision,true);
  if length(trim(p_reason)) not between 3 and 300 or p_reason is null then raise exception 'Escribe un motivo de entre 3 y 300 caracteres.'; end if;
  update public.payment_confirmations set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason) where id=p_payment and household_id=p_household and period_id=p.id and voided_at is null;
  if not found then raise exception 'La confirmación ya fue actualizada.'; end if;
  update public.billing_periods set revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,'Confirmación de aporte anulada: '||trim(p_reason),auth.uid());
end $$;

create function public.save_settings(p_household uuid,p_month date,p_revision integer,p_fixed integer,p_accounts jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; r uuid; a jsonb;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
  if p_fixed is null or p_fixed not between 0 and 99999999 or jsonb_typeof(p_accounts) is distinct from 'array' or jsonb_array_length(p_accounts)>5 then raise exception 'Datos de configuración inválidos.'; end if;
  insert into public.rule_versions(household_id,fixed_contribution_cents,created_by) values(p_household,p_fixed,auth.uid()) returning id into r;
  insert into public.rule_participants(household_id,rule_version_id,service_id,group_id) select household_id,r,service_id,group_id from public.rule_participants where rule_version_id=p.rule_version_id;
  update public.households set default_rule_id=r where id=p_household;
  update public.billing_periods set rule_version_id=r where id=p.id;
  perform private.recalculate(p.id);
  delete from public.transfer_accounts where household_id=p_household;
  for a in select value from jsonb_array_elements(p_accounts) loop
    insert into public.transfer_accounts(household_id,kind,label,holder,number,cci) values(p_household,a->>'kind',trim(a->>'label'),trim(a->>'holder'),trim(a->>'number'),trim(coalesce(a->>'cci','')));
  end loop;
  update public.billing_periods set revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by) values(p_household,p.id,'Reglas y datos de transferencia actualizados.',auth.uid());
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid,boolean) to authenticated;
revoke all on function public.get_household() from public,anon;
revoke all on function public.save_receipt(uuid,date,integer,jsonb) from public,anon;
revoke all on function public.close_period(uuid,date,integer) from public,anon;
revoke all on function public.confirm_payment(uuid,date,integer,text,text) from public,anon;
revoke all on function public.void_payment(uuid,date,integer,uuid,text) from public,anon;
revoke all on function public.save_settings(uuid,date,integer,integer,jsonb) from public,anon;
grant execute on function public.get_household(),public.save_receipt(uuid,date,integer,jsonb),public.close_period(uuid,date,integer),public.confirm_payment(uuid,date,integer,text,text),public.void_payment(uuid,date,integer,uuid,text),public.save_settings(uuid,date,integer,integer,jsonb) to authenticated;
