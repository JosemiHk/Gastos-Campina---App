insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function private.file_household(p_path text) returns uuid language plpgsql immutable set search_path = '' as $$
begin return split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return null; end $$;
create function private.file_in_use(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.receipts where file_path=p_path) or exists(select 1 from public.calculation_runs where inputs->'receipts' @> jsonb_build_array(jsonb_build_object('file_path',p_path)));
$$;
revoke all on function private.file_household(text),private.file_in_use(text) from public,anon;
grant execute on function private.file_household(text),private.file_in_use(text) to authenticated;

create policy household_receipt_read on storage.objects for select to authenticated using(bucket_id='receipts' and private.is_member(private.file_household(name)));
create policy household_receipt_upload on storage.objects for insert to authenticated with check(bucket_id='receipts' and private.is_member(private.file_household(name),true) and name ~ '^[0-9a-f-]{36}/[0-9]{4}-(0[1-9]|1[0-2])/[0-9a-f-]{36}\.(jpg|png|pdf)$' and not exists(select 1 from public.billing_periods where household_id=private.file_household(name) and to_char(month,'YYYY-MM')=split_part(name,'/',2) and status='closed'));
create policy household_receipt_cleanup on storage.objects for delete to authenticated using(bucket_id='receipts' and private.is_member(private.file_household(name),true) and not private.file_in_use(name));
