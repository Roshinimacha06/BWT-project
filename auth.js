// Reads the login token from the "Authorization: Bearer <token>" header.
const jwt = require('jsonwebtoken');
const db = require('../db');

function readToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { return null; }
}

// Blocks the request unless the user is signed in. Sets req.user.
exports.required = (req, res, next) => {
  const t = readToken(req);
  const u = t && db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(t.id);
  if (!u) return res.status(401).json({ error: 'Please sign in first' });
  req.user = u;
  next();
};

// Lets the request through either way. req.user is null for visitors.
exports.optional = (req, res, next) => {
  const t = readToken(req);
  req.user = t ? { id: t.id } : null;
  next();
};

exports.sign = (u) => jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
