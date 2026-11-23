# AppSpace

Colorful application marketplace: public site (home, directory, app detail, magazine) + admin panel.
Stack: Node.js, Express, EJS, SQLite (built-in node:sqlite, Node 22.13+), vanilla CSS/JS.

## Run
    npm install
    cp .env.example .env   # then export the variables, or set them in your shell
    npm start              # http://localhost:3000

Default admin (change it!): `admin` / `admin123`. Set `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET` before the first run.
Admin panel: http://localhost:3000/admin

## Structure
    server.js        routes, auth, CSRF, CRUD
    db.js            schema + sample data
    views/           public pages, partials, admin/
    public/css|js    styles and small interactions

## Website Settings
Admin → **Website Settings** edits the landing page (brand name, hero text, section titles, show/hide sections, colors, footer/social links, SEO) with no code changes. **Reset to defaults** restores the original content.

## Google AdSense
Admin → Website Settings → *Google AdSense (ads)*: enter the Publisher ID and ad unit IDs, tick *Enable ads*. `/ads.txt` is generated automatically.
