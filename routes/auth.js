// Register, login, guest access, optional Google sign-in, and profile.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { sign, required } = require('../middleware/auth');

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate'];
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const year = (y) => (YEARS.includes(y) ? y : '');
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, course: u.course, year: u.year, bio: u.bio, provider: u.provider });
const byId = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const done = (res, u, code = 200) => res.status(code).json({ token: sign(u), user: pub(u) });

router.post('/register', (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 60), email = clean(b.email, 120).toLowerCase(), password = String(b.password || '');
  if (!name) return res.status(400).json({ error: 'Please enter your name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'This email is already registered. Try signing in.' });
  const r = db.prepare('INSERT INTO users(name,email,password,course,year,provider) VALUES(?,?,?,?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10), clean(b.course, 60), year(b.year), 'email');
  done(res, byId(r.lastInsertRowid), 201);
});

router.post('/login', (req, res) => {
  const b = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(clean(b.email, 120).toLowerCase());
  if (!u || !u.password || !bcrypt.compareSync(String(b.password || ''), u.password))
    return res.status(401).json({ error: 'Wrong email or password' });
  done(res, u);
});

router.post('/guest', (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 60);
  if (!name) return res.status(400).json({ error: 'Please enter your name' });
  const email = 'guest-' + crypto.randomBytes(5).toString('hex') + '@guest.local';
  const r = db.prepare('INSERT INTO users(name,email,password,course,year,provider) VALUES(?,?,?,?,?,?)')
    .run(name, email, '', clean(b.course, 60), year(b.year), 'guest');
  done(res, byId(r.lastInsertRowid), 201);
});

// Optional: needs GOOGLE_CLIENT_ID in .env. Verifies the Google token with Google.
router.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(400).json({ error: 'Google sign-in is not set up on this server' });
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String((req.body || {}).credential || '')));
    const t = await r.json();
    if (!r.ok || t.aud !== clientId || String(t.email_verified) !== 'true')
      return res.status(401).json({ error: 'Google sign-in failed' });
    const email = String(t.email).toLowerCase();
    let u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!u) {
      const ins = db.prepare('INSERT INTO users(name,email,password,provider) VALUES(?,?,?,?)')
        .run(clean(t.name || email.split('@')[0], 60), email, '', 'google');
      u = byId(ins.lastInsertRowid);
    }
    done(res, u);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Google' });
  }
});

router.get('/me', required, (req, res) => res.json({ user: pub(byId(req.user.id)) }));

router.patch('/me', required, (req, res) => {
  const b = req.body || {};
  const u = byId(req.user.id);
  db.prepare('UPDATE users SET course = ?, year = ?, bio = ? WHERE id = ?')
    .run(clean(b.course !== undefined ? b.course : u.course, 60), year(b.year !== undefined ? b.year : u.year),
         clean(b.bio !== undefined ? b.bio : u.bio, 140), u.id);
  res.json({ user: pub(byId(u.id)) });
});

module.exports = router;
