const db = require('./db');
db.exec('CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT)');

// [key, label, type, default]  — defaults equal the original site content
const GROUPS = [
  { title: 'Brand', fields: [
    ['site_name', 'Site name', 'text', 'AppSpace'],
    ['logo_image', 'Logo image', 'image', ''],
    ['favicon_image', 'Favicon', 'image', ''],
    ['logo_show_name', 'Show site name next to logo image', 'bool', '1'],
    ['logo_letter', 'Logo letter (used when no logo image is uploaded)', 'text', 'A'],
    ['footer_text', 'Footer tagline', 'text', 'A colorful place to discover apps worth installing.']] },
  { title: 'Hero (top of landing page)', fields: [
    ['hero_line1', 'Headline – first line', 'text', 'Find Your Next'],
    ['hero_highlight', 'Headline – highlighted words', 'text', 'Favorite App.'],
    ['hero_subtitle', 'Subtitle', 'textarea', 'Discover amazing apps, explore useful digital tools, and find the perfect applications for your everyday life.'],
    ['hero_placeholder', 'Search box placeholder', 'text', 'Search apps, tools, categories…'],
    ['hero_cta_text', 'Button text', 'text', 'Explore Applications'],
    ['hero_cta_url', 'Button link (/apps or https://…)', 'url', '/apps']] },
  { title: 'Section titles', fields: [
    ['cat_title', 'Categories section', 'text', 'Browse by category'],
    ['featured_title', 'Featured section', 'text', 'Featured applications'],
    ['latest_title', 'Latest apps section', 'text', 'Fresh arrivals'],
    ['mag_title', 'Articles section', 'text', 'From the magazine']] },
  { title: 'Show / hide sections', fields: [
    ['show_stats', 'Hero statistics', 'bool', '1'],
    ['show_categories', 'Categories', 'bool', '1'],
    ['show_featured', 'Featured applications', 'bool', '1'],
    ['show_latest', 'Latest applications', 'bool', '1'],
    ['show_articles', 'Articles', 'bool', '1']] },
  { title: 'Brand colors', fields: [
    ['color_primary', 'Primary color', 'color', '#7658EF'],
    ['color_secondary', 'Secondary color', 'color', '#4D8DFF'],
    ['color_accent', 'Accent color', 'color', '#FF7195']] },
  { title: 'Contact & social links (shown in footer)', fields: [
    ['contact_email', 'Contact email', 'text', ''],
    ['instagram', 'Instagram URL', 'url', ''],
    ['facebook', 'Facebook URL', 'url', ''],
    ['whatsapp', 'WhatsApp link', 'url', '']] },
  { title: 'Google AdSense (ads)', fields: [
    ['adsense_enabled', 'Enable ads on public pages', 'bool', '0'],
    ['adsense_client', 'Publisher ID (format: ca-pub-1234567890123456)', 'adsclient', ''],
    ['adsense_slot_home', 'Ad unit ID – Home page', 'adsslot', ''],
    ['adsense_slot_list', 'Ad unit ID – Applications list', 'adsslot', ''],
    ['adsense_slot_detail', 'Ad unit ID – Application detail', 'adsslot', ''],
    ['adsense_slot_article', 'Ad unit ID – Article page', 'adsslot', '']] },
  { title: 'SEO', fields: [
    ['meta_description', 'Meta description', 'textarea', 'Discover amazing apps, explore useful digital tools, and find the perfect applications for your everyday life.']] }
];
const DEF = {}; GROUPS.forEach(g => g.fields.forEach(f => DEF[f[0]] = f[3]));

function all() {
  const o = { ...DEF };
  for (const r of db.prepare('SELECT k,v FROM settings').all()) if (r.k in DEF) o[r.k] = r.v;
  return o;
}
function save(b) {
  const up = db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
  for (const g of GROUPS) for (const [k, , t, d] of g.fields) {
    if (t === 'image') continue;
    let v;
    if (t === 'bool') v = b[k] ? '1' : '0';
    else {
      v = String(b[k] ?? '').trim().slice(0, t === 'textarea' ? 400 : 160);
      if (t === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) v = d;
      if (t === 'url' && v && !/^(https?:\/\/|\/)/i.test(v)) v = '';
      if (t === 'adsclient' && !/^ca-pub-\d{10,20}$/.test(v)) v = '';
      if (t === 'adsslot' && !/^\d{5,20}$/.test(v)) v = '';
      if (k === 'logo_letter') v = v.slice(0, 2);
      if (!v && d) v = d;
    }
    up.run(k, v);
  }
}
const reset = () => db.prepare('DELETE FROM settings').run();
const set = (k, v) => db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v);
module.exports = { GROUPS, all, save, set, reset };
