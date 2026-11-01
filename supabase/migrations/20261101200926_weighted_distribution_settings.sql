-- Additive integration only: no receipt, attachment, payment or historical result is rewritten.
create function public.save_weighted_household_settings(
  p_household uuid,p_month date,p_revision integer,p_configuration_revision integer,
  p_fixed integer,p_accounts jsonb,p_groups jsonb,p_participants jsonb,p_weights jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; r uuid; item jsonb; member_name jsonb; svc record; participant_code jsonb; current_revision integer;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
  select configuration_revision into strict current_revision from public.households where id=p_household for update;
  if p_configuration_revision is distinct from current_revision then
    raise exception 'Conflicto de revisión: la configuración del hogar fue actualizada.' using errcode='40001';
  end if;
  if p_fixed is null or p_fixed not between 0 and 99999999
    or jsonb_typeof(p_accounts) is distinct from 'array' or jsonb_array_length(p_accounts)>5
    or jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups)<>4
    or jsonb_typeof(p_participants) is distinct from 'object' then
    raise exception 'Datos de configuración inválidos.';
  end if;
  if (select count(distinct value->>'code') from jsonb_array_elements(p_groups))<>4
    or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p_groups))<>4
    or (select count(*) from jsonb_object_keys(p_participants))<>3 then
    raise exception 'Los datos de los grupos o servicios están incompletos o duplicados.';
  end if;
  for item in select value from jsonb_array_elements(p_groups) loop
    if not exists(select 1 from public.payment_groups where household_id=p_household and code=item->>'code')
      or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 1 and 80
      or jsonb_typeof(item->'members') is distinct from 'array' or jsonb_array_length(item->'members') not between 1 and 10 then
      raise exception 'Cada grupo necesita un nombre y entre uno y diez integrantes.';
    end if;
    if (select count(distinct lower(trim(value #>> '{}'))) from jsonb_array_elements(item->'members'))<>jsonb_array_length(item->'members') then
      raise exception 'Hay integrantes repetidos en un grupo.';
    end if;
    for member_name in select value from jsonb_array_elements(item->'members') loop
      if jsonb_typeof(member_name) is distinct from 'string' or length(trim(member_name #>> '{}')) not between 1 and 80 then
        raise exception 'El nombre de cada integrante debe tener entre 1 y 80 caracteres.';
      end if;
    end loop;
  end loop;
  for svc in select id,code from public.services where household_id=p_household loop
    if jsonb_typeof(p_participants->svc.code) is distinct from 'array'
      or jsonb_array_length(p_participants->svc.code) not between 1 and 3 then
      raise exception 'Selecciona al menos un grupo para cada servicio.';
    end if;
    if (select count(distinct value) from jsonb_array_elements(p_participants->svc.code))<>jsonb_array_length(p_participants->svc.code) then
      raise exception 'Hay grupos repetidos en un servicio.';
    end if;
    for participant_code in select value from jsonb_array_elements(p_participants->svc.code) loop
      if jsonb_typeof(participant_code) is distinct from 'string' or not exists(
        select 1 from public.payment_groups where household_id=p_household and kind='regular' and code=(participant_code #>> '{}')
      ) then raise exception 'Grupo participante inválido. El aporte especial se configura por separado.'; end if;
    end loop;
  end loop;
  if jsonb_typeof(p_weights) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_weights))<>3 then
    raise exception 'Indica las personas de cada servicio.';
  end if;
  for svc in select id,code from public.services where household_id=p_household loop
    if jsonb_typeof(p_weights->svc.code) is distinct from 'object' then raise exception 'Pesos de servicio inválidos.'; end if;
    if (select count(*) from jsonb_object_keys(p_weights->svc.code))<>jsonb_array_length(p_participants->svc.code) then raise exception 'Los pesos deben coincidir con los participantes.'; end if;
    for participant_code in select value from jsonb_array_elements(p_participants->svc.code) loop
      if jsonb_typeof(p_weights->svc.code->(participant_code #>> '{}')) is distinct from 'number' then raise exception 'Número de personas inválido.'; end if;
      if (p_weights->svc.code->>(participant_code #>> '{}'))::numeric not between 1 and 10
        or (p_weights->svc.code->>(participant_code #>> '{}'))::numeric<>trunc((p_weights->svc.code->>(participant_code #>> '{}'))::numeric) then
        raise exception 'El número de personas debe ser un entero entre 1 y 10.';
      end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(p_groups) loop
    update public.payment_groups set name=trim(item->>'name') where household_id=p_household and code=item->>'code';
    delete from public.group_members where household_id=p_household and group_id=(select id from public.payment_groups where household_id=p_household and code=item->>'code');
    insert into public.group_members(household_id,group_id,name)
    select p_household,g.id,trim(m.value #>> '{}') from public.payment_groups g cross join jsonb_array_elements(item->'members') m
    where g.household_id=p_household and g.code=item->>'code';
  end loop;
  insert into public.rule_versions(household_id,fixed_contribution_cents,created_by) values(p_household,p_fixed,auth.uid()) returning id into r;
  insert into public.rule_participants(household_id,rule_version_id,service_id,group_id,weight)
  select p_household,r,s.id,g.id,(p_weights->s.code->>g.code)::numeric::integer from public.services s cross join public.payment_groups g
  where s.household_id=p_household and g.household_id=p_household and g.kind='regular'
    and (p_participants->s.code) ? g.code;
  update public.households set default_rule_id=r,configuration_revision=configuration_revision+1 where id=p_household;
  update public.billing_periods set rule_version_id=r where id=p.id;
  perform private.recalculate(p.id);
  delete from public.transfer_accounts where household_id=p_household;
  for item in select value from jsonb_array_elements(p_accounts) loop
    insert into public.transfer_accounts(household_id,kind,label,holder,number,cci)
    values(p_household,item->>'kind',trim(item->>'label'),trim(item->>'holder'),trim(item->>'number'),trim(coalesce(item->>'cci','')));
  end loop;
  update public.billing_periods set revision=revision+1 where id=p.id;
  insert into public.activity_events(household_id,period_id,description,created_by)
  values(p_household,p.id,'Grupos, participantes y configuración actualizados.',auth.uid());
end $$;
revoke all on function public.save_weighted_household_settings(uuid,date,integer,integer,integer,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_weighted_household_settings(uuid,date,integer,integer,integer,jsonb,jsonb,jsonb,jsonb) to authenticated;

-- Backward-compatible writer: preserve each selected period's weights, including new groups at weight 1.
create or replace function public.save_household_settings(
  p_household uuid,p_month date,p_revision integer,p_configuration_revision integer,
  p_fixed integer,p_accounts jsonb,p_groups jsonb,p_participants jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; weights jsonb;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
  select jsonb_object_agg(service,parts) into weights from (
    select e.key as service,jsonb_object_agg(code,coalesce((private.rule_weights(p.rule_version_id)->e.key->>code)::integer,1)) as parts
    from jsonb_each(p_participants) e cross join lateral jsonb_array_elements_text(e.value) x(code) group by e.key
  ) w;
  perform public.save_weighted_household_settings(p_household,p_month,p_revision,p_configuration_revision,p_fixed,p_accounts,p_groups,p_participants,weights);
end $$;
revoke all on function public.save_household_settings(uuid,date,integer,integer,integer,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_household_settings(uuid,date,integer,integer,integer,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.save_settings(p_household uuid,p_month date,p_revision integer,p_fixed integer,p_accounts jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; r uuid; a jsonb;
begin
  p:=private.lock_period(p_household,p_month,p_revision);
  if p_fixed is null or p_fixed not between 0 and 99999999 or jsonb_typeof(p_accounts) is distinct from 'array' or jsonb_array_length(p_accounts)>5 then raise exception 'Datos de configuración inválidos.'; end if;
  insert into public.rule_versions(household_id,fixed_contribution_cents,created_by) values(p_household,p_fixed,auth.uid()) returning id into r;
  insert into public.rule_participants(household_id,rule_version_id,service_id,group_id,weight) select household_id,r,service_id,group_id,weight from public.rule_participants where rule_version_id=p.rule_version_id;
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

create or replace function public.get_household() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare h public.households; access_role text;
begin
  select hh.id,hh.name,hh.currency,hh.timezone,hh.created_at,hh.default_rule_id,hh.configuration_revision,m.role into h.id,h.name,h.currency,h.timezone,h.created_at,h.default_rule_id,h.configuration_revision,access_role from public.households hh join public.household_memberships m on m.household_id=hh.id where m.user_id=auth.uid() and m.active order by hh.created_at,hh.id limit 1;
  if h.id is null then return null; end if;
  return jsonb_build_object(
    'household',jsonb_build_object('id',h.id,'name',h.name,'configurationRevision',h.configuration_revision,'ruleWeights',private.rule_weights(h.default_rule_id),'participants',private.rule_groups(h.default_rule_id),'fixedContributionCents',(select fixed_contribution_cents from public.rule_versions where id=h.default_rule_id)),
    'role',access_role,
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'code',g.code,'name',g.name,'kind',g.kind,'sortOrder',g.sort_order,'members',coalesce((select jsonb_agg(gm.name order by gm.name) from public.group_members gm where gm.group_id=g.id),'[]'::jsonb)) order by g.sort_order) from public.payment_groups g where g.household_id=h.id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'label',a.label,'holder',a.holder,'number',a.number,'cci',a.cci) order by a.kind,a.label) from public.transfer_accounts a where a.household_id=h.id),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'month',p.month,'status',p.status,'revision',p.revision,'closedAt',p.closed_at,'fixedContributionCents',rv.fixed_contribution_cents,'calculation',cr.result,'ruleWeights',private.rule_weights(p.rule_version_id),'participants',private.rule_groups(p.rule_version_id),
      'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'service',s.code,'amountCents',r.amount_cents,'status',r.status,'dueDate',r.due_date,'issueDate',r.issue_date,'filePath',r.file_path,'fileName',r.file_name,'fileSize',r.file_size,'fileType',r.file_type,'createdAt',r.created_at) order by s.code) from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id),'[]'::jsonb),
      'payments',coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'groupCode',g.code,'amountCents',pc.amount_cents,'method',pc.method,'confirmedAt',pc.confirmed_at,'voidedAt',pc.voided_at) order by pc.confirmed_at) from public.payment_confirmations pc join public.payment_groups g on g.id=pc.group_id where pc.period_id=p.id),'[]'::jsonb),
      'activity',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'description',ev.description,'createdAt',ev.created_at) order by ev.created_at desc) from (select * from public.activity_events where period_id=p.id order by created_at desc limit 20) ev),'[]'::jsonb)
    ) order by p.month desc) from public.billing_periods p join public.rule_versions rv on rv.id=p.rule_version_id left join public.calculation_runs cr on cr.id=p.current_calculation_id where p.household_id=h.id),'[]'::jsonb)
  );
end $$;

