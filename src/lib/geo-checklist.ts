// GEO / AI Görünürlük Kontrol Listesi — sabit görev seti (Bosch pazarları için)
export type Impact = "high" | "quick";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "doing" | "done";

export interface GeoTask {
  id: string;
  cat: string;
  title: string;
  desc: string;
  howTo: string;
  impact: Impact;
  priority: Priority;
  points: number;
}
export interface GeoCategory { id: string; title: string }

const PTS: Record<Priority, number> = { critical: 10, high: 8, medium: 6, low: 4 };

export const GEO_CATEGORIES: GeoCategory[] = [
  { id: "tech", title: "Teknik AI Hazırlığı" },
  { id: "schema", title: "Şema & Yapısal Veri" },
  { id: "content", title: "İçerik Yapısı & Alıntılanabilirlik" },
  { id: "strategy", title: "İçerik Stratejisi & Konu Kapsamı" },
  { id: "brand", title: "Marka Kimliği & E-E-A-T" },
  { id: "monitor", title: "AI Görünürlük İzleme" },
];

const T = (id: string, cat: string, title: string, desc: string, howTo: string, impact: Impact, priority: Priority): GeoTask =>
  ({ id, cat, title, desc, howTo, impact, priority, points: PTS[priority] });

export const GEO_TASKS: GeoTask[] = [
  // ── Teknik AI Hazırlığı ──
  T("tech-bots", "tech", "AI botlarına robots.txt'te izin verin", "GPTBot, ClaudeBot, PerplexityBot, Google-Extended ve Bingbot'un robots.txt'te engellenmediğini doğrulayın.", "robots.txt'te bu botlar için Disallow: / kuralı olmadığından emin olun; bilinçli engellemediyseniz kaldırın.", "high", "critical"),
  T("tech-index", "tech", "Önemli sayfaların indekslenebilir olduğunu sağlayın", "Kritik sayfalarda noindex olmadığını ve canonical'ların doğru olduğunu doğrulayın.", "Sayfa denetimi aracından noindex/canonical bulgularını kontrol edin; yanlış noindex'leri kaldırın.", "high", "critical"),
  T("tech-snippet", "tech", "AI snippet'larına izin verin", "nosnippet / max-snippet:0 gibi aşırı kısıtlayıcı meta etiketleri kaldırın.", "Meta robots etiketinde nosnippet/max-snippet:0 varsa gevşetin; AI motorları alıntı için snippet'a dayanır.", "high", "critical"),
  T("tech-sitemap", "tech", "XML sitemap'i tüm motorlara gönderin", "Güncel sitemap'i Search Console ve Bing Webmaster'a gönderin, robots.txt'te belirtin.", "Sitemap'i oluşturun, robots.txt'e ekleyin, GSC ve Bing'e submit edin.", "high", "high"),
  T("tech-cwv", "tech", "Core Web Vitals ve hızı optimize edin", "LCP, CLS, INP ve TTFB değerlerini iyi aralığa çekin.", "Kullanılmayan JS/CSS'i azaltın, görselleri optimize edin, render-blocking kaynakları kaldırın.", "high", "high"),
  T("tech-links", "tech", "Kırık bağlantı ve yönlendirme zincirlerini düzeltin", "4xx/5xx dönen linkleri ve çok adımlı redirect'leri temizleyin.", "Denetim aracındaki kırık link ve redirect zinciri bulgularını sırayla düzeltin.", "high", "high"),
  T("tech-ssr", "tech", "Kritik içeriğin ham HTML'de olduğunu sağlayın", "H1, ana metin ve JSON-LD'nin SSR/SSG ile ham HTML'de bulunmasını sağlayın.", "AI crawler'lar JS çalıştırmaz; kritik içeriği sunucu tarafında render edin.", "high", "critical"),
  T("tech-mobile", "tech", "Mobil uyumlu gösterimi sağlayın", "Responsive viewport ve mobil kullanılabilirliği doğrulayın.", "width=device-width viewport ekleyin, tap-target ve font boyutlarını kontrol edin.", "quick", "medium"),

  // ── Şema & Yapısal Veri ──
  T("schema-org", "schema", "Organization/LocalBusiness şeması ekleyin", "Marka varlığını netleştiren kurum şeması ekleyin.", "Ana sayfaya JSON-LD Organization şeması ekleyin (ad, logo, sameAs, iletişim).", "high", "critical"),
  T("schema-article", "schema", "İçeriklere Article/BlogPosting şeması ekleyin", "Haber ve blog sayfalarına makale şeması ekleyin.", "Her makaleye headline, author, datePublished içeren Article JSON-LD ekleyin.", "high", "high"),
  T("schema-faq", "schema", "FAQ / Soru-Cevap şeması ekleyin", "Sık sorulan sorulara FAQPage şeması ekleyin.", "İçindeki gerçek Q&A'ları FAQPage JSON-LD olarak işaretleyin; AI cevaplarında öne çıkar.", "high", "high"),
  T("schema-breadcrumb", "schema", "Breadcrumb şeması ekleyin", "Gezinme yolunu BreadcrumbList ile tanımlayın.", "Kategori/sayfa hiyerarşisini BreadcrumbList JSON-LD ile işaretleyin.", "quick", "medium"),
  T("schema-product", "schema", "Ürün şeması ekleyin (uygunsa)", "Ürün sayfalarına Product/Offer şeması ekleyin.", "Ürün sayfalarına ad, fiyat, stok, puan içeren Product JSON-LD ekleyin.", "quick", "medium"),
  T("schema-validate", "schema", "Tüm yapısal veriyi doğrulayın", "Schema.org / Rich Results test ile hataları giderin.", "Rich Results Test ve Schema Validator'da hata/uyarıları temizleyin.", "high", "high"),

  // ── İçerik Yapısı & Alıntılanabilirlik ──
  T("content-answer", "content", "Doğrudan cevap özetiyle başlayın", "Sayfanın başına sorunun net, öz cevabını koyun.", "İlk paragrafta ana soruyu 2-3 cümlede yanıtlayın; AI bunu alıntılar.", "high", "critical"),
  T("content-hierarchy", "content", "Net H1–H3 hiyerarşisi kurun", "İçeriği mantıklı başlık yapısıyla bölün.", "Tek H1, ardından H2/H3 ile bölümleyin; her bölüm bir alt konu.", "high", "high"),
  T("content-stats", "content", "Alıntılanabilir istatistik ve veri ekleyin", "Somut sayı, oran ve veri noktaları ekleyin.", "İddiaları kaynaklı sayılarla destekleyin; AI olgu içeren cümleleri tercih eder.", "high", "high"),
  T("content-faq", "content", "İçerik içine SSS bölümleri ekleyin", "Gerçek kullanıcı sorularına yanıt veren SSS ekleyin.", "Sayfa altına 4-6 sık soru + kısa yanıt ekleyin (FAQPage şemasıyla).", "high", "high"),
  T("content-takeaway", "content", "Temel çıkarımlar bölümü ekleyin", "Sayfanın özetini madde madde verin.", "Başa veya sona 'Öne çıkanlar' listesi ekleyin; chunk kalitesini artırır.", "high", "high"),
  T("content-tables", "content", "Tablo, liste ve karşılaştırmalar kullanın", "Bilgiyi yapılandırılmış biçimde sunun.", "Karşılaştırmaları tablo, adımları numaralı liste yapın; AI çıkarımı kolaylaşır.", "quick", "medium"),
  T("content-fresh", "content", "İçerik güncellik sinyali verin", "Son güncelleme tarihini görünür ve şemada tutun.", "Görünür 'güncellendi' tarihi + dateModified şeması ekleyin.", "quick", "medium"),

  // ── İçerik Stratejisi & Konu Kapsamı ──
  T("strategy-audit", "strategy", "Hedef kelimeler için AI görünürlüğünü denetleyin", "Önemli sorgularda AI cevaplarında görünüp görünmediğinizi ölçün.", "Ana sorguları ChatGPT/Perplexity'de test edin; markanız geçiyor mu bakın.", "high", "critical"),
  T("strategy-gap", "strategy", "Rakiplere karşı içerik boşluklarını çıkarın", "AI'ın alıntıladığı rakip konularını haritalayın.", "Rakiplerin alıntılandığı sorguları listeleyin; eksik konuları planlayın.", "high", "critical"),
  T("strategy-cluster", "strategy", "Pillar/küme içerik mimarisi kurun", "Ana konu + destekleyici alt içerik yapısı oluşturun.", "Her ana konu için bir pillar sayfa + iç bağlantılı alt içerikler oluşturun.", "high", "high"),
  T("strategy-guide", "strategy", "Kapsamlı rehber içerikler üretin", "Temel konuları derinlemesine ele alan içerikler yazın.", "Ana konuları 1500+ kelime, kapsamlı ve özgün biçimde işleyin.", "high", "high"),
  T("strategy-longtail", "strategy", "Konuşma dili / uzun kuyruk sorgulara optimize edin", "Doğal dilde sorulan soruları hedefleyin.", "Başlık ve alt başlıklarda gerçek soru cümlelerini kullanın.", "high", "high"),
  T("strategy-research", "strategy", "Özgün araştırma/veri geliştirin", "Alıntılanacak özgün veri üretin.", "Anket, test veya kendi verinizle özgün istatistikler yayınlayın.", "high", "high"),

  // ── Marka Kimliği & E-E-A-T ──
  T("brand-nap", "brand", "Marka bilgisi tutarlılığını denetleyin", "Ad, adres, iletişim tüm platformlarda tutarlı olsun.", "Tüm dizinlerde ve profillerde marka bilgisini eşitleyin.", "high", "critical"),
  T("brand-author", "brand", "Kapsamlı yazar sayfaları oluşturun", "İçerik yazarlarının uzmanlığını gösterin.", "Yazar biyografisi, uzmanlık ve sosyal profilleri olan sayfalar ekleyin.", "high", "high"),
  T("brand-about", "brand", "Kapsamlı 'Hakkımızda' sayfası oluşturun", "Kurum kimliğini ve güven sinyallerini netleştirin.", "Hakkımızda sayfasına tarihçe, ekip, sertifika ve iletişim ekleyin.", "high", "high"),
  T("brand-entity", "brand", "Varlık (entity) sinyallerini güçlendirin", "Wikidata/kurum sayfaları ile marka varlığını netleştirin.", "sameAs ile resmi profilleri bağlayın; mümkünse Wikidata girişi oluşturun.", "high", "high"),
  T("brand-linkedin", "brand", "Kilit personel LinkedIn profillerini güncelleyin", "Ekip otoritesini görünür kılın.", "Yöneticilerin LinkedIn profillerini güncel ve kurumla bağlantılı tutun.", "quick", "medium"),
  T("brand-directory", "brand", "Sektör dizin listelerini talep edin", "Otoriteli dizinlerde tutarlı biçimde yer alın.", "İlgili sektör dizinlerine kayıt olun ve bilgileri güncel tutun.", "quick", "medium"),

  // ── AI Görünürlük İzleme ──
  T("monitor-track", "monitor", "AI atıf takibini kurun", "AI cevaplarında markanızın geçtiğini düzenli izleyin.", "Belirli sorgular için ChatGPT/Perplexity/AI Overviews'da aylık kontrol yapın.", "high", "critical"),
  T("monitor-comp", "monitor", "Rakip AI atıflarını izleyin", "Rakiplerin AI'da ne kadar öne çıktığını takip edin.", "Aynı sorgularda rakiplerin atıf payını kaydedin.", "high", "high"),
  T("monitor-referral", "monitor", "AI yönlendirme trafiğini izleyin", "ChatGPT/Perplexity'den gelen trafiği ölçün.", "Analytics'te AI kaynaklı yönlendirmeleri segmentleyin.", "high", "high"),
  T("monitor-gsc", "monitor", "Search Console'da AI Overviews izleyin", "AI Overviews görünürlüğünü GSC'den takip edin.", "GSC performans raporunda ilgili sorguları düzenli inceleyin.", "high", "high"),
  T("monitor-dashboard", "monitor", "AI arama performans paneli oluşturun", "Tüm AI görünürlük metriklerini tek panelde toplayın.", "Atıf, trafik ve sıralama metriklerini aylık bir panelde birleştirin.", "quick", "medium"),
];

export const GEO_TOTAL_POINTS = GEO_TASKS.reduce((a, t) => a + t.points, 0);
