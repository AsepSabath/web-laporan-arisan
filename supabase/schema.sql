-- Jalankan di Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  winner_name text default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists periods_single_active_idx
  on periods (is_active)
  where is_active = true;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  status text not null default 'unpaid' check (status in ('paid', 'unpaid')),
  amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (participant_id, period_id)
);

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on payments;
create trigger trg_set_updated_at
before update on payments
for each row
execute procedure set_updated_at();

create or replace function is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles
    where user_id = uid
      and role = 'admin'
  );
$$;

alter table periods enable row level security;
alter table participants enable row level security;
alter table payments enable row level security;
alter table user_roles enable row level security;

-- Public read for dashboard
drop policy if exists periods_public_select on periods;
create policy periods_public_select
  on periods for select
  using (true);

drop policy if exists participants_public_select on participants;
create policy participants_public_select
  on participants for select
  using (true);

drop policy if exists payments_public_select on payments;
create policy payments_public_select
  on payments for select
  using (true);

-- Admin mutations
drop policy if exists periods_admin_mutation on periods;
create policy periods_admin_mutation
  on periods for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists participants_admin_mutation on participants;
create policy participants_admin_mutation
  on participants for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists payments_admin_mutation on payments;
create policy payments_admin_mutation
  on payments for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists user_roles_self_select on user_roles;
create policy user_roles_self_select
  on user_roles for select
  using (auth.uid() = user_id);

-- Seed minimal period
insert into periods (label, winner_name, is_active)
select 'Periode April 2026', 'Belum ditentukan', true
where not exists (select 1 from periods where is_active = true);
