-- SEO & GEO Görev Takibi — SİTE bazlı model
-- Görevler artık taranan siteye (audit_sites) bağlanır; durum/not görevin kendi satırında tutulur.
-- Supabase SQL Editor'de bir kez çalıştır.

-- 1) Görevleri siteye bağla
alter table public.geo_custom_task
  add column if not exists site_id uuid references public.audit_sites(id) on delete cascade;

-- 2) Durum ve not artık görev satırında (pazar bazlı geo_task_status yerine)
alter table public.geo_custom_task
  add column if not exists status text not null default 'todo';   -- todo | doing | done
alter table public.geo_custom_task
  add column if not exists note text;

-- 3) market_id artık zorunlu değil (site bazlı görevler pazar olmadan da olur)
alter table public.geo_custom_task
  alter column market_id drop not null;

create index if not exists geo_custom_task_site_idx on public.geo_custom_task (site_id);
