-- ═══════════════════════════════════════════════════════════════════════════
-- Site Takibi: kalıcı site listesi + tarama geçmişi + değişim analizi
-- Supabase SQL Editor'de bir kez çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.audit_sites (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  name text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_scans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.audit_sites(id) on delete cascade,
  health int,
  errors int,
  warnings int,
  passes int,
  issues jsonb not null default '[]'::jsonb,   -- [{key,label,status,urlCount}]
  created_at timestamptz not null default now()
);

create index if not exists audit_scans_site_created_idx
  on public.audit_scans (site_id, created_at desc);

alter table public.audit_sites enable row level security;
alter table public.audit_scans enable row level security;

-- Giriş yapmış tüm kullanıcılar okuyabilir/ekleyebilir (iç araç)
drop policy if exists "audit_sites_select" on public.audit_sites;
create policy "audit_sites_select" on public.audit_sites for select using (auth.role() = 'authenticated');
drop policy if exists "audit_sites_insert" on public.audit_sites;
create policy "audit_sites_insert" on public.audit_sites for insert with check (auth.role() = 'authenticated');
drop policy if exists "audit_sites_delete" on public.audit_sites;
create policy "audit_sites_delete" on public.audit_sites for delete using (auth.role() = 'authenticated');

drop policy if exists "audit_scans_select" on public.audit_scans;
create policy "audit_scans_select" on public.audit_scans for select using (auth.role() = 'authenticated');
drop policy if exists "audit_scans_insert" on public.audit_scans;
create policy "audit_scans_insert" on public.audit_scans for insert with check (auth.role() = 'authenticated');
