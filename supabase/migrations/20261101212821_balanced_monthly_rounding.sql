-- Balance tied rounding cents only in newly generated calculations. Existing runs remain immutable.
create function private.balance_monthly_rounding(p_calculation uuid,p_rule uuid) returns void
language plpgsql set search_path = '' as $$
declare candidate record;
begin
  loop
    with totals as (
      select a.group_id,sum(a.amount_cents) as total
      from public.allocations a join public.payment_groups g on g.id=a.group_id
      where a.calculation_id=p_calculation and g.kind='regular' group by a.group_id
    )
    select donor.id as donor_id,recipient.id as recipient_id into candidate
    from totals dt cross join totals rt
    join public.payment_groups dg on dg.id=dt.group_id
    join public.payment_groups rg on rg.id=rt.group_id
    join public.allocations donor on donor.calculation_id=p_calculation and donor.group_id=dt.group_id and donor.remainder_cents=1
    join public.allocations recipient on recipient.calculation_id=p_calculation and recipient.receipt_id=donor.receipt_id and recipient.group_id=rt.group_id and recipient.remainder_cents=0
    join public.receipts bill on bill.id=donor.receipt_id
    join public.services svc on svc.id=bill.service_id
    where dt.total-rt.total>=2 and not exists(
      select 1 from public.receipts r join public.calculation_runs cr on cr.id=p_calculation and cr.period_id=r.period_id
      left join public.rule_participants dw on dw.rule_version_id=p_rule and dw.service_id=r.service_id and dw.group_id=dt.group_id
      left join public.rule_participants rw on rw.rule_version_id=p_rule and rw.service_id=r.service_id and rw.group_id=rt.group_id
      where r.status='confirmed' and coalesce(dw.weight,0)<>coalesce(rw.weight,0)
    )
    order by dt.total-rt.total desc,dg.sort_order,rg.sort_order,svc.code limit 1;
    exit when not found;
    update public.allocations set amount_cents=amount_cents-1,remainder_cents=0 where id=candidate.donor_id;
    update public.allocations set amount_cents=amount_cents+1,remainder_cents=1 where id=candidate.recipient_id;
  end loop;
end $$;
revoke all on function private.balance_monthly_rounding(uuid,uuid) from public,anon,authenticated;

create or replace function private.recalculate(p_period uuid) returns void language plpgsql security definer set search_path = '' as $$
declare p public.billing_periods; fixed integer; run_id uuid; bill record; amount integer; total integer:=0; assigned integer; result_data jsonb;
begin
  select * into strict p from public.billing_periods where id=p_period;
  if p.status='closed' then raise exception 'El periodo está cerrado.'; end if;
  select fixed_contribution_cents into strict fixed from public.rule_versions where id=p.rule_version_id;
  insert into public.calculation_runs(household_id,period_id,inputs,result,created_by)
  values(p.household_id,p.id,jsonb_build_object('roundingPolicy','balanced_monthly_v1','ruleVersionId',p.rule_version_id,'fixedContributionCents',fixed,'ruleWeights',private.rule_weights(p.rule_version_id),'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by s.code) from public.receipts r join public.services s on s.id=r.service_id where r.period_id=p.id and r.status='confirmed'),'[]'::jsonb),'groups',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('members',coalesce((select jsonb_agg(gm.name order by gm.name) from public.group_members gm where gm.group_id=g.id),'[]'::jsonb)) order by g.sort_order) from public.payment_groups g where g.household_id=p.household_id),'[]'::jsonb)),'{}'::jsonb,auth.uid()) returning id into run_id;
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
  perform private.balance_monthly_rounding(run_id,p.rule_version_id);
  result_data:=jsonb_build_object('roundingPolicy','balanced_monthly_v1','id',run_id,'totalCents',total,'receiptCount',(select count(*) from public.receipts where period_id=p.id and status='confirmed'),'fixedContributionCents',fixed,'ruleWeights',private.rule_weights(p.rule_version_id),'createdAt',now(),'groupNames',(select jsonb_object_agg(g->>'code',g->>'name') from public.calculation_runs cr cross join jsonb_array_elements(cr.inputs->'groups') g where cr.id=run_id),'groupMembers',(select jsonb_object_agg(g->>'code',g->'members') from public.calculation_runs cr cross join jsonb_array_elements(cr.inputs->'groups') g where cr.id=run_id),'allocations',coalesce((select jsonb_agg(jsonb_build_object('groupCode',g.code,'service',s.code,'amountCents',a.amount_cents,'remainderCents',a.remainder_cents) order by s.code,g.sort_order) from public.allocations a join public.payment_groups g on g.id=a.group_id join public.receipts r on r.id=a.receipt_id join public.services s on s.id=r.service_id where a.calculation_id=run_id),'[]'::jsonb));
  update public.calculation_runs set result=result_data where id=run_id;
  update public.billing_periods set current_calculation_id=run_id where id=p.id;
end $$;

