const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const db = new DatabaseSync(process.env.DB_FILE || 'twinstoreapps.db');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, icon TEXT, color TEXT DEFAULT 'c0');
CREATE TABLE IF NOT EXISTS apps(
  id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, description TEXT, long_description TEXT DEFAULT '',
  icon_url TEXT DEFAULT '', category_id INTEGER, android_url TEXT DEFAULT '', ios_url TEXT DEFAULT '',
  rating REAL DEFAULT 0, featured INTEGER DEFAULT 0, published INTEGER DEFAULT 1,
  screenshots TEXT DEFAULT '', features TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS articles(
  id INTEGER PRIMARY KEY, title TEXT, slug TEXT UNIQUE, excerpt TEXT, content TEXT, thumbnail TEXT DEFAULT '',
  author TEXT DEFAULT 'AppSpace Team', category TEXT DEFAULT 'Tech', app_id INTEGER, published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

if (!db.prepare('SELECT 1 FROM admins').get()) {
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(
    process.env.ADMIN_USER || 'admin',
    bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10));
}

if (!db.prepare('SELECT 1 FROM categories').get()) {
  const { CATEGORIES, APPS } = require('./seed-data');
  const c = db.prepare('INSERT INTO categories(name,slug,icon,color) VALUES(?,?,?,?)');
  const ids = {};
  CATEGORIES.forEach(r => { c.run(...r); ids[r[0]] = db.prepare('SELECT id FROM categories WHERE slug=?').get(r[1]).id; });
  const a = db.prepare(`INSERT INTO apps(name,slug,description,category_id,ios_url,featured,published) VALUES(?,?,?,?,?,?,1)`);
  APPS.forEach(([name, slug, id, cat, desc, feat]) =>
    a.run(name, slug, desc, ids[cat], `https://apps.apple.com/us/app/${slug}/id${id}`, feat));
}
module.exports = db;
