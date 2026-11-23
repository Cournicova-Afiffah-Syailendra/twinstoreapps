const express = require('express'), session = require('express-session'), bcrypt = require('bcryptjs'), crypto = require('crypto');
const db = require('./db');
const SET = require('./settings');
const fs = require('fs'), path = require('path'), multer = require('multer');
const UP = path.join(__dirname, 'public', 'uploads'); fs.mkdirSync(UP, { recursive: true });
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };
const upload = multer({
  storage: multer.diskStorage({ destination: UP, filename: (req, f, cb) => cb(null, crypto.randomBytes(8).toString('hex') + '.' + EXT[f.mimetype]) }),
  limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, !!EXT[f.mimetype]) }).single('file');
const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret-change-me', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } }));

app.use((req, res, next) => {
  req.session.csrf = req.session.csrf || crypto.randomBytes(16).toString('hex');
  if (req.method === 'POST' && ((req.body && req.body._csrf) || req.query._csrf) !== req.session.csrf) return res.status(403).send('Invalid CSRF token');
  Object.assign(res.locals, {
    S: SET.all(), csrf: req.session.csrf, flash: req.session.flash, path: req.path, q: req.query,
    qs: o => new URLSearchParams(Object.fromEntries(Object.entries({ ...req.query, ...o }).filter(([, v]) => v))).toString() });
  delete req.session.flash; next();
});

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const url = v => (/^https?:\/\//i.test(v || '') ? v.trim() : '');
const lines = (v, fn = s => s.trim()) => (v || '').split('\n').map(fn).filter(Boolean).join('\n');
const uniq = (t, base, id = 0) => { const s = slug(base) || 'item'; let n = s, i = 1;
  while (db.prepare(`SELECT id FROM ${t} WHERE slug=? AND id!=?`).get(n, id)) n = s + '-' + ++i; return n; };
const APPQ = `SELECT a.*, c.name cat, c.slug cat_slug, COALESCE(c.color,'c0') color FROM apps a LEFT JOIN categories c ON c.id=a.category_id`;
const auth = (req, res, next) => (req.session.admin ? next() : res.redirect('/admin/login'));

/* ---------- Public ---------- */
app.get('/', (req, res) => {
  const cats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM apps WHERE category_id=c.id AND published=1) n FROM categories c`).all();
  const featured = db.prepare(`${APPQ} WHERE a.published=1 AND a.featured=1 ORDER BY a.id DESC LIMIT 4`).all();
  const latest = db.prepare(`${APPQ} WHERE a.published=1 ORDER BY a.id DESC LIMIT 6`).all();
  const articles = db.prepare('SELECT * FROM articles WHERE published=1 ORDER BY id DESC LIMIT 3').all();
  const stats = { apps: db.prepare('SELECT COUNT(*) n FROM apps WHERE published=1').get().n, cats: cats.length,
    articles: db.prepare('SELECT COUNT(*) n FROM articles WHERE published=1').get().n };
  res.render('index', { cats, featured, latest, articles, stats });
});

app.get('/apps', (req, res) => {
  const { q = '', cat = '', platform = '', sort = '' } = req.query; const w = ['a.published=1'], p = [];
  if (q) { w.push('(a.name LIKE ? OR a.description LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  if (cat) { w.push('c.slug=?'); p.push(cat); }
  if (platform === 'android') w.push("a.android_url!=''");
  if (platform === 'ios') w.push("a.ios_url!=''");
  const order = sort === 'name' ? 'a.name' : sort === 'rating' ? 'a.rating DESC' : 'a.id DESC';
  res.render('apps', { apps: db.prepare(`${APPQ} WHERE ${w.join(' AND ')} ORDER BY ${order}`).all(...p),
    cats: db.prepare('SELECT * FROM categories').all() });
});

app.get('/apps/:slug', (req, res) => {
  const a = db.prepare(`${APPQ} WHERE a.slug=? AND a.published=1`).get(req.params.slug);
  if (!a) return res.status(404).render('404');
  const related = db.prepare(`${APPQ} WHERE a.published=1 AND a.category_id=? AND a.id!=? LIMIT 3`).all(a.category_id, a.id);
  res.render('app', { a, related });
});

app.get('/articles', (req, res) => res.render('articles', { articles: db.prepare('SELECT * FROM articles WHERE published=1 ORDER BY id DESC').all() }));
app.get('/articles/:slug', (req, res) => {
  const r = db.prepare('SELECT * FROM articles WHERE slug=? AND published=1').get(req.params.slug);
  if (!r) return res.status(404).render('404');
  const a = r.app_id ? db.prepare(`${APPQ} WHERE a.id=?`).get(r.app_id) : null;
  res.render('article', { r, a });
});

/* ---------- Admin: auth ---------- */
app.get('/admin/login', (req, res) => res.render('admin/login', { error: null }));
app.post('/admin/login', (req, res) => {
  const u = db.prepare('SELECT * FROM admins WHERE username=?').get(req.body.username || '');
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password_hash))
    return res.status(401).render('admin/login', { error: 'Wrong username or password.' });
  req.session.regenerate(() => { req.session.admin = { id: u.id, username: u.username }; res.redirect('/admin'); });
});
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

/* ---------- Admin: dashboard ---------- */
app.get('/admin', auth, (req, res) => {
  const n = t => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  res.render('admin/dashboard', { s: { apps: n('apps'), articles: n('articles'), cats: n('categories'),
      pub: db.prepare('SELECT (SELECT COUNT(*) FROM apps WHERE published=1)+(SELECT COUNT(*) FROM articles WHERE published=1) n').get().n },
    bars: db.prepare('SELECT c.name, COUNT(a.id) n FROM categories c LEFT JOIN apps a ON a.category_id=c.id GROUP BY c.id').all(),
    recent: db.prepare(`${APPQ} ORDER BY a.id DESC LIMIT 5`).all() });
});

/* ---------- Admin: apps CRUD ---------- */
const appVals = b => [b.name, b.description, b.long_description || '', url(b.icon_url), b.category_id || null, url(b.android_url),
  url(b.ios_url), Math.min(5, parseFloat(b.rating) || 0), b.featured ? 1 : 0, b.published ? 1 : 0, lines(b.screenshots, url), lines(b.features)];
const cats = () => db.prepare('SELECT * FROM categories').all();
app.get('/admin/apps', auth, (req, res) => res.render('admin/apps', { items: db.prepare(`${APPQ} ORDER BY a.id DESC`).all() }));
app.get('/admin/apps/new', auth, (req, res) => res.render('admin/app-form', { item: { published: 1 }, cats: cats(), action: '/admin/apps' }));
app.get('/admin/apps/:id/edit', auth, (req, res) => res.render('admin/app-form', { item: db.prepare('SELECT * FROM apps WHERE id=?').get(req.params.id) || {}, cats: cats(), action: `/admin/apps/${req.params.id}` }));
app.post('/admin/apps', auth, (req, res) => {
  db.prepare(`INSERT INTO apps(name,description,long_description,icon_url,category_id,android_url,ios_url,rating,featured,published,screenshots,features,slug)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...appVals(req.body), uniq('apps', req.body.name));
  req.session.flash = 'Application created.'; res.redirect('/admin/apps');
});
app.post('/admin/apps/:id', auth, (req, res) => {
  db.prepare(`UPDATE apps SET name=?,description=?,long_description=?,icon_url=?,category_id=?,android_url=?,ios_url=?,rating=?,featured=?,published=?,screenshots=?,features=?,slug=? WHERE id=?`)
    .run(...appVals(req.body), uniq('apps', req.body.name, +req.params.id), req.params.id);
  req.session.flash = 'Application updated.'; res.redirect('/admin/apps');
});
app.post('/admin/apps/:id/delete', auth, (req, res) => { db.prepare('DELETE FROM apps WHERE id=?').run(req.params.id); req.session.flash = 'Application deleted.'; res.redirect('/admin/apps'); });

