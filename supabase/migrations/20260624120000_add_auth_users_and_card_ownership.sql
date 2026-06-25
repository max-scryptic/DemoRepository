create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_format check (
    username is null or username ~ '^[a-z0-9._-]{2,32}$'
  )
);

create index if not exists users_username_idx
  on public.users (username);

alter table public.users enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, email, full_name, avatar_url)
  values (
    new.id,
    lower(nullif(new.raw_user_meta_data ->> 'username', '')),
    new.email,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    username = coalesce(excluded.username, public.users.username),
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();

  insert into public.project_cards (id, user_id, title, description, status, position, labels)
  values (
    gen_random_uuid(),
    new.id,
    'Plan your first project',
    'Use this starter card to capture your next task, then drag it across the board as work progresses.',
    'todo',
    0,
    array['Onboarding']
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.users (id, username, email, full_name, avatar_url)
select
  id,
  lower(nullif(raw_user_meta_data ->> 'username', '')),
  email,
  nullif(raw_user_meta_data ->> 'name', ''),
  nullif(raw_user_meta_data ->> 'avatar_url', '')
from auth.users
on conflict (id) do nothing;

alter table public.project_cards
  add column if not exists user_id uuid references public.users(id) on delete cascade;

create index if not exists project_cards_user_status_position_idx
  on public.project_cards (user_id, status, position);

insert into public.project_cards (id, user_id, title, description, status, position, labels)
select
  gen_random_uuid(),
  users.id,
  'Plan your first project',
  'Use this starter card to capture your next task, then drag it across the board as work progresses.',
  'todo',
  0,
  array['Onboarding']
from public.users
where not exists (
  select 1
  from public.project_cards
  where project_cards.user_id = users.id
);

drop policy if exists "Allow public card reads" on public.project_cards;
drop policy if exists "Allow public card inserts" on public.project_cards;
drop policy if exists "Allow public card updates" on public.project_cards;
drop policy if exists "Allow public card deletes" on public.project_cards;

create policy "Users can read their own cards"
  on public.project_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own cards"
  on public.project_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own cards"
  on public.project_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own cards"
  on public.project_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.project_cards to authenticated;
