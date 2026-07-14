const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '2M-OTOMASYON-STOK-TAKIP-GIZLI-ANAHTAR-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth Middleware ----------
function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  next();
}

// ---------- Auth Routes ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, ad_soyad: user.ad_soyad },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { username: user.username, role: user.role, ad_soyad: user.ad_soyad } });
});

app.get('/api/me', auth, (req, res) => res.json(req.user));

app.post('/api/change-password', auth, (req, res) => {
  const { eskiSifre, yeniSifre } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(eskiSifre, user.password)) {
    return res.status(400).json({ error: 'Mevcut şifre yanlış' });
  }
  const hash = bcrypt.hashSync(yeniSifre, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// ---------- User Management (admin only) ----------
app.get('/api/users', auth, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, ad_soyad, role, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', auth, adminOnly, (req, res) => {
  const { username, password, ad_soyad, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (username, password, ad_soyad, role) VALUES (?,?,?,?)')
      .run(username, hash, ad_soyad || '', role || 'user');
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Bu kullanıcı adı zaten var' });
  }
});

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Products ----------
app.get('/api/products', auth, (req, res) => {
  const q = (req.query.q || '').trim();
  const kategori = (req.query.kategori || '').trim();
  let sql = 'SELECT * FROM products WHERE aktif = 1';
  const params = [];
  if (q) {
    sql += ' AND (kod LIKE ? OR ad LIKE ? OR aciklama LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (kategori) {
    sql += ' AND kategori = ?';
    params.push(kategori);
  }
  sql += ' ORDER BY ad ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/products/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ürün bulunamadı' });
  res.json(row);
});

app.post('/api/products', auth, (req, res) => {
  const { kod, ad, kategori, birim, miktar, kritik_seviye, birim_fiyat, konum, aciklama } = req.body;
  if (!kod || !ad) return res.status(400).json({ error: 'Kod ve ad zorunlu' });
  try {
    const info = db.prepare(`INSERT INTO products
      (kod, ad, kategori, birim, miktar, kritik_seviye, birim_fiyat, konum, aciklama)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(kod, ad, kategori || '', birim || 'adet', miktar || 0, kritik_seviye || 0, birim_fiyat || 0, konum || '', aciklama || '');

    if (Number(miktar) > 0) {
      db.prepare(`INSERT INTO transactions (product_id, tip, miktar, onceki_miktar, yeni_miktar, aciklama, kullanici)
        VALUES (?,?,?,?,?,?,?)`)
        .run(info.lastInsertRowid, 'giris', miktar, 0, miktar, 'İlk stok girişi', req.user.username);
    }
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Bu ürün kodu zaten kayıtlı' });
  }
});

app.put('/api/products/:id', auth, (req, res) => {
  const { kod, ad, kategori, birim, kritik_seviye, birim_fiyat, konum, aciklama } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı' });
  db.prepare(`UPDATE products SET kod=?, ad=?, kategori=?, birim=?, kritik_seviye=?, birim_fiyat=?, konum=?, aciklama=?, updated_at=datetime('now')
    WHERE id=?`)
    .run(kod, ad, kategori || '', birim || 'adet', kritik_seviye || 0, birim_fiyat || 0, konum || '', aciklama || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE products SET aktif = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Categories ----------
app.get('/api/categories', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY ad').all();
  res.json(rows);
});

app.post('/api/categories', auth, (req, res) => {
  const { ad } = req.body;
  try {
    const info = db.prepare('INSERT INTO categories (ad) VALUES (?)').run(ad);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Bu kategori zaten var' });
  }
});

// ---------- Transactions (Stok Hareketleri) ----------
app.post('/api/transactions', auth, (req, res) => {
  const { product_id, tip, miktar, aciklama, ilgili_kisi } = req.body;
  if (!product_id || !tip || !miktar) return res.status(400).json({ error: 'Eksik bilgi' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Ürün bulunamadı' });

  let yeniMiktar;
  if (tip === 'giris') {
    yeniMiktar = product.miktar + Number(miktar);
  } else if (tip === 'cikis') {
    yeniMiktar = product.miktar - Number(miktar);
    if (yeniMiktar < 0) return res.status(400).json({ error: 'Stok yetersiz. Mevcut: ' + product.miktar });
  } else if (tip === 'duzeltme') {
    yeniMiktar = Number(miktar);
  } else {
    return res.status(400).json({ error: 'Geçersiz hareket tipi' });
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE products SET miktar = ?, updated_at = datetime(\'now\') WHERE id = ?').run(yeniMiktar, product_id);
    db.prepare(`INSERT INTO transactions
      (product_id, tip, miktar, onceki_miktar, yeni_miktar, aciklama, ilgili_kisi, kullanici)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(product_id, tip, miktar, product.miktar, yeniMiktar, aciklama || '', ilgili_kisi || '', req.user.username);
  });
  tx();

  res.json({ ok: true, yeni_miktar: yeniMiktar });
});

app.get('/api/transactions', auth, (req, res) => {
  const { product_id, tip, baslangic, bitis, limit } = req.query;
  let sql = `SELECT t.*, p.kod, p.ad as urun_ad, p.birim FROM transactions t
             JOIN products p ON p.id = t.product_id WHERE 1=1`;
  const params = [];
  if (product_id) { sql += ' AND t.product_id = ?'; params.push(product_id); }
  if (tip) { sql += ' AND t.tip = ?'; params.push(tip); }
  if (baslangic) { sql += ' AND t.tarih >= ?'; params.push(baslangic); }
  if (bitis) { sql += ' AND t.tarih <= ?'; params.push(bitis + ' 23:59:59'); }
  sql += ' ORDER BY t.tarih DESC, t.id DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// ---------- Dashboard ----------
app.get('/api/dashboard', auth, (req, res) => {
  const toplamUrun = db.prepare('SELECT COUNT(*) c FROM products WHERE aktif = 1').get().c;
  const toplamDeger = db.prepare('SELECT COALESCE(SUM(miktar * birim_fiyat),0) v FROM products WHERE aktif = 1').get().v;
  const kritikUrunler = db.prepare('SELECT * FROM products WHERE aktif = 1 AND miktar <= kritik_seviye ORDER BY miktar ASC').all();
  const sonHareketler = db.prepare(`SELECT t.*, p.kod, p.ad as urun_ad, p.birim FROM transactions t
    JOIN products p ON p.id = t.product_id ORDER BY t.tarih DESC, t.id DESC LIMIT 15`).all();
  const kategoriDagilimi = db.prepare(`SELECT COALESCE(kategori,'Diğer') kategori, COUNT(*) adet, SUM(miktar*birim_fiyat) deger
    FROM products WHERE aktif = 1 GROUP BY kategori`).all();
  const bugunHareket = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN tip='giris' THEN miktar ELSE 0 END),0) giris,
    COALESCE(SUM(CASE WHEN tip='cikis' THEN miktar ELSE 0 END),0) cikis
    FROM transactions WHERE date(tarih) = date('now')`).get();

  res.json({
    toplamUrun,
    toplamDeger,
    kritikUrunSayisi: kritikUrunler.length,
    kritikUrunler,
    sonHareketler,
    kategoriDagilimi,
    bugunHareket
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`2M Otomasyon Stok Takip sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
