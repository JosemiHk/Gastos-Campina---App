-- Supabase may install this event-trigger helper in public when automatic RLS is enabled.
-- Event triggers execute as their owner; browser roles never need EXECUTE here.
-- Keep this optional so the same migrations also work on local installations.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
