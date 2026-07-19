-- Denetim sorun durumları: her site + sorun(etiket) için Aktif / Takip Edilen / Kapatıldı
-- Task Tracker'da bir görev kapatılınca ilgili denetim sorunu da "closed" olur.
-- Supabase SQL Editor'de bir kez çalıştır.

create table if not exists public.audit_issue_status (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.audit_sites(id) on delete cascade,
  issue_key text not null,                 -- kontrol etiketi (örn. "URL hijyeni (site geneli)")
  status text not null default 'open',     -- open | tracked | closed
  updated_at timestamptz not null default now(),
  unique (site_id, issue_key)
);

create index if not exists audit_issue_status_site_idx on public.audit_issue_status (site_id);

alter table public.audit_issue_status enable row level security;

drop policy if exists "audit_issue_status_select" on public.audit_issue_status;
create policy "audit_issue_status_select" on public.audit_issue_status for select using (auth.role() = 'authenticated');
drop policy if exists "audit_issue_status_insert" on public.audit_issue_status;
create policy "audit_issue_status_insert" on public.audit_issue_status for insert with check (auth.role() = 'authenticated');
drop policy if exists "audit_issue_status_update" on public.audit_issue_status;
create policy "audit_issue_status_update" on public.audit_issue_status for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
