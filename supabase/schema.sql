-- ============================================================
-- NextCode × Bosch Aftermarket — Global SEO Paneli
-- Supabase / Postgres şeması
-- Çalıştırma: Supabase Studio → SQL Editor → bu dosyayı yapıştır → Run
-- ============================================================

-- ---- Enums --------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'market_manager', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type translation_status as enum ('draft', 'translated', 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schema_type as enum ('Article', 'Product', 'FAQ');
exception when duplicate_object then null; end $$;

do $$ begin
  create type execution_type as enum ('audit', 'schema', 'redirect', 'geo', 'optimization');
exception when duplicate_object then null; end $$;

do $$ begin
  create type execution_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

-- ---- Pazarlar (markets) ------------------------------------
create table if not exists markets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- TR / ES / DE
  name        text not null,                   -- Türkiye / España / Deutschland
  locale      text not null,                   -- tr-TR / es-ES / de-DE
  is_source   boolean not null default false,  -- TR = true
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---- Profiller (auth.users 1:1) -----------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'viewer',
  market_id   uuid references markets(id) on delete set null, -- market_manager için
  created_at  timestamptz not null default now()
);

-- ---- İçerik kaynağı (TR'de yazılır) -------------------------
create table if not exists contents (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  target_keyword    text,
  slug              text,
  meta_title        text,
  meta_description  text,
  body              text,
  schema_type       schema_type not null default 'Article',
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- İçerik çevirileri (pazar bazında) ----------------------
create table if not exists content_translations (
  id                  uuid primary key default gen_random_uuid(),
  content_id          uuid not null references contents(id) on delete cascade,
  market_id           uuid not null references markets(id) on delete cascade,
  title               text,
  target_keyword      text,
  slug                text,
  meta_title          text,
  meta_description    text,
  body                text,
  status              translation_status not null default 'draft',
  -- keyword & slug otomatik çeviride lokal düzenleme gerektirir
  needs_local_review  boolean not null default true,
  translated_at       timestamptz,
  approved_by         uuid references profiles(id),
  approved_at         timestamptz,
  updated_at          timestamptz not null default now(),
  unique (content_id, market_id)
);

-- ---- Guideline (nasıl yapılır) ------------------------------
create table if not exists guidelines (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text,                 -- teknik standart / schema kuralı / başlık prensibi / GEO
  body        text,                 -- markdown
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists guideline_translations (
  id            uuid primary key default gen_random_uuid(),
  guideline_id  uuid not null references guidelines(id) on delete cascade,
  market_id     uuid not null references markets(id) on delete cascade,
  title         text,
  body          text,
  status        translation_status not null default 'draft',
  translated_at timestamptz,
  approved_by   uuid references profiles(id),
  approved_at   timestamptz,
  updated_at    timestamptz not null default now(),
  unique (guideline_id, market_id)
);

-- ---- İş takibi (execution) ----------------------------------
create table if not exists executions (
  id              uuid primary key default gen_random_uuid(),
  market_id       uuid not null references markets(id) on delete cascade,
  type            execution_type not null,
  description     text,
  urls            text,                         -- ilgili URL'ler (satır satır)
  status          execution_status not null default 'todo',
  due_date        date,
  output_file_url text,                         -- yüklenen çıktı dosyası (Supabase Storage)
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- Yardımcı: güncel kullanıcı rolü ------------------------
create or replace function current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function current_market_id()
returns uuid language sql stable security definer set search_path = public as $$
  select market_id from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table markets                enable row level security;
alter table profiles               enable row level security;
alter table contents               enable row level security;
alter table content_translations   enable row level security;
alter table guidelines             enable row level security;
alter table guideline_translations enable row level security;
alter table executions             enable row level security;

-- markets: herkes okur, sadece admin yazar
drop policy if exists markets_read on markets;
create policy markets_read on markets for select using (auth.uid() is not null);
drop policy if exists markets_write on markets;
create policy markets_write on markets for all using (is_admin()) with check (is_admin());

-- profiles: kendi profilini okur; admin hepsini okur/yazar
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists profiles_admin on profiles;
create policy profiles_admin on profiles for all using (is_admin()) with check (is_admin());

-- contents (TR kaynak): herkes okur, admin yazar
drop policy if exists contents_read on contents;
create policy contents_read on contents for select using (auth.uid() is not null);
drop policy if exists contents_write on contents;
create policy contents_write on contents for all using (is_admin()) with check (is_admin());

-- content_translations:
--   okuma: admin & viewer hepsini; market_manager kendi pazarını
--   yazma: admin hepsini; market_manager kendi pazarının çevirisini
drop policy if exists ct_read on content_translations;
create policy ct_read on content_translations for select using (
  is_admin()
  or current_role_name() = 'viewer'
  or market_id = current_market_id()
);
drop policy if exists ct_admin_write on content_translations;
create policy ct_admin_write on content_translations for all using (is_admin()) with check (is_admin());
drop policy if exists ct_mm_update on content_translations;
create policy ct_mm_update on content_translations for update using (
  current_role_name() = 'market_manager' and market_id = current_market_id()
) with check (
  current_role_name() = 'market_manager' and market_id = current_market_id()
);

-- guidelines: herkes okur, admin yazar
drop policy if exists guidelines_read on guidelines;
create policy guidelines_read on guidelines for select using (auth.uid() is not null);
drop policy if exists guidelines_write on guidelines;
create policy guidelines_write on guidelines for all using (is_admin()) with check (is_admin());

-- guideline_translations: content_translations ile aynı mantık
drop policy if exists gt_read on guideline_translations;
create policy gt_read on guideline_translations for select using (
  is_admin() or current_role_name() = 'viewer' or market_id = current_market_id()
);
drop policy if exists gt_admin_write on guideline_translations;
create policy gt_admin_write on guideline_translations for all using (is_admin()) with check (is_admin());
drop policy if exists gt_mm_update on guideline_translations;
create policy gt_mm_update on guideline_translations for update using (
  current_role_name() = 'market_manager' and market_id = current_market_id()
) with check (
  current_role_name() = 'market_manager' and market_id = current_market_id()
);

-- executions:
--   okuma: admin & viewer hepsini; market_manager kendi pazarını
--   yazma: sadece admin (NextCode'un işleri)
drop policy if exists exec_read on executions;
create policy exec_read on executions for select using (
  is_admin() or current_role_name() = 'viewer' or market_id = current_market_id()
);
drop policy if exists exec_write on executions;
create policy exec_write on executions for all using (is_admin()) with check (is_admin());

-- ---- Yeni auth.users → profile otomatik oluştur -------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
