// Pulls real icon, rating, description and screenshots from the public iTunes lookup API (needs internet).
// Runs automatically on server start for apps without an icon. Manual run: npm run enrich
const db = require('./db');
async function enrich(force = false) {
  const rows = db.prepare(`SELECT id, ios_url FROM apps WHERE ios_url LIKE '%/id%'${force ? '' : " AND icon_url=''"}`).all();
  const map = new Map();
  for (const r of rows) { const m = /\/id(\d+)/.exec(r.ios_url); if (m) map.set(m[1], r.id); }
  const ids = [...map.keys()];
  const up = db.prepare(`UPDATE apps SET icon_url=?, rating=?, screenshots=?,
    long_description=CASE WHEN long_description='' THEN ? ELSE long_description END WHERE id=?`);
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${ids.slice(i, i + 50).join(',')}&country=us`, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      for (const it of data.results || []) {
        const rowId = map.get(String(it.trackId)); if (!rowId) continue;
        up.run(it.artworkUrl512 || it.artworkUrl100 || '', Math.round((it.averageUserRating || 0) * 10) / 10,
          (it.screenshotUrls || []).slice(0, 5).join('\n'), String(it.description || '').slice(0, 1200), rowId);
      }
    } catch (e) { console.log('Enrich skipped:', e.message); }
  }
}
module.exports = enrich;
if (require.main === module) enrich(true).then(() => console.log('Enrich done'));
