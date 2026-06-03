const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, 'lumina.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    phone     TEXT,
    dest      TEXT,
    guests    INTEGER DEFAULT 1,
    date_from TEXT,
    date_to   TEXT,
    budget    TEXT,
    message   TEXT,
    lang      TEXT DEFAULT 'en',
    created   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    email   TEXT NOT NULL UNIQUE,
    lang    TEXT DEFAULT 'en',
    created TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS destinations (
    id      INTEGER PRIMARY KEY,
    slug    TEXT UNIQUE,
    country TEXT,
    name    TEXT,
    region  TEXT,
    price   INTEGER,
    nights  TEXT,
    img     TEXT,
    badge   TEXT,
    popular INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id     INTEGER PRIMARY KEY,
    num    TEXT,
    title  TEXT,
    dur    TEXT,
    price  INTEGER,
    img    TEXT,
    type   TEXT
  );
`);

const destSeeded = db.prepare('SELECT COUNT(*) as c FROM destinations').get().c;
if (!destSeeded) {
  const ins = db.prepare(`INSERT OR IGNORE INTO destinations (slug,country,name,region,price,nights,img,badge,popular)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  [
    ['santorini','Greece','Santorini','Europe',4200,'7–14 nights','https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=600&q=80','From $4,200',1],
    ['maldives','Maldives','North Malé Atoll','Indian Ocean',6800,'5–12 nights','https://images.unsplash.com/photo-1540202404-a2f29016b523?w=600&q=80','From $6,800',1],
    ['kyoto','Japan','Kyoto & Hakone','Asia',5500,'8–14 nights','https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?w=600&q=80','From $5,500',1],
    ['amalfi','Italy','Amalfi Coast','Europe',3900,'5–10 nights','https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=600&q=80','From $3,900',0],
    ['bali','Indonesia','Sacred Bali','Asia',7200,'10 nights','https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80','From $7,200',1],
    ['kenya','Kenya','Kenya Safari','Africa',9500,'8 nights','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=500&q=80','From $9,500',0],
    ['norway','Norway','Norwegian Fjords','Europe',14800,'12 nights','https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=500&q=80','From $14,800',0],
    ['morocco','Morocco','Imperial Morocco','Africa',5900,'9 nights','https://images.unsplash.com/photo-1534430480872-3498386e7856?w=500&q=80','From $5,900',0],
    ['iceland','Iceland','Iceland Aurora','Europe',8400,'7 nights','https://images.unsplash.com/photo-1580654712603-eb43273aff33?w=500&q=80','From $8,400',0],
  ].forEach(r => ins.run(...r));
}

const expSeeded = db.prepare('SELECT COUNT(*) as c FROM experiences').get().c;
if (!expSeeded) {
  const ins = db.prepare(`INSERT OR IGNORE INTO experiences (num,title,dur,price,img,type)
    VALUES (?,?,?,?,?,?)`);
  [
    ['01','Sacred Bali Retreat','10 Nights · Private Villa',7200,'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80','Wellness'],
    ['02','Kenya Safari Odyssey','8 Nights · Luxury Camp',9500,'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=500&q=80','Adventure'],
    ['03','Norwegian Fjords','12 Nights · Private Yacht',14800,'https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=500&q=80','Yacht'],
    ['04','Imperial Morocco','9 Nights · Riad Collection',5900,'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=500&q=80','Cultural'],
    ['05','Iceland Aurora','7 Nights · Glass Cabin',8400,'https://images.unsplash.com/photo-1580654712603-eb43273aff33?w=500&q=80','Scenic'],
  ].forEach(r => ins.run(...r));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/destinations', (req, res) => {
  const { region, popular } = req.query;
  let q = 'SELECT * FROM destinations';
  const args = [];
  const where = [];
  if (region) { where.push('region = ?'); args.push(region); }
  if (popular) { where.push('popular = 1'); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY popular DESC, price ASC';
  res.json(db.prepare(q).all(...args));
});

app.get('/api/experiences', (req, res) => {
  res.json(db.prepare('SELECT * FROM experiences ORDER BY id').all());
});

app.post('/api/inquiries',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().trim(),
  body('dest').optional().trim(),
  body('guests').optional().isInt({ min: 1, max: 50 }).toInt(),
  body('date_from').optional().isISO8601(),
  body('date_to').optional().isISO8601(),
  body('budget').optional().trim(),
  body('message').optional().trim().isLength({ max: 2000 }),
  body('lang').optional().isIn(['en', 'ru', 'uz']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, phone, dest, guests = 1, date_from, date_to, budget, message, lang = 'en' } = req.body;
    const stmt = db.prepare(`INSERT INTO inquiries (name,email,phone,dest,guests,date_from,date_to,budget,message,lang)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const info = stmt.run(name, email, phone || null, dest || null, guests, date_from || null, date_to || null, budget || null, message || null, lang);
    res.status(201).json({ id: info.lastInsertRowid, message: 'Inquiry received' });
  }
);

app.post('/api/newsletter',
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('lang').optional().isIn(['en', 'ru', 'uz']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, lang = 'en' } = req.body;
    try {
      db.prepare('INSERT INTO newsletter (email, lang) VALUES (?, ?)').run(email, lang);
      res.status(201).json({ message: 'Subscribed' });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ message: 'Already subscribed' });
      throw e;
    }
  }
);

app.get('/api/stats', (req, res) => {
  res.json({ properties: 2400, countries: 80, journeys: 12000, satisfaction: 98 });
});

app.get('/api/admin/inquiries', (req, res) => {
  res.json(db.prepare('SELECT * FROM inquiries ORDER BY created DESC').all());
});

app.get('/api/admin/newsletter', (req, res) => {
  res.json(db.prepare('SELECT * FROM newsletter ORDER BY created DESC').all());
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✦ Lumina Voyages server running on http://localhost:${PORT}`);
});
