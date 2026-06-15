-- Public profile read access.
alter table public.profiles
add column if not exists show_collection boolean default true,
add column if not exists show_wishlist boolean default true;

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

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
