// Groups: search, create, details, join requests, and leader approval.
const router = require('express').Router();
const db = require('../db');
const { required, optional } = require('../middleware/auth');

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Engineering',
  'Economics', 'Business', 'Languages', 'Medicine', 'Law', 'Other'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MODES = ['In person', 'Online'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

const notify = (userId, text, groupId) =>
  db.prepare('INSERT INTO notifications(user_id,text,group_id) VALUES(?,?,?)').run(userId, text, groupId);

// One SELECT used by the list and the detail page.
const BASE = `
SELECT g.*, u.name AS creator_name, u.email AS creator_email, u.course AS creator_course, u.year AS creator_year,
  (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.status = 'approved') AS approved,
  (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.status = 'pending') AS pending,
  (SELECT m.status FROM members m WHERE m.group_id = g.id AND m.user_id = ?) AS my_status
FROM study_groups g JOIN users u ON u.id = g.creator_id`;

function shape(g, uid) {
  const lead = !!uid && g.creator_id === uid;
  return {
    id: g.id, title: g.title, subject: g.subject, description: g.description,
    days: g.days.split(','), start_time: g.start_time, end_time: g.end_time,
    mode: g.mode, location: g.location, capacity: g.capacity, created_at: g.created_at,
    creator: { id: g.creator_id, name: g.creator_name, course: g.creator_course, year: g.creator_year, bio: g.creator_bio },
    seats_left: g.capacity - 1 - g.approved,
    my_status: lead ? 'leader' : (g.my_status || null),
    pending_count: lead ? g.pending : 0
  };
}

function validate(b) {
  if (!clean(b.title, 70)) return 'Please enter a title';
  if (!SUBJECTS.includes(b.subject)) return 'Please choose a subject';
  if (!clean(b.description, 300)) return 'Please describe what the group will study';
  if (!Array.isArray(b.days) || !b.days.length || !b.days.every(d => DAYS.includes(d))) return 'Pick at least one day';
  if (!TIME.test(b.start_time || '') || !TIME.test(b.end_time || '')) return 'Please enter valid start and end times';
  if (b.end_time <= b.start_time) return 'The end time must be after the start time';
  if (!MODES.includes(b.mode)) return 'Please choose In person or Online';
  if (!clean(b.location, 200)) return 'Please enter a venue or a meeting link';
  const cap = Number(b.capacity);
  if (!Number.isInteger(cap) || cap < 2 || cap > 50) return 'Seats must be a whole number from 2 to 50';
  return null;
}

// Search and filter: ?q=&subject=&day=&mode=&open=1&mine=1&sort=new|seats|az
router.get('/', optional, (req, res) => {
  const uid = req.user ? req.user.id : 0;
  const { q = '', subject = '', day = '', mode = '', open = '', mine = '', sort = 'new' } = req.query;
  let rows = db.prepare(BASE).all(uid).map(g => shape(g, uid));
  const needle = String(q).toLowerCase();
  rows = rows.filter(g =>
    (!needle || [g.title, g.subject, g.description, g.location, g.creator.name].join(' ').toLowerCase().includes(needle)) &&
    (!subject || g.subject === subject) &&
    (!day || g.days.includes(day)) &&
    (!mode || g.mode === mode) &&
    (!open || g.seats_left > 0) &&
    (!mine || (uid && g.my_status)));
  if (sort === 'seats') rows.sort((a, b) => b.seats_left - a.seats_left);
  else if (sort === 'az') rows.sort((a, b) => a.title.localeCompare(b.title));
  else rows.sort((a, b) => b.id - a.id);
  res.json(rows);
});

// Create a group. The signed-in user becomes the leader.
router.post('/', required, (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return res.status(400).json({ error: err });
  const me = db.prepare('SELECT bio FROM users WHERE id = ?').get(req.user.id);
  const r = db.prepare(`INSERT INTO study_groups
    (title,subject,description,days,start_time,end_time,mode,location,capacity,creator_id,creator_bio)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(clean(b.title, 70), b.subject, clean(b.description, 300), b.days.join(','), b.start_time, b.end_time,
         b.mode, clean(b.location, 200), Number(b.capacity), req.user.id, clean(b.creator_bio || me.bio, 140));
  res.status(201).json({ id: r.lastInsertRowid });
});

// One group: leader info, approved members, and the caller's own status.
router.get('/:id', optional, (req, res) => {
  const uid = req.user ? req.user.id : 0;
  const row = db.prepare(BASE + ' WHERE g.id = ?').get(uid, req.params.id);
  if (!row) return res.status(404).json({ error: 'Group not found' });
  const g = shape(row, uid);
  g.members = db.prepare(`SELECT u.id, u.name, u.course, u.year FROM members m
    JOIN users u ON u.id = m.user_id WHERE m.group_id = ? AND m.status = 'approved' ORDER BY m.created_at`).all(row.id);
  // The leader's contact email is shown only to the leader and approved members.
  if (g.my_status === 'leader' || g.my_status === 'approved') g.creator.email = row.creator_email;
  res.json(g);
});

// Leader only: pending requests with joiner information.
router.get('/:id/requests', required, (req, res) => {
  const g = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  if (g.creator_id !== req.user.id) return res.status(403).json({ error: 'Only the leader can see requests' });
  res.json(db.prepare(`SELECT u.id, u.name, u.email, u.course, u.year, m.message, m.created_at FROM members m
    JOIN users u ON u.id = m.user_id WHERE m.group_id = ? AND m.status = 'pending' ORDER BY m.created_at`).all(g.id));
});

// Request to join. The leader gets a notification.
router.post('/:id/requests', required, (req, res) => {
  const g = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  if (g.creator_id === req.user.id) return res.status(400).json({ error: 'You already lead this group' });
  if (db.prepare('SELECT 1 FROM members WHERE group_id = ? AND user_id = ?').get(g.id, req.user.id))
    return res.status(409).json({ error: 'You have already requested to join this group' });
  const n = db.prepare("SELECT COUNT(*) AS c FROM members WHERE group_id = ? AND status = 'approved'").get(g.id).c;
  if (n >= g.capacity - 1) return res.status(400).json({ error: 'This group is full' });
  db.prepare('INSERT INTO members(group_id,user_id,message) VALUES(?,?,?)').run(g.id, req.user.id, clean((req.body || {}).message, 300));
  notify(g.creator_id, `${req.user.name} requested to join "${g.title}"`, g.id);
  res.status(201).json({ status: 'pending' });
});

// Leader only: approve or decline. The joiner gets a notification.
router.patch('/:id/requests/:userId', required, (req, res) => {
  const g = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  if (g.creator_id !== req.user.id) return res.status(403).json({ error: 'Only the leader can do this' });
  const status = (req.body || {}).status;
  if (!['approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Status must be approved or declined' });
  const m = db.prepare('SELECT * FROM members WHERE group_id = ? AND user_id = ?').get(g.id, req.params.userId);
  if (!m) return res.status(404).json({ error: 'Request not found' });
  if (m.status !== 'pending') return res.status(409).json({ error: 'This request was already answered' });
  if (status === 'approved') {
    const n = db.prepare("SELECT COUNT(*) AS c FROM members WHERE group_id = ? AND status = 'approved'").get(g.id).c;
    if (n >= g.capacity - 1) return res.status(400).json({ error: 'The group is full' });
  }
  db.prepare('UPDATE members SET status = ? WHERE group_id = ? AND user_id = ?').run(status, g.id, m.user_id);
  notify(m.user_id, `Your request to join "${g.title}" was ${status}`, g.id);
  res.json({ status });
});

router.SUBJECTS = SUBJECTS;
router.DAYS = DAYS;
module.exports = router;