/* ---------- Admin: articles CRUD ---------- */
const artVals = b => [b.title, b.excerpt || '', b.content || '', url(b.thumbnail), b.author || 'AppSpace Team', b.category || 'Tech', b.app_id || null, b.published ? 1 : 0];
const apps = () => db.prepare('SELECT id,name FROM apps').all();
app.get('/admin/articles', auth, (req, res) => res.render('admin/articles', { items: db.prepare('SELECT * FROM articles ORDER BY id DESC').all() }));
app.get('/admin/articles/new', auth, (req, res) => res.render('admin/article-form', { item: { published: 1 }, apps: apps(), action: '/admin/articles' }));
app.get('/admin/articles/:id/edit', auth, (req, res) => res.render('admin/article-form', { item: db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id) || {}, apps: apps(), action: `/admin/articles/${req.params.id}` }));
app.post('/admin/articles', auth, (req, res) => {
  db.prepare('INSERT INTO articles(title,excerpt,content,thumbnail,author,category,app_id,published,slug) VALUES(?,?,?,?,?,?,?,?,?)').run(...artVals(req.body), uniq('articles', req.body.title));
  req.session.flash = 'Article created.'; res.redirect('/admin/articles');
});
app.post('/admin/articles/:id', auth, (req, res) => {
  db.prepare('UPDATE articles SET title=?,excerpt=?,content=?,thumbnail=?,author=?,category=?,app_id=?,published=?,slug=? WHERE id=?').run(...artVals(req.body), uniq('articles', req.body.title, +req.params.id), req.params.id);
  req.session.flash = 'Article updated.'; res.redirect('/admin/articles');
});
app.post('/admin/articles/:id/delete', auth, (req, res) => { db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id); req.session.flash = 'Article deleted.'; res.redirect('/admin/articles'); });

