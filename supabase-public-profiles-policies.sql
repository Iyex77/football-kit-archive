-- Public profile read access.
alter table public.profiles
add column if not exists show_collection boolean default true,
add column if not exists show_wishlist boolean default true,
add column if not exists avatar_url text,
add column if not exists public_bio text;

-- Public showcase curation.
alter table public.shirts
add column if not exists is_featured boolean not null default false,
add column if not exists featured_order integer;

create index if not exists shirts_public_featured_order_idx
on public.shirts (user_id, is_featured, featured_order);

-- Visitors can only see profiles explicitly marked as public.
create policy "Public profiles are readable"
on public.profiles
for select
using (is_public = true);

-- Public shirt read access.
-- Visitors can only see shirts whose owner has a public profile.
create policy "Public profile shirts are readable"
on public.shirts
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = shirts.user_id
      and profiles.is_public = true
      and (
        (shirts.status = 'collection' and profiles.show_collection = true)
        or
        (shirts.status = 'wishlist' and profiles.show_wishlist = true)
      )
  )
);

-- Private profile management helpers, if they do not already exist.
-- Keep or adapt these to your current policies.
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Avatar storage.
-- Public bucket keeps delivery free through Supabase public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Avatar images are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
