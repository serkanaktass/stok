const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// DATA_DIR: Railway/Render gibi platformlarda kalıcı disk bu klasöre bağlanmalı
const DATA_DIR = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(DATA_DIR, 'stok.db'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  ad_soyad TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- admin | user
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT UNIQUE NOT NULL,
  ad TEXT NOT NULL,
  kategori TEXT,
  birim TEXT DEFAULT 'adet',
  miktar REAL NOT NULL DEFAULT 0,
  kritik_seviye REAL NOT NULL DEFAULT 0,
  birim_fiyat REAL NOT NULL DEFAULT 0,
  konum TEXT,
  aciklama TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  tip TEXT NOT NULL, -- giris | cikis | duzeltme
  miktar REAL NOT NULL,
  onceki_miktar REAL NOT NULL,
  yeni_miktar REAL NOT NULL,
  aciklama TEXT,
  ilgili_kisi TEXT, -- teslim alan / teslim eden vs.
  kullanici TEXT,
  tarih TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_products_kod ON products(kod);
CREATE INDEX IF NOT EXISTS idx_products_ad ON products(ad);
CREATE INDEX IF NOT EXISTS idx_trans_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_trans_tarih ON transactions(tarih);
`);

// İlk kurulumda varsayılan admin kullanıcısı oluştur
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('2m2026admin', 10);
  db.prepare('INSERT INTO users (username, password, ad_soyad, role) VALUES (?, ?, ?, ?)')
    .run('admin', hash, 'Yönetici', 'admin');
  console.log('Varsayılan admin kullanıcı oluşturuldu -> kullanıcı adı: admin  şifre: 2m2026admin (ilk girişte değiştirin)');
}

module.exports = db;
