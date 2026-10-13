# Study Group Finder (Node.js + Express)

Create study groups by subject and timing. Members request to join, and the group leader approves.

This is the full-stack version: an Express server, a SQLite database, real accounts with hashed passwords, and notifications that work between different users and devices.

## Features

- **Sign-in options:** email and password, guest access, and optional Google sign-in
- **Group creator information:** leader name, course, year and bio on every group
- **Joiner information:** name, course, year, email and a message on every request (visible to the leader)
- **Location:** a venue with a map link, or an online meeting link
- **Direct invite link:** `/#g=<id>` opens a group from any device
- **Search and filters:** search by topic, subject, venue or leader; filter by subject, day, format and open seats; sort by newest, most seats or title
- **Join and approve flow:** the leader approves or declines, seats are checked on the server
- **Notifications:** leaders are told about new requests, joiners about the decision (checked every 20 seconds)
- **My groups**, profile editing, light and dark themes, mobile layout

## Requirements

- Node.js 18 or newer (the current LTS is best): https://nodejs.org
- VS Code (optional): https://code.visualstudio.com

## Run it in VS Code

1. Open this folder in VS Code (**File, Open Folder**).
2. Open the terminal (**Ctrl+`**) and install the packages:
   ```bash
   npm install
   ```
3. Copy the settings file:
   ```bash
   cp .env.example .env        # Windows PowerShell: copy .env.example .env
   ```
   Then open `.env` and change `JWT_SECRET` to any long random text.
4. Start the server:
   ```bash
   npm start
   ```
5. Open http://localhost:3000

The first start creates `data.db` and adds sample groups. Sign in with **aarav@campus.edu** and the password **password123** to see a pending join request waiting for approval. All sample users share that password.

To start with an empty database, set `SEED_DEMO=false` in `.env` and delete `data.db`.

## Try the full flow

1. Sign in as `aarav@campus.edu`. The bell shows one request. Open it and click **Approve**.
2. Open a second browser (or a private window) and choose **Create account**.
3. Open any group, send a request to join, then switch back to the leader. The bell shows the new request within 20 seconds.
4. Approve it, then switch back to the new account. The bell shows the approval.

## Project structure

```
server.js              Starts Express and mounts the routes
db.js                  Opens SQLite and creates the tables
seed.js                Sample users and groups (first run only)
middleware/auth.js     Reads and checks the login token
routes/auth.js         Register, login, guest, Google, profile
routes/groups.js       Search, create, details, join requests, approval
routes/notifications.js  List and mark as read
public/                The web page (index.html, style.css, app.js)
```

## API

| Method | Route | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/config` | anyone | Subjects, days and options for the forms |
| POST | `/api/auth/register` | anyone | Create an account |
| POST | `/api/auth/login` | anyone | Sign in, returns a token |
| POST | `/api/auth/guest` | anyone | Guest account |
| POST | `/api/auth/google` | anyone | Google sign-in (optional) |
| GET / PATCH | `/api/auth/me` | signed in | Read or edit your profile |
| GET | `/api/groups?q=&subject=&day=&mode=&open=1&mine=1&sort=` | anyone | Search and filter |
| POST | `/api/groups` | signed in | Create a group (you become the leader) |
| GET | `/api/groups/:id` | anyone | Group details, leader and members |
| GET | `/api/groups/:id/requests` | leader | Pending requests with joiner details |
| POST | `/api/groups/:id/requests` | signed in | Request to join |
| PATCH | `/api/groups/:id/requests/:userId` | leader | Approve or decline (`{"status":"approved"}`) |
| GET | `/api/notifications` | signed in | Your notifications and unread count |
| POST | `/api/notifications/read` | signed in | Mark all as read |

Send the token as `Authorization: Bearer <token>`.

## Security notes

- Passwords are hashed with bcrypt and never returned by the API.
- Only the group leader can list, approve or decline requests; the server checks this on every call.
- The leader's email is shown only to the leader and approved members.
- All database queries use prepared statements, and the page escapes all text it displays.
- Keep `.env` out of GitHub (it is already in `.gitignore`).

## Optional: Google sign-in

1. In Google Cloud Console, create an **OAuth client ID** of type *Web application*.
2. Add `http://localhost:3000` under *Authorized JavaScript origins*.
3. Put the client ID in `.env` as `GOOGLE_CLIENT_ID=...` and restart.

A "Sign in with Google" button then appears in the sign-in window.

## Deploy

GitHub Pages cannot run a Node server. Use a host that runs Node, for example Render, Railway or Fly.io:

- Build command: `npm install`
- Start command: `npm start`
- Environment: set `JWT_SECRET`
- Note: SQLite saves to a file. On free plans that file can be erased when the service restarts. For permanent data, add a persistent disk or move to a hosted database such as PostgreSQL.

## Troubleshooting

- **`npm install` fails on better-sqlite3:** use the current Node.js LTS (Node 18 or newer). On Windows, a failed install usually means an old Node version.
- **Port already in use:** change `PORT` in `.env`.
- **Signed out after every restart:** set `JWT_SECRET` in `.env`.

## Limitations and future scope

- Notifications appear in the app; email and push alerts are not built yet.
- There is no group chat or moderation panel yet.
- Possible next steps: email alerts (Nodemailer), live updates (Socket.IO), calendar sync, ratings and a mobile app.
