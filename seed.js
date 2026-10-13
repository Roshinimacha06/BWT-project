// Adds sample users and groups the first time the server starts (empty database only).
// Every sample user has the password: password123
// Run manually with: npm run seed    Turn off with SEED_DEMO=false in .env
const bcrypt = require('bcryptjs');
const db = require('./db');

function run() {
  if (process.env.SEED_DEMO === 'false') return false;
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return false;

  const pw = bcrypt.hashSync('password123', 10);
  const users = [
    ['Aarav Mehta', 'aarav@campus.edu', 'B.Tech Mechanical', '2nd year', 'Was a TA for Calculus I. Happy to explain, not just solve.'],
    ['Nisha Verma', 'nisha@campus.edu', 'B.Tech CSE', '3rd year', 'Interning at a product startup this summer.'],
    ['Priya Nair', 'priya@campus.edu', 'B.Sc Chemistry', '3rd year', 'Tutoring Orgo for two semesters.'],
    ['Rahul Sharma', 'rahul@campus.edu', 'BBA', '2nd year', 'Aiming for first class honours.'],
    ['Fatima Sheikh', 'fatima@campus.edu', 'MBBS', '1st year', 'Makes the flashcards and shares the deck.'],
    ['Lucas Pereira', 'lucas@campus.edu', 'B.A. Languages', '4th year', 'Spent a year abroad in Madrid.'],
    ['Sneha Rao', 'sneha@campus.edu', 'B.Sc Physics', '1st year', ''],
    ['Kiran Das', 'kiran@campus.edu', 'B.Tech Civil', '2nd year', ''],
    ['Rohit Jain', 'rohit@campus.edu', 'B.Tech IT', '3rd year', ''],
    ['Meera Iyer', 'meera@campus.edu', 'B.Tech CSE', '2nd year', ''],
    ['Imran Khan', 'imran@campus.edu', 'B.Sc Chemistry', '2nd year', ''],
    ['Lata Menon', 'lata@campus.edu', 'BBA', '2nd year', ''],
    ['Ishaan Bose', 'ishaan@campus.edu', 'B.A. English', '2nd year', '']
  ];
  // [title, subject, description, days, start, end, mode, location, seats, leader, approved members]
  const groups = [
    ['Calculus II problem sets', 'Mathematics', 'Weekly walk-through of integration techniques and series. Bring the problem set and we solve it at the whiteboard.', 'Tue,Thu', '17:30', '19:00', 'In person', 'Central Library, Room 204, Hyderabad', 8, 'aarav@campus.edu', ['sneha@campus.edu', 'kiran@campus.edu']],
    ['Data structures interview prep', 'Computer Science', 'Two LeetCode-style problems per session, then we explain our solutions to each other.', 'Sat', '10:00', '12:00', 'Online', 'https://meet.example.com/dsa-prep', 6, 'nisha@campus.edu', ['rohit@campus.edu', 'meera@campus.edu']],
    ['Organic chemistry reaction mechanisms', 'Chemistry', 'Drawing mechanisms from memory, then checking each other. Good for first-time Orgo students.', 'Mon,Wed', '19:00', '20:30', 'In person', 'Science Block cafeteria, Hyderabad', 6, 'priya@campus.edu', ['imran@campus.edu']],
    ['Microeconomics exam revision', 'Economics', 'Past papers, graphs and elasticity drills. We rotate who teaches each topic.', 'Fri', '16:00', '17:30', 'Online', 'https://meet.example.com/micro-rev', 10, 'rahul@campus.edu', ['lata@campus.edu']],
    ['Anatomy flashcard circle', 'Medicine', 'Spaced-repetition sessions on the musculoskeletal system, with quick quizzes at the end.', 'Sun', '09:30', '11:00', 'In person', 'Medical College Library, Hyderabad', 5, 'fatima@campus.edu', []],
    ['Spoken Spanish conversation hour', 'Languages', 'Beginner to intermediate. We pick a topic each week and talk, no textbooks.', 'Wed', '18:00', '19:00', 'Online', 'https://meet.example.com/hola', 12, 'lucas@campus.edu', ['ishaan@campus.edu']]
  ];

  db.transaction(() => {
    const addUser = db.prepare('INSERT INTO users(name,email,password,course,year,bio) VALUES(?,?,?,?,?,?)');
    const id = {};
    for (const u of users) id[u[1]] = addUser.run(u[0], u[1], pw, u[2], u[3], u[4]).lastInsertRowid;

    const addGroup = db.prepare(`INSERT INTO study_groups
      (title,subject,description,days,start_time,end_time,mode,location,capacity,creator_id,creator_bio)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    const addMember = db.prepare('INSERT INTO members(group_id,user_id,message,status) VALUES(?,?,?,?)');
    for (const g of groups) {
      const bio = users.find(u => u[1] === g[9])[4];
      const gid = addGroup.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7], g[8], id[g[9]], bio).lastInsertRowid;
      for (const m of g[10]) addMember.run(gid, id[m], '', 'approved');
    }
    // One pending request so the leader has something to review on the first login.
    const g1 = db.prepare('SELECT id FROM study_groups ORDER BY id LIMIT 1').get().id;
    addMember.run(g1, id['lata@campus.edu'], 'I am stuck on series convergence tests. Can I join?', 'pending');
    db.prepare('INSERT INTO notifications(user_id,text,group_id) VALUES(?,?,?)')
      .run(id['aarav@campus.edu'], 'Lata Menon requested to join "Calculus II problem sets"', g1);
  })();

  console.log('Added sample data. Sign in with aarav@campus.edu and the password password123');
  return true;
}

module.exports = { run };
if (require.main === module) { require('dotenv').config(); run(); }
