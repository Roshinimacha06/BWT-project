// In-app notifications for the signed-in user.
const router = require('express').Router();
const db = require('../db');
const { required } = require('../middleware/auth');

router.get('/', required, (req, res) => {
  const notifications = db.prepare(
    'SELECT id, text, group_id, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c;
  res.json({ notifications, unread });
});

router.post('/read', required, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