/* ---------- Admin: categories ---------- */
app.get('/admin/categories', auth, (req, res) => res.render('admin/categories', { items: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM apps WHERE category_id=c.id) n FROM categories c`).all() }));
app.post('/admin/categories', auth, (req, res) => {
  const c = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].includes(req.body.color) ? req.body.color : 'c0';
  db.prepare('INSERT INTO categories(name,slug,icon,color) VALUES(?,?,?,?)').run(req.body.name, uniq('categories', req.body.name), req.body.icon || '✨', c);
  req.session.flash = 'Category created.'; res.redirect('/admin/categories');
});
app.post('/admin/categories/:id/delete', auth, (req, res) => {
  db.prepare('UPDATE apps SET category_id=NULL WHERE category_id=?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id); req.session.flash = 'Category deleted.'; res.redirect('/admin/categories');
});

/* ---------- Admin: website settings ---------- */
app.get('/admin/settings', auth, (req, res) => res.render('admin/settings', { groups: SET.GROUPS, vals: SET.all() }));
app.post('/admin/settings', auth, (req, res) => { SET.save(req.body); req.session.flash = 'Website settings saved.'; res.redirect('/admin/settings'); });
app.post('/admin/settings/reset', auth, (req, res) => { SET.reset(); req.session.flash = 'Settings reset to defaults.'; res.redirect('/admin/settings'); });

/* ---------- Admin: logo & favicon upload ---------- */
const IMG = ['logo_image', 'favicon_image'];
const dropFile = p => { if (/^\/uploads\/[a-f0-9]{16}\.\w+$/.test(p || '')) fs.unlink(path.join(UP, path.basename(p)), () => {}); };
app.post('/admin/settings/image/:field', auth, (req, res) => {
  if (!IMG.includes(req.params.field)) return res.redirect('/admin/settings');
  upload(req, res, err => {
    if (err || !req.file) {
      req.session.flash = err ? 'Upload failed: ' + (err.code === 'LIMIT_FILE_SIZE' ? 'max 2 MB.' : err.message) : 'Please choose a PNG, JPG, WebP or ICO file.';
      return res.redirect('/admin/settings');
    }
    dropFile(SET.all()[req.params.field]); SET.set(req.params.field, '/uploads/' + req.file.filename);
    req.session.flash = 'Image uploaded.'; res.redirect('/admin/settings');
  });
});
app.post('/admin/settings/image/:field/remove', auth, (req, res) => {
  if (IMG.includes(req.params.field)) { dropFile(SET.all()[req.params.field]); SET.set(req.params.field, ''); }
  req.session.flash = 'Image removed.'; res.redirect('/admin/settings');
});

/* ---------- ads.txt (required by Google AdSense) ---------- */
app.get('/ads.txt', (req, res) => {
  const m = /^ca-pub-(\d{10,20})$/.exec(res.locals.S.adsense_client || '');
  if (!m) return res.status(404).type('text/plain').send('Not found');
  res.type('text/plain').send(`google.com, pub-${m[1]}, DIRECT, f08c47fec0942fa0\n`);
});

app.use((req, res) => res.status(404).render('404'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on http://localhost:' + (process.env.PORT || 3000));
  require('./enrich')().catch(() => {}); // fetch icons/ratings/screenshots from the App Store once
});
