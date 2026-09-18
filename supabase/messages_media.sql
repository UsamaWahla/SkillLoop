-- Run AFTER messages.sql and messages_chat_features.sql
-- Adds media/voice message columns + chat-media storage bucket

-- ---------------------------------------------------------------------------
-- Message media columns
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check check (
    message_type in ('text', 'image', 'video', 'document', 'audio')
  );

alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists media_name text;
alter table public.messages add column if not exists media_mime text;
alter table public.messages add column if not exists media_duration_sec integer;

alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  deleted_for_everyone_at is not null
  or media_url is not null
  or char_length(trim(content)) > 0
);

-- ---------------------------------------------------------------------------
-- Storage bucket for chat attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = excluded.public;

-- Match participants can read files under their match folder: {match_id}/...
drop policy if exists "Chat media read" on storage.objects;
create policy "Chat media read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Chat media upload" on storage.objects;
create policy "Chat media upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and (m.user_id_1 = auth.uid() or m.user_id_2 = auth.uid())
    )
  );

drop policy if exists "Chat media delete own" on storage.objects;
create policy "Chat media delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

notify pgrst, 'reload schema';
