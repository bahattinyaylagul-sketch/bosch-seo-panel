-- ============================================================
-- Seed verisi — pazarlar + örnek içerik
-- schema.sql çalıştırıldıktan SONRA çalıştır.
-- ============================================================

-- Pazarlar
insert into markets (code, name, locale, is_source, sort_order) values
  ('TR', 'Türkiye',       'tr-TR', true,  0),
  ('ES', 'España',        'es-ES', false, 1),
  ('DE', 'Deutschland',   'de-DE', false, 2),
  ('EN', 'United Kingdom','en-GB', false, 3),
  ('FR', 'France',        'fr-FR', false, 4)
on conflict (code) do nothing;

-- Örnek içerik (TR kaynak)
insert into contents (title, target_keyword, slug, meta_title, meta_description, body, schema_type)
values
  (
    'Fren balatası değişimi rehberi',
    'fren balatası değişimi',
    'fren-balatasi-degisimi',
    'Fren Balatası Değişimi | Bosch Aftermarket',
    'Bosch fren balatalarının ne zaman ve nasıl değiştirileceğine dair teknik rehber.',
    '## Fren balatası ne zaman değişir?\n\nBalata kalınlığı 3 mm altına düştüğünde değişim önerilir...',
    'Article'
  ),
  (
    'Bosch silecek seçim tablosu',
    'silecek seçimi',
    'silecek-secimi',
    'Araca Göre Silecek Seçimi | Bosch',
    'Aracınıza uygun Bosch silecek modelini bulun.',
    '## Doğru silecek nasıl seçilir?\n\nAraç marka/model ve cam ölçüsüne göre...',
    'Product'
  )
on conflict do nothing;

-- Çeviri kayıtlarını oluştur: her TR içeriği için ES & DE boş taslak satırı
insert into content_translations (content_id, market_id, status, needs_local_review)
select c.id, m.id, 'draft', true
from contents c
cross join markets m
where m.is_source = false
on conflict (content_id, market_id) do nothing;

-- Örnek guideline
insert into guidelines (title, category, body) values
  ('Schema.org Article kuralları', 'schema kuralı',
   '# Article schema\n\nHer makale `Article` schema''sı içermeli: headline, author, datePublished...'),
  ('GEO (Generative Engine Optimization) metodu', 'GEO',
   '# GEO yaklaşımı\n\nİçerik LLM''ler tarafından alıntılanabilir olmalı: net tanımlar, listeler, kaynak...')
on conflict do nothing;

insert into guideline_translations (guideline_id, market_id, status)
select g.id, m.id, 'draft'
from guidelines g
cross join markets m
where m.is_source = false
on conflict (guideline_id, market_id) do nothing;

-- Örnek iş takibi (execution)
insert into executions (market_id, type, description, urls, status, due_date)
select m.id, v.type::execution_type, v.description, v.urls, v.status::execution_status, v.due_date::date
from markets m
cross join (values
  ('audit',        'Teknik SEO audit',        'https://example.com/tr', 'done',        '2026-05-01'),
  ('schema',       'Ürün schema entegrasyonu','https://example.com/tr/p', 'in_progress','2026-07-15'),
  ('redirect',     '301 redirect haritası',    '',                      'todo',        '2026-08-01')
) as v(type, description, urls, status, due_date)
where m.code = 'TR'
on conflict do nothing;

-- NOT: kullanıcı rolleri auth.users üzerinden atanır.
-- Supabase Auth'tan kullanıcı oluşturduktan sonra:
--   update profiles set role='admin' where email='admin@nextcode...';
--   update profiles set role='market_manager', market_id=(select id from markets where code='ES')
--     where email='es-manager@...';
--   update profiles set role='viewer' where email='gm@...';
