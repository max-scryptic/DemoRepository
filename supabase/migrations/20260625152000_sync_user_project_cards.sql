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

with auth_profiles as (
  select
    id,
    lower(nullif(raw_user_meta_data ->> 'username', '')) as username,
    email,
    nullif(raw_user_meta_data ->> 'name', '') as full_name,
    nullif(raw_user_meta_data ->> 'avatar_url', '') as avatar_url
  from auth.users
),
deduped_auth_profiles as (
  select
    id,
    case
      when username is not null and count(*) over (partition by username) = 1 then username
      else null
    end as username,
    email,
    full_name,
    avatar_url
  from auth_profiles
)
insert into public.users (id, username, email, full_name, avatar_url)
select id, username, email, full_name, avatar_url
from deduped_auth_profiles
on conflict (id) do update
set
  username = coalesce(excluded.username, public.users.username),
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.users.full_name),
  avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
  updated_at = now();

alter table public.project_cards
  add column if not exists user_id uuid;

delete from public.project_cards
where user_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_cards_user_id_fkey'
      and conrelid = 'public.project_cards'::regclass
  ) then
    alter table public.project_cards
      add constraint project_cards_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end;
$$;

alter table public.project_cards
  alter column user_id set not null;

create index if not exists project_cards_user_status_position_idx
  on public.project_cards (user_id, status, position);

alter table public.project_cards enable row level security;

drop policy if exists "Allow public card reads" on public.project_cards;
drop policy if exists "Allow public card inserts" on public.project_cards;
drop policy if exists "Allow public card updates" on public.project_cards;
drop policy if exists "Allow public card deletes" on public.project_cards;
drop policy if exists "Users can read their own cards" on public.project_cards;
drop policy if exists "Users can insert their own cards" on public.project_cards;
drop policy if exists "Users can update their own cards" on public.project_cards;
drop policy if exists "Users can delete their own cards" on public.project_cards;

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

create or replace function public.seed_project_cards_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.project_cards
    where project_cards.user_id = target_user_id
  ) then
    return;
  end if;

  insert into public.project_cards (id, user_id, title, description, status, position, labels)
  values
    (
      gen_random_uuid(),
      target_user_id,
      'Plan your first project',
      'Capture the next task, assign context, then drag this card across the board as work progresses.',
      'todo',
      0,
      array['Onboarding']
    ),
    (
      gen_random_uuid(),
      target_user_id,
      'Review launch checklist',
      'Use labels, statuses, and the done column to keep important launch work visible.',
      'review',
      0,
      array['Template', 'Launch']
    );
end;
$$;

revoke all on function public.seed_project_cards_for_user(uuid) from public;
revoke all on function public.seed_project_cards_for_user(uuid) from anon;
revoke all on function public.seed_project_cards_for_user(uuid) from authenticated;

create or replace function public.handle_public_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_project_cards_for_user(new.id);
  return new;
end;
$$;

revoke all on function public.handle_public_user_created() from public;
revoke all on function public.handle_public_user_created() from anon;
revoke all on function public.handle_public_user_created() from authenticated;

drop trigger if exists on_public_user_created on public.users;
create trigger on_public_user_created
after insert on public.users
for each row execute function public.handle_public_user_created();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_username text := lower(nullif(new.raw_user_meta_data ->> 'username', ''));
begin
  insert into public.users (id, username, email, full_name, avatar_url)
  values (
    new.id,
    case
      when candidate_username is not null
        and not exists (
          select 1
          from public.users
          where users.username = candidate_username
            and users.id <> new.id
        )
        then candidate_username
      else null
    end,
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

  perform public.seed_project_cards_for_user(new.id);

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

select public.seed_project_cards_for_user(users.id)
from public.users;

revoke all on public.project_cards from anon;
grant usage on schema public to authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.project_cards to authenticated;
