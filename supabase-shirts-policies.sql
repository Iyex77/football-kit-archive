-- Owner-scoped RLS for public.shirts and storage policies for the "shirts"
-- bucket. supabase-public-profiles-policies.sql already adds a SELECT policy
-- for *public* visitors reading shirts owned by public profiles, but the base
-- owner CRUD policies (a user managing their own shirts) were never
-- committed to this repo — this file is the first version-controlled record
-- of them. Safe to re-run: policies are dropped and recreated idempotently.
--
-- Run this in the Supabase SQL editor (or via the CLI) after checking there
-- are no orphaned rows:
--   select count(*) from public.shirts where user_id is null;

alter table public.shirts enable row level security;

drop policy if exists "Users can read their own shirts" on public.shirts;
create policy "Users can read their own shirts"
on public.shirts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own shirts" on public.shirts;
create policy "Users can create their own shirts"
on public.shirts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own shirts" on public.shirts;
create policy "Users can update their own shirts"
on public.shirts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own shirts" on public.shirts;
create policy "Users can delete their own shirts"
on public.shirts
for delete
to authenticated
using (auth.uid() = user_id);

-- Shirt image storage.
-- Public bucket keeps delivery free through Supabase public URLs (shirt
-- images are shown on public profile pages). Uploads are namespaced by
-- `<user_id>/<file>`, matching the code in app/api/import-image/route.ts and
-- app/components/ShirtForm.tsx, and mirroring the avatars bucket policies.
--
-- COMPATIBILITY WARNING: images uploaded before this change used flat
-- filenames with no `<user_id>/` folder prefix. The update/delete policies
-- below key off (storage.foldername(name))[1] = auth.uid(), so those older
-- objects will NOT match and will become undeletable/unupdatable through the
-- app (RLS will reject it) until they are moved into a `<user_id>/` folder or
-- re-uploaded. Check how many pre-existing objects lack a folder prefix
-- before relying on in-app delete for old images:
--   select name from storage.objects
--   where bucket_id = 'shirts' and array_length(storage.foldername(name), 1) is null;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shirts',
  'shirts',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Shirt images are publicly readable" on storage.objects;
create policy "Shirt images are publicly readable"
on storage.objects
for select
using (bucket_id = 'shirts');

drop policy if exists "Users can upload their own shirt images" on storage.objects;
create policy "Users can upload their own shirt images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shirts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own shirt images" on storage.objects;
create policy "Users can update their own shirt images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shirts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'shirts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own shirt images" on storage.objects;
create policy "Users can delete their own shirt images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shirts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
