// Opens the SQLite database file and creates the tables if they do not exist.
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_FILE || path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '',
  course TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'email',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS study_groups(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  days TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  mode TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_bio TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS members(
  group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(group_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  group_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
`);

module.exports = db;
