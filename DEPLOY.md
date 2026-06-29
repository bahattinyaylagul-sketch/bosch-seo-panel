# Deploy — Vercel + Supabase

Tahmini süre: ~15 dk. Üç hesap gerekir: GitHub, Supabase, Vercel + bir Anthropic API anahtarı.
**Gizli anahtarları kimseyle (sohbet dahil) paylaşma — sadece Supabase ve Vercel panellerine gir.**

## 1. Supabase projesi
1. [supabase.com](https://supabase.com) → **New project**. Bölge: Europe (Frankfurt) önerilir.
2. Proje açılınca **SQL Editor → New query** ve sırayla çalıştır:
   - `supabase/schema.sql`  (tablolar + RLS + trigger)
   - `supabase/seed.sql`    (pazarlar TR/ES/DE + örnek veri)
   - `supabase/storage.sql` (çıktı dosyası bucket'ı)
3. **Project Settings → API** sayfasından şunları not al:
   - `Project URL`  → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public`  → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (gizli)

### Kullanıcılar ve roller
4. **Authentication → Users → Add user** (Auto Confirm açık) ile kullanıcılar oluştur:
   - admin (NextCode), her pazar için bir market_manager, GM için viewer.
5. **SQL Editor**'da rolleri ata:
   ```sql
   update profiles set role='admin' where email='admin@nextcodecollective.com';
   update profiles set role='market_manager',
     market_id=(select id from markets where code='ES')
     where email='es-manager@example.com';
   update profiles set role='market_manager',
     market_id=(select id from markets where code='DE')
     where email='de-manager@example.com';
   update profiles set role='viewer' where email='gm@example.com';
   ```
   (Yeni kayıt olan herkes trigger ile otomatik `viewer` olur; yukarıdakiyle yükseltirsin.)

## 2. GitHub
Kodu bir repoya koy (Vercel buradan deploy eder):
```bash
cd bosch-seo-panel
git init && git add . && git commit -m "Global SEO Paneli"
git branch -M main
git remote add origin https://github.com/<kullanıcı>/bosch-seo-panel.git
git push -u origin main
```

## 3. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → GitHub reposunu **Import** et.
2. Framework otomatik **Next.js** algılanır. Build/Output ayarına dokunma.
3. **Environment Variables** bölümüne ekle:

   | Key | Değer |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `ANTHROPIC_API_KEY` | Anthropic anahtarın |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |

4. **Deploy**. Bitince `https://<proje>.vercel.app` canlı URL'in.

## 4. Supabase'i canlı URL'e bağla
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://<proje>.vercel.app`
- **Redirect URLs**: aynı adresi ekle.

## 5. Doğrulama
- Canlı URL → `/login` → admin ile gir → İçerik kütüphanesi → bir içerik aç → **Çevir** → çeviri gelir, keyword/slug kırmızı uyarılı.
- market_manager ile gir → sadece kendi pazarını görür, onaylayabilir.
- viewer ile gir → sadece Global dashboard.

## Notlar
- `service_role` anahtarı yalnızca sunucuda kullanılır; tarayıcıya asla sızmaz.
- Çeviri Anthropic API'yi sunucu tarafında çağırır; anahtar Vercel env'de güvende.
- Yeni pazar eklemek: `markets` tablosuna satır ekle + ilgili market_manager ata. Panel otomatik yansıtır.
