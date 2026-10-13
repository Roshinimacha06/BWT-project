// Study Group Finder: Express server. Run with: node server.js
require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET is not set in .env. Using a temporary key: users are signed out on every restart.');
}

const groups = require('./routes/groups');
require('./seed').run();

const app = express();
app.use(express.json({ limit: '50kb' }));

app.get('/api/config', (req, res) => res.json({
  subjects: groups.SUBJECTS,
  days: groups.DAYS,
  years: ['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate'],
  googleClientId: process.env.GOOGLE_CLIENT_ID || ''
}));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', groups);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, 'public')));

// Any error becomes a clean JSON message instead of a stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status === 400 || err instanceof SyntaxError ? 400 : 500)
    .json({ error: err instanceof SyntaxError ? 'Invalid request' : 'Something went wrong on the server' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Study Group Finder is running at http://localhost:' + port));
