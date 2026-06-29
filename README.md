# Global SEO Paneli — NextCode × Bosch Aftermarket

Çok dilli içerik hazırlama, otomatik çeviri, lokal onay ve koordinasyon merkezi.
**CMS değildir** — yayın Bosch'un kendi sisteminde kalır. Bu panel sadece hazırlık
ve koordinasyon yapar.

## Ne yapar

NextCode TR'de içerik ve SEO işlerini hazırlar → panel her pazara kendi dilinde
dağıtır → lokal yönetici onaylar → GM tüm pazarların ilerlemesini tek ekrandan görür.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** (Postgres) — auth + DB + RLS
- **Anthropic API** (claude-sonnet) — otomatik çeviri motoru

## Roller

| Rol | Kim | Yetki |
| --- | --- | --- |
| `admin` | NextCode | Her şeyi yazar/yükler/yönetir, çeviri başlatır |
| `market_manager` | Lokal yönetici (ES/DE…) | Kendi dilini görür, çeviriyi düzenler/onaylar |
| `viewer` | GM | Hiçbir şey düzenleyemez, sadece global dashboard |

## Modüller (sidebar)

1. **İçerik kütüphanesi** — TR kaynak içerik + pazar bazında çeviri/onay *(tam aktif)*
2. **Guideline** — teknik standart / schema / GEO dokümanları + çeviri akışı *(tam aktif)*
3. **İş takibi** — NextCode'un pazar bazlı işleri, ekle/düzenle + çıktı dosyası upload *(tam aktif)*
4. **Roadmap** — işlerin tarih/sıra görünümü *(tam aktif)*
5. **Global dashboard** — pazar × iş tipi matrisi + % ilerleme *(tam aktif, sadece GM/admin)*

> Bu sürüm: 5 modül de tam aktif (auth + çeviri akışı + dosya upload + dashboard).
> Canlıya almak için `DEPLOY.md` (Vercel + Supabase).

## Görsel kimlik — Bosch renkleri

`tailwind.config.ts` içindeki palet, boschaftermarket.com'un **dijital** marka
sistemiyle birebir: Bosch kırmızı `#ED0007` (hover `#B8000A`), Bosch mavi `#007BC0`,
supergraphic şerit `#18837E → #00884A → #007BC0 → #ED0007 → #9E2896`, antrasit metin
`#000`/`#525252`, açık gri yüzeyler `#F5F5F5`/`#ECECEC`, ~2px köşe, Inter font.
(Not: bazı kaynaklarda geçen `#E20015`/Pantone 485 Bosch'un 2016 *baskı* kılavuzundaki
kırmızısıdır; web sitesi dijital `#ED0007` kullanır — bu yüzden panelde o kullanıldı.)
Asset/CSS kopyalanmadı; "Bosch" wordmark metin olarak yazıldı (telif).

## Kurulum

### 1. Bağımlılıklar
```bash
npm install
```

### 2. Supabase
1. [supabase.com](https://supabase.com) → yeni proje.
2. **SQL Editor** → `supabase/schema.sql` içeriğini yapıştır → Run.
3. Ardından `supabase/seed.sql` → Run (pazarlar + örnek veri), sonra `supabase/storage.sql` (dosya upload bucket'ı).
4. **Authentication → Users** → kullanıcılar oluştur (admin / market_manager / viewer).
5. Rolleri ata (SQL Editor):
   ```sql
   update profiles set role='admin' where email='admin@nextcodecollective.com';
   update profiles set role='market_manager',
     market_id=(select id from markets where code='ES')
     where email='es-manager@example.com';
   update profiles set role='viewer' where email='gm@example.com';
   ```

### 3. Ortam değişkenleri
`.env.example` → `.env.local` olarak kopyala ve doldur:
```bash
cp .env.example .env.local
```
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase Project Settings → API
- `ANTHROPIC_API_KEY` → çeviri için
- `ANTHROPIC_MODEL` → `claude-sonnet-4-6`

### 4. Çalıştır
```bash
npm run dev
# http://localhost:3000
```

## Çeviri akışı

```
admin TR içerik yazar
   └─ "Çevir" (içerik detayında, pazar paneli)
        └─ Anthropic API ilgili dile çevirir → statü: çevrildi
             └─ keyword & slug "lokal düzenleme gerekir" notuyla işaretlenir
                  └─ market_manager düzenler + "Onayla" → statü: onaylandı
                       └─ Global dashboard'a % ilerleme olarak yansır
```

## Klasör yapısı

```
src/
  app/
    layout.tsx              # kök layout (Inter font, Bosch base)
    page.tsx                # /dashboard'a yönlendirir
    login/page.tsx          # Supabase auth
    (panel)/
      layout.tsx            # supergraphic + header + sidebar shell
      content/              # İçerik kütüphanesi (liste, detay, çeviri)
      guidelines/           # Guideline (liste)
      execution/            # İş takibi (liste)
      roadmap/              # Roadmap (timeline)
      dashboard/            # Global dashboard (matris)
  components/               # Sidebar, Header, ui (badge/card)
  lib/
    supabase/               # client / server / middleware
    auth.ts                 # profil + rol
    translate.ts            # Anthropic çeviri motoru
    types.ts                # ortak tipler + TR etiketler
  middleware.ts             # oturum + route koruması
supabase/
  schema.sql                # tablolar + RLS + trigger
  seed.sql                  # pazarlar + örnek veri
```

## Güvenlik / RLS

Tüm tablolarda Row Level Security açık. `market_manager` yalnızca kendi
`market_id`'sinin çevirilerini görebilir/düzenleyebilir; `viewer` salt-okunur;
`admin` tam yetkili. Politikalar `supabase/schema.sql` içinde.

---
© Bosch Sanayi ve Ticaret A.Ş · NextCode Collective tarafından hazırlanmıştır.
