# 2M Otomasyon — Stok Takip Sistemi

İnternet üzerinden 10+ PC'nin aynı anda kullanabileceği, bulut tabanlı stok takip sistemi.
Ekip nerede olursa olsun bir tarayıcı üzerinden (Chrome/Edge) aynı adrese girip **aynı anlık veriyi** görür — ekstra kurulum gerektirmez, "PC programı" gibi masaüstüne kısayol olarak da eklenebilir (aşağıya bakın).

---

## 1) Bu Sistem Nasıl Çalışıyor?

- **Backend:** Node.js + Express + SQLite (tek dosya veritabanı, `better-sqlite3`)
- **Frontend:** Tek sayfa web uygulaması (login, panel/dashboard, stok listesi, stok hareketi, geçmiş, kullanıcı yönetimi)
- **Senkronizasyon:** Tüm PC'ler aynı sunucuya (tek bir internet adresine) bağlanır. Veri tek merkezde tutulur, herkes anlık günceli görür — dosya gönderip almaya gerek kalmaz.
- **Kullanıcılar:** Şifreli giriş (JWT), roller: Yönetici / Kullanıcı
- **Önemli not:** Bu ortamda (Claude'un sohbet içi çalışma alanı) size kalıcı, internetten erişilebilen bir sunucu **barındıramıyorum** — kod tarafımda çalışır durumda ve test edildi, ama dışarıdan erişim için sizin (veya BT ekibinizin) aşağıdaki seçeneklerden birine **deploy etmeniz** gerekiyor. Bu genelde 10-15 dakika süren, tek seferlik bir işlemdir.

---

## 2) Nereye Deploy Edilir? (Önerilen Sıra)

### Seçenek A — Railway.app (en kolay, önerilen)
1. [railway.app](https://railway.app) üzerinde ücretsiz/düşük maliyetli hesap açın.
2. Bu klasörü bir GitHub reposuna yükleyin (private repo olabilir).
3. Railway'de "New Project" → "Deploy from GitHub repo" seçin, bu repoyu gösterin.
4. Railway otomatik olarak `Dockerfile`'ı algılayıp build eder.
5. **Volume ekleyin:** Railway panelinde servise bir "Volume" bağlayın, mount path olarak `/app/data` yazın (veritabanının silinmemesi için şart).
6. Environment Variables kısmına `JWT_SECRET` adında güçlü, rastgele bir metin girin.
7. Deploy tamamlanınca Railway size `https://xxxx.up.railway.app` gibi bir adres verir. Bu adresi tüm personelle paylaşın.

### Seçenek B — Kendi VPS'iniz (Hetzner, DigitalOcean, Türk hosting firmaları vb.)
1. Ubuntu 22.04 bir sunucu kiralayın (en ucuz paket yeterli, 10-15 kullanıcı için).
2. Docker kurun: `curl -fsSL https://get.docker.com | sh`
3. Bu proje klasörünü sunucuya kopyalayın (`scp` veya `git clone`).
4. Klasör içinde: `docker compose up -d --build`
5. Sunucunun IP adresine (veya bağladığınız bir alan adına, örn. `stok.2motomasyon.com`) 3000 portundan erişilir. Kalıcı ve profesyonel görünüm için bir alan adı + Nginx/Caddy ile HTTPS (SSL) eklemenizi öneririm — isterseniz bu adımda da yardımcı olabilirim.

### Seçenek C — Render.com
Railway ile neredeyse aynı adımlar; "Web Service" + Dockerfile + "Persistent Disk" (mount: `/app/data`) ekleyerek deploy edilir.

> Hangi seçeneği kullanacağınıza karar verirseniz (örn. VPS'iniz zaten varsa), deploy sürecinde adım adım eşlik edebilirim.

---

## 3) Masaüstü "Program" Gibi Kullanma (PWA)

Gerçek bir `.exe` yazmaya gerek yok — bu sistem "Progressive Web App" olarak hazırlandı:

1. Personel, verdiğiniz adresi (örn. `https://stok.2motomasyon.com`) Chrome veya Edge'de açar.
2. Adres çubuğundaki **"Yükle" (Install)** simgesine tıklar (veya Chrome'da ⋮ menüsü → "Uygulamayı Yükle").
3. Program, masaüstünde ayrı bir simge ve pencere ile normal bir Windows programı gibi açılır — tarayıcı çubuğu görünmez.

Bu şekilde her PC'de gerçek bir masaüstü uygulaması deneyimi olur, ama arka planda hep aynı merkezi veriye bağlanır.

---

## 4) İlk Giriş

- Kullanıcı adı: `admin`
- Şifre: `2m2026admin`

**İlk girişten hemen sonra bu şifreyi değiştirin** (sağ üstten değil şu an ayarlar ekranı yok — isterseniz bunu ekleyebilirim; şimdilik `/api/change-password` uç noktası hazır, panele buton eklenebilir). Yönetici panelinden diğer personel için kullanıcı oluşturabilirsiniz.

---

## 5) Özellikler

- **Panel (Dashboard):** Toplam ürün, kritik seviyedeki ürünler, toplam stok değeri, günlük giriş/çıkış özeti, son hareketler
- **Stok Listesi:** Arama (kod/ad/açıklama), kategori, kritik seviye altı ürünler kırmızı vurgulu
- **Stok Hareketi:** Giriş / Çıkış / Düzeltme (sayım), ilgili kişi ve açıklama alanı
- **Hareket Geçmişi:** Tip ve tarih aralığına göre filtreleme
- **Kullanıcı Yönetimi:** Sadece Yönetici rolü — yeni kullanıcı ekleme/silme

---

## 6) Yerel Bilgisayarınızda Deneme (Deploy Etmeden Önce)

```bash
npm install
node server.js
```

Sonra tarayıcıdan `http://localhost:3000` adresine girip test edebilirsiniz. Veritabanı proje klasöründe `stok.db` dosyası olarak oluşur.

---

## 7) Sonraki Adımlar (İsteğe Bağlı Geliştirmeler)

İsterseniz şunları da ekleyebilirim:
- Excel'e aktarma (stok listesi / hareket geçmişi)
- Barkod/QR okuma ile hızlı stok hareketi
- E-posta ile kritik seviye uyarısı
- Şifre değiştirme ekranı (arayüzde buton)
- Alan adı + otomatik SSL kurulum desteği
