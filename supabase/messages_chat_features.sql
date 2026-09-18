-- Run AFTER supabase/messages.sql (Supabase SQL Editor)
-- Adds: read/delivery receipts, reactions, reply, edit, delete-for-me / delete-for-all

-- ---------------------------------------------------------------------------
-- Extend messages
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

alter table public.messages
  add column if not exists edited_at timestamptz;

alter table public.messages
  add column if not exists deleted_for_everyone_at timestamptz;

alter table public.messages drop constraint if exists messages_content_check;

alter table public.messages
  add constraint messages_content_check check (
    deleted_for_everyone_at is not null
    or char_length(trim(content)) > 0
  );

-- ---------------------------------------------------------------------------
-- Receipts (delivery / read ticks for the recipient)
-- ---------------------------------------------------------------------------
create table if not exists public.message_receipts (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create index if not exists message_receipts_user_id_idx on public.message_receipts (user_id);

-- ---------------------------------------------------------------------------
-- Delete for me
-- ---------------------------------------------------------------------------
create table if not exists public.message_hidden (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Emoji reactions
-- ---------------------------------------------------------------------------
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Auto-create receipt row for the other match participant
create or replace function public.handle_new_message_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  select case
    when m.user_id_1 = new.sender_id then m.user_id_2
    else m.user_id_1
  end
  into recipient
  from public.matches m
  where m.id = new.match_id;

  if recipient is not null then
    insert into public.message_receipts (message_id, user_id)
    values (new.id, recipient)
    on conflict (message_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_created_receipt on public.messages;
create trigger on_message_created_receipt
  after insert on public.messages
  for each row
  execute function public.handle_new_message_receipt();

-- Backfill receipts for existing messages (safe to re-run)
insert into public.message_receipts (message_id, user_id)
select
  msg.id,
  case when m.user_id_1 = msg.sender_id then m.user_id_2 else m.user_id_1 end
from public.messages msg
join public.matches m on m.id = msg.match_id
on conflict (message_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.message_receipts to authenticated;
grant select, insert, delete on public.message_hidden to authenticated;
grant select, insert, update, delete on public.message_reactions to authenticated;
grant update on public.messages to authenticated;

grant all on public.message_receipts to service_role;
grant all on public.message_hidden to service_role;
grant all on public.message_reactions to service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.message_receipts;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: message_receipts
-- ---------------------------------------------------------------------------
alter table public.message_receipts enable row level security;

drop policy if exists "Participants read receipts" on public.message_receipts;
create policy "Participants read receipts"
  on public.message_receipts for select to authenticated
  using (
    exists (
      select 1 from public.messages msg
      join public.matches m on m.id = msg.match_id
      where msg.id = message_receipts.message_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Recipient updates own receipt" on public.message_receipts;
create policy "Recipient updates own receipt"
  on public.message_receipts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: message_hidden
-- ---------------------------------------------------------------------------
alter table public.message_hidden enable row level security;

drop policy if exists "Users manage own hidden messages" on public.message_hidden;
create policy "Users manage own hidden messages"
  on public.message_hidden for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: message_reactions
-- ---------------------------------------------------------------------------
alter table public.message_reactions enable row level security;

drop policy if exists "Participants read reactions" on public.message_reactions;
create policy "Participants read reactions"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages msg
      join public.matches m on m.id = msg.match_id
      where msg.id = message_reactions.message_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Participants insert reactions" on public.message_reactions;
create policy "Participants insert reactions"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages msg
      join public.matches m on m.id = msg.match_id
      where msg.id = message_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Users update own reactions" on public.message_reactions;
create policy "Users update own reactions"
  on public.message_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own reactions" on public.message_reactions;
create policy "Users delete own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: messages update (edit / delete for everyone)
-- ---------------------------------------------------------------------------
drop policy if exists "Sender can update own messages" on public.messages;
create policy "Sender can update own messages"
  on public.messages for update to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  )
  with check (sender_id = auth.uid());

notify pgrst, 'reload schema';
