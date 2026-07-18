-- GEO Checklist: pazar (ülke) bazlı görev durumu takibi
-- Supabase SQL Editor'de bir kez çalıştır.

create table if not exists public.geo_task_status (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  market_id uuid references public.markets(id) on delete cascade,
  status text not null default 'todo',   -- todo | doing | done
  note text,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (task_id, market_id)
);

create index if not exists geo_task_status_market_idx on public.geo_task_status (market_id);

alter table public.geo_task_status enable row level security;

drop policy if exists "geo_task_status_select" on public.geo_task_status;
create policy "geo_task_status_select" on public.geo_task_status for select using (auth.role() = 'authenticated');
drop policy if exists "geo_task_status_insert" on public.geo_task_status;
create policy "geo_task_status_insert" on public.geo_task_status for insert with check (auth.role() = 'authenticated');
drop policy if exists "geo_task_status_update" on public.geo_task_status;
create policy "geo_task_status_update" on public.geo_task_status for update using (auth.role() = 'authenticated');
