alter table public.project_cards
  add column if not exists user_id uuid;

do $$
begin
  if to_regclass('public.users') is not null and not exists (
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

create index if not exists project_cards_user_status_position_idx
  on public.project_cards (user_id, status, position);
