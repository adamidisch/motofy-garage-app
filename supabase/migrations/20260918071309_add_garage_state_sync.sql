create table if not exists public.garage_state (
  garage_id uuid primary key references public.garages(id) on delete cascade,
  schema_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.garage_state enable row level security;

drop policy if exists "garage_state_member_all" on public.garage_state;
create policy "garage_state_member_all"
  on public.garage_state
  for all
  to authenticated
  using (is_member(garage_id))
  with check (is_member(garage_id));

create index if not exists garage_state_updated_at
  on public.garage_state (updated_at desc);
