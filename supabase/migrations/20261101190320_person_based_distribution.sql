-- Phase 1: inert defaults preserve existing equal-group rules. No activation or recalculation.
alter table public.rule_participants add column weight integer not null default 1 check (weight between 1 and 10);

create function private.rule_weights(p_rule uuid) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(code,weights),'{}'::jsonb) from (
    select s.code,jsonb_object_agg(g.code,rp.weight) as weights
    from public.rule_participants rp join public.services s on s.id=rp.service_id
    join public.payment_groups g on g.id=rp.group_id
    where rp.rule_version_id=p_rule group by s.code
  ) x;
$$;
revoke all on function private.rule_weights(uuid) from public,anon,authenticated;

create function private.weighted_allocations(p_rule uuid,p_service uuid,p_cents integer)
returns table(group_id uuid,amount_cents integer,remainder_cents integer)
language plpgsql stable set search_path = '' as $$
begin
  if p_cents is null or p_cents not between 0 and 99999999 then raise exception 'Importe inv�lido.'; end if;
  return query
  with shares as (
    select g.id,g.sort_order,p_cents::bigint*rp.weight as numerator,sum(rp.weight) over () as denominator
    from public.rule_participants rp join public.payment_groups g on g.id=rp.group_id
    where rp.rule_version_id=p_rule and rp.service_id=p_service
  ), floors as (
    select *,numerator/denominator as base,numerator%denominator as fraction from shares
  ), ranked as (
    select *,row_number() over(order by fraction desc,sort_order,id) as rank,
      p_cents-sum(base) over () as remaining from floors
  )
  select id,(base+case when rank<=remaining then 1 else 0 end)::integer,
    case when rank<=remaining then 1 else 0 end from ranked order by sort_order,id;
end $$;
revoke all on function private.weighted_allocations(uuid,uuid,integer) from public,anon,authenticated;

create or replace function private.recalculate(p_period uuid) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; fixed integer; run_id uuid; bill record; amount integer; total integer:=0; assigned integer; result_data jsonb;
begin
  select * into strict p from public.billing_periods where id=p_period;
  if p.status='closed' then raise exception 'El periodo está cerrado.'; end if;
  select fixed_contribution_cents into strict fixed from public.rule_versions where id=p.rule_version_id;
  insert into public.calculation_runs(household_id,period_id,inputs,result,created_by)
  values(p.household_id,p.id,jsonb_build_object('ruleVersionId',p.rule_version_id,'fixedContributionCents',fixed,'ruleWeights',private.rule_weights(p.rule_version_id),'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by s.code) from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id and r.status='confirmed'),'[]'::jsonb),'groups',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('members',coalesce((select jsonb_agg(gm.name order by gm.name) from public.group_members gm where gm.group_id=g.id),'[]'::jsonb)) order by g.sort_order) from public.payment_groups g where g.household_id=p.household_id),'[]'::jsonb)),'{}'::jsonb,auth.uid()) returning id into run_id;
  for bill in select r.*,s.code from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id and r.status='confirmed' order by s.code loop
    amount:=bill.amount_cents;
    total:=total+amount;
    if bill.code='electricity' then
      if amount<fixed then raise exception 'El recibo de luz debe cubrir el aporte fijo especial.'; end if;
      insert into public.allocations(household_id,calculation_id,receipt_id,group_id,amount_cents) select p.household_id,run_id,bill.id,id,fixed from public.payment_groups where household_id=p.household_id and code='rossana';
      amount:=amount-fixed;
    end if;
    if not exists(select 1 from public.rule_participants where rule_version_id=p.rule_version_id and service_id=bill.service_id) then
      raise exception 'El servicio no tiene grupos participantes.';
    end if;
    insert into public.allocations(household_id,calculation_id,receipt_id,group_id,amount_cents,remainder_cents)
    select p.household_id,run_id,bill.id,group_id,amount_cents,remainder_cents
    from private.weighted_allocations(p.rule_version_id,bill.service_id,amount);
    select coalesce(sum(amount_cents),0) into assigned from public.allocations where calculation_id=run_id and receipt_id=bill.id;
    if assigned<>bill.amount_cents then raise exception 'La distribución no cuadra con el recibo.'; end if;
  end loop;
  result_data:=jsonb_build_object('id',run_id,'totalCents',total,'receiptCount',(select count(*) from public.receipts where period_id=p.id and status='confirmed'),'fixedContributionCents',fixed,'ruleWeights',private.rule_weights(p.rule_version_id),'createdAt',now(),'groupNames',(select jsonb_object_agg(g->>'code',g->>'name') from public.calculation_runs cr cross join jsonb_array_elements(cr.inputs->'groups') g where cr.id=run_id),'groupMembers',(select jsonb_object_agg(g->>'code',g->'members') from public.calculation_runs cr cross join jsonb_array_elements(cr.inputs->'groups') g where cr.id=run_id),'allocations',coalesce((select jsonb_agg(jsonb_build_object('groupCode',g.code,'service',s.code,'amountCents',a.amount_cents,'remainderCents',a.remainder_cents) order by s.code,g.sort_order) from public.allocations a join public.payment_groups g on g.id=a.group_id join public.receipts r on r.id=a.receipt_id join public.services s on s.id=r.service_id where a.calculation_id=run_id),'[]'::jsonb));
  update public.calculation_runs set result=result_data where id=run_id;
  update public.billing_periods set current_calculation_id=run_id where id=p.id;
end $$;

