-- Run this entire script in Supabase Dashboard → SQL → New query → Run
-- Requires: public.matches (user_id_1, user_id_2), public.profiles

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_match_id_created_at_idx
  on public.messages (match_id, created_at asc);

-- API access (required for the mobile app)
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;

-- ---------------------------------------------------------------------------
-- Realtime (skip if already added — safe to re-run)
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then
    null;
  when others then
    raise notice 'Realtime publication: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists "Match participants can read messages" on public.messages;
create policy "Match participants can read messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Match participants can send messages" on public.messages;
create policy "Match participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

-- Refresh PostgREST schema cache so the app sees the new table immediately
notify pgrst, 'reload schema';
