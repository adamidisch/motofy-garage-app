create schema if not exists private;

create or replace function private.is_member(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.garage_members m
    where m.garage_id = g
      and m.user_id = auth.uid()
  );
$$;

revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

drop policy if exists customers_all on public.customers;
create policy customers_all
  on public.customers
  for all
  to authenticated
  using (private.is_member(garage_id))
  with check (private.is_member(garage_id));

drop policy if exists members_read on public.garage_members;
create policy members_read
  on public.garage_members
  for select
  to authenticated
  using (private.is_member(garage_id));

drop policy if exists garages_read on public.garages;
create policy garages_read
  on public.garages
  for select
  to authenticated
  using (private.is_member(id));

drop policy if exists garages_update on public.garages;
create policy garages_update
  on public.garages
  for update
  to authenticated
  using (private.is_member(id))
  with check (private.is_member(id));

drop policy if exists jobs_all on public.jobs;
create policy jobs_all
  on public.jobs
  for all
  to authenticated
  using (private.is_member(garage_id))
  with check (private.is_member(garage_id));

drop policy if exists photos_all on public.photos;
create policy photos_all
  on public.photos
  for all
  to authenticated
  using (private.is_member(garage_id))
  with check (private.is_member(garage_id));

drop policy if exists vehicles_all on public.vehicles;
create policy vehicles_all
  on public.vehicles
  for all
  to authenticated
  using (private.is_member(garage_id))
  with check (private.is_member(garage_id));

drop policy if exists garage_state_member_all on public.garage_state;
create policy garage_state_member_all
  on public.garage_state
  for all
  to authenticated
  using (private.is_member(garage_id))
  with check (private.is_member(garage_id));

revoke all on function public.ensure_garage(text) from public, anon, authenticated;
revoke all on function public.is_member(uuid) from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.path_garage(text) set search_path = pg_catalog, public;
