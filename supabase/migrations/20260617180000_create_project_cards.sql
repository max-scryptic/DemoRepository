create table if not exists public.project_cards (
  id uuid primary key,
  title text not null check (char_length(title) <= 140),
  description text not null default '',
  status text not null check (status in ('backlog', 'todo', 'in_progress', 'review', 'done')),
  position integer not null default 0,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cards_status_position_idx
  on public.project_cards (status, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_cards_set_updated_at on public.project_cards;

create trigger project_cards_set_updated_at
before update on public.project_cards
for each row
execute function public.set_updated_at();

alter table public.project_cards enable row level security;

create policy "Allow public card reads"
  on public.project_cards
  for select
  to anon, authenticated
  using (true);

create policy "Allow public card inserts"
  on public.project_cards
  for insert
  to anon, authenticated
  with check (true);

create policy "Allow public card updates"
  on public.project_cards
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public card deletes"
  on public.project_cards
  for delete
  to anon, authenticated
  using (true);
