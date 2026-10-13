'use strict';
// Study Group Finder: front end. Talks to the Express server through /api.

const TK = 'sgf-token';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
const ini = n => (n || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const isUrl = s => /^https?:\/\//.test(s);
const mapLink = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const when = g => g.days.join(', ') + ' · ' + fmt(g.start_time) + ' to ' + fmt(g.end_time);
const showEmail = e => (!e || /@guest\.local$/.test(e)) ? 'Guest account' : e;
const inviteLink = g => location.origin + location.pathname + '#g=' + g.id;
const ago = s => {
  const m = Math.round((Date.now() - new Date(String(s).replace(' ', 'T') + 'Z').getTime()) / 60000);
  return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
};

let CFG = { subjects: [], days: [], years: [], googleClientId: '' };
let S = { user: null, tab: 'all', notes: [], unread: 0 };
let after = null, seq = 0;

/* ---------- server calls ---------- */
async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem(TK);
  if (t) headers.Authorization = 'Bearer ' + t;
  const r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let d = {};
  try { d = await r.json(); } catch (e) { /* empty body */ }
  if (!r.ok) {
    if (r.status === 401 && t && S.user) logout(true);
    throw new Error(d.error || 'Something went wrong');
  }
  return d;
}

/* ---------- small UI helpers ---------- */
function toast(t) {
  const e = $('#toast'); e.textContent = t; e.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 2800);
}
function open(html) {
  $('#sheet').innerHTML = html; $('#ov').classList.add('on'); $('#sheet').scrollTop = 0;
  const f = $('#sheet form input') || $('#sheet button'); if (f) f.focus({ preventScroll: true });
}
function close() {
  $('#ov').classList.remove('on');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
const closeBtn = '<button class="btn g sm x" data-act="close" aria-label="Close">Close</button>';

function auth() {
  $('#auth').innerHTML = S.user
    ? `<div class="who"><button class="btn g sm bell" data-act="bell" aria-label="Notifications, ${S.unread} unread">🔔${S.unread ? `<span class="dot">${S.unread}</span>` : ''}</button>
       <button class="btn g sm" data-act="profile" title="Edit profile"><span class="av" style="width:24px;height:24px;font-size:11px">${esc(ini(S.user.name))}</span>${esc(S.user.name)}</button>
       <button class="btn g sm" data-act="signout">Sign out</button></div>`
    : '<button class="btn p" data-act="signin">Sign in</button>';
}

function logout(expired) {
  localStorage.removeItem(TK); S.user = null; S.notes = []; S.unread = 0;
  auth(); loadGroups();
  toast(expired ? 'Your session ended. Please sign in again.' : 'Signed out');
}

/* ---------- group list ---------- */
function badge(g) {
  if (g.my_status === 'leader') return `<span class="chip ok">You lead this${g.pending_count ? ' · ' + g.pending_count + ' pending' : ''}</span>`;
  if (g.my_status === 'approved') return '<span class="chip ok">Joined</span>';
  if (g.my_status === 'pending') return '<span class="chip warn">Request pending</span>';
  if (g.my_status === 'declined') return '<span class="chip bad">Declined</span>';
  return '';
}
function card(g) {
  const n = g.seats_left;
  return `<div class="card" tabindex="0" role="button" data-act="open" data-id="${g.id}">
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="chip">${esc(g.subject)}</span>${badge(g)}</div>
  <h3>${esc(g.title)}</h3><p>${esc(g.description)}</p>
  <div class="line">🕒 <span>${esc(when(g))}</span></div>
  <div class="line">📍 <span>${esc(g.mode)}: ${isUrl(g.location) ? 'Meeting link' : esc(g.location)}</span></div>
  <div class="foot"><span>Led by ${esc(g.creator.name)}</span><b style="color:${n > 0 ? 'var(--ok)' : 'var(--bad)'}">${n > 0 ? n + ' seat' + (n > 1 ? 's' : '') + ' left' : 'Full'}</b></div></div>`;
}

async function loadGroups() {
  const id = ++seq;
  const p = new URLSearchParams();
  const q = $('#q').value.trim(); if (q) p.set('q', q);
  [['fs', 'subject'], ['fd', 'day'], ['fm', 'mode'], ['fo', 'sort']].forEach(([el, key]) => { const v = $('#' + el).value; if (v) p.set(key, v); });
  if ($('#fa').checked) p.set('open', '1');
  if (S.tab === 'mine') p.set('mine', '1');
  try {
    const list = await api('/groups?' + p.toString());
    if (id !== seq) return;
    $('#count').textContent = list.length + (list.length === 1 ? ' group' : ' groups');
    $('#grid').innerHTML = list.length ? list.map(card).join('')
      : `<div class="empty"><h3>${S.tab === 'mine' ? (S.user ? 'You have no groups yet' : 'Sign in to see your groups') : 'No groups match these filters'}</h3><p>${S.tab === 'mine' ? 'Create a group or request to join one from Discover.' : 'Clear a filter or create the group you are looking for.'}</p></div>`;
  } catch (e) {
    $('#grid').innerHTML = `<div class="empty"><h3>Could not load groups</h3><p>${esc(e.message)}</p></div>`;
  }
}

/* ---------- group page ---------- */
async function detail(id) {
  let g, reqs = [];
  try { g = await api('/groups/' + id); } catch (e) { toast(e.message); return; }
  if (g.my_status === 'leader') { try { reqs = await api('/groups/' + id + '/requests'); } catch (e) { /* ignore */ } }
  const lead = g.my_status === 'leader', n = g.seats_left, c = g.creator;
  let act;
  if (lead) act = '<p class="note">You are the leader of this group.</p>';
  else if (g.my_status) act = `<p><b>Your request:</b> ${g.my_status === 'approved' ? '<span class="chip ok">Approved. You are in.</span>' : g.my_status === 'pending' ? '<span class="chip warn">Waiting for the leader to approve</span>' : '<span class="chip bad">Declined by the leader</span>'}</p>`;
  else if (n <= 0) act = '<p><span class="chip bad">This group is full</span></p>';
  else if (!S.user) act = `<button class="btn p" data-act="signin-join" data-id="${g.id}">Sign in to request to join</button>`;
  else act = `<form id="jF" data-id="${g.id}"><p class="note">The leader will see: <b>${esc(S.user.name)}</b>, ${esc(S.user.course || 'course not set')}${S.user.year ? ', ' + esc(S.user.year) : ''}${/@guest\.local$/.test(S.user.email) ? '' : ', ' + esc(S.user.email)}. <a href="#" data-act="profile">Edit profile</a></p>
    <label for="jm">Message to the leader (optional)</label><textarea class="in" id="jm" rows="3" maxlength="300" placeholder="What do you want to cover? Which topics are you stuck on?"></textarea><button class="btn p" style="margin-top:10px">Request to join</button></form>`;
  const reqHtml = lead && reqs.length ? `<div class="sec"><h3>Requests to review (${reqs.length})</h3>${reqs.map(m => `<div class="req"><div class="mem"><span class="av">${esc(ini(m.name))}</span><div><b>${esc(m.name)}</b><br><span class="note">${esc(m.course || 'Course not set')} · ${esc(m.year || '')} · ${esc(showEmail(m.email))}</span></div></div>${m.message ? `<p style="margin:4px 0 8px">“${esc(m.message)}”</p>` : ''}<button class="btn p sm" data-act="ok" data-id="${g.id}" data-u="${m.id}">Approve</button> <button class="btn g sm" data-act="no" data-id="${g.id}" data-u="${m.id}">Decline</button></div>`).join('')}</div>` : '';
  open(`${closeBtn}<span class="chip">${esc(g.subject)}</span><h2 style="margin-top:8px">${esc(g.title)}</h2><p style="color:var(--muted);margin:6px 0 0">${esc(g.description)}</p>
  <div class="sec"><h3>When and where</h3><div class="line">🕒 <span>${esc(when(g))}</span></div>
  <div class="line" style="margin-top:6px">📍 <span>${esc(g.mode)}: ${isUrl(g.location) ? `<a href="${esc(g.location)}" target="_blank" rel="noopener noreferrer">Open meeting link</a>` : `${esc(g.location)} · <a href="${mapLink(g.location)}" target="_blank" rel="noopener noreferrer">View on map</a>`}</span></div>
  <div class="line" style="margin-top:6px">👥 <span>${n > 0 ? n + ' of ' + g.capacity + ' seats open' : 'Full'}</span></div></div>
  <div class="sec"><h3>Group leader</h3><div class="mem"><span class="av">${esc(ini(c.name))}</span><div><b>${esc(c.name)}</b><br><span class="note">${esc(c.course || 'Course not set')}${c.year ? ' · ' + esc(c.year) : ''}</span></div></div>${c.bio ? `<p style="margin:4px 0 0">${esc(c.bio)}</p>` : ''}${c.email ? `<p class="note">Contact: ${esc(showEmail(c.email))}</p>` : '<p class="note">Contact details are shown once you are approved.</p>'}</div>
  <div class="sec"><h3>Members (${g.members.length + 1})</h3><div class="mem"><span class="av">${esc(ini(c.name))}</span><span>${esc(c.name)} <span class="chip">Leader</span></span></div>${g.members.map(m => `<div class="mem"><span class="av">${esc(ini(m.name))}</span><span>${esc(m.name)}<br><span class="note">${esc(m.course || '')}${m.year ? ' · ' + esc(m.year) : ''}</span></span></div>`).join('')}</div>
  ${reqHtml}
  <div class="sec"><h3>Direct invite link</h3><div class="invite"><input class="in" id="il" readonly value="${esc(inviteLink(g))}" aria-label="Invite link"><button class="btn p" data-act="copy" data-id="${g.id}">Copy</button></div><p class="note">Anyone with the link lands on this group and can request to join.</p></div>
  <div class="sec"><h3>Join this group</h3>${act}</div>`);
}

function createForm() {
  open(`${closeBtn}<h2>Create a study group</h2><p class="note">You will be the group leader and approve who joins.</p>
  <form id="cF"><label for="ct">Group title</label><input class="in" id="ct" required maxlength="70" placeholder="e.g. Linear algebra weekly review">
  <label for="cs">Subject</label><select class="in" id="cs">${CFG.subjects.map(s => `<option>${esc(s)}</option>`).join('')}</select>
  <label for="cd">What will you study?</label><textarea class="in" id="cd" rows="3" required maxlength="300"></textarea>
  <label>Days</label><div class="days">${CFG.days.map(d => `<label><input type="checkbox" name="day" value="${d}"> ${d}</label>`).join('')}</div>
  <div class="two"><div><label for="c1">Starts</label><input class="in" id="c1" type="time" value="18:00" required></div><div><label for="c2">Ends</label><input class="in" id="c2" type="time" value="19:30" required></div></div>
  <div class="two"><div><label for="cm">Format</label><select class="in" id="cm"><option>In person</option><option>Online</option></select></div><div><label for="cp">Seats (including you)</label><input class="in" id="cp" type="number" min="2" max="50" value="6" required></div></div>
  <label for="cl">Venue and city, or meeting link</label><input class="in" id="cl" required maxlength="200" placeholder="Library Room 3, Hyderabad, or https://meet…">
  <label for="cb">About you (shown to joiners)</label><input class="in" id="cb" maxlength="140" value="${esc(S.user ? S.user.bio : '')}" placeholder="e.g. Aced this course last year">
  <button class="btn p" style="width:100%;margin-top:16px">Create group</button></form>`);
}

/* ---------- sign in, profile, notifications ---------- */
function signin(cb) { after = cb || null; showAuth('login'); }
function showAuth(mode) {
  const full = mode !== 'login', pw = mode !== 'guest';
  open(`${closeBtn}<h2>${mode === 'register' ? 'Create account' : mode === 'guest' ? 'Continue as guest' : 'Sign in'}</h2>
  <div class="methods sp">${[['login', 'Sign in'], ['register', 'Create account'], ['guest', 'Guest']].map(([k, l]) => `<button type="button" class="btn" data-act="amode" data-v="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}</div>
  <form id="aF" data-mode="${mode}">
  ${full ? '<label for="an">Full name</label><input class="in" id="an" required maxlength="60" autocomplete="name">' : ''}
  ${pw ? '<label for="ae">Email</label><input class="in" id="ae" type="email" required autocomplete="email">' : ''}
  ${pw ? `<label for="ap">Password</label><input class="in" id="ap" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">` : ''}
  ${full ? `<div class="two"><div><label for="ac">Course</label><input class="in" id="ac" maxlength="60" placeholder="e.g. B.Tech CSE"></div><div><label for="ay">Year</label><select class="in" id="ay">${CFG.years.map(y => `<option>${esc(y)}</option>`).join('')}</select></div></div>` : ''}
  <button class="btn p" style="width:100%;margin-top:16px">${mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Continue as guest'}</button></form>
  ${CFG.googleClientId ? '<p class="note" style="text-align:center">or</p><div id="gbtn" style="display:flex;justify-content:center"></div>' : ''}
  <p class="note">${mode === 'login' ? 'Sample data: sign in as <b>aarav@campus.edu</b> with the password <b>password123</b>.' : mode === 'guest' ? 'A guest account has no email, so you cannot sign back in to it later.' : 'Your password is stored securely as a hash.'}</p>`);
  if (CFG.googleClientId) renderGoogle();
}

function renderGoogle() {
  const go = () => {
    if (!window.google || !$('#gbtn')) return;
    google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: async r => {
      try { await onAuth(await api('/auth/google', 'POST', { credential: r.credential })); } catch (e) { toast(e.message); }
    } });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', width: 280 });
  };
  if (window.google) return go();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = go;
  document.head.appendChild(s);
}

async function onAuth(d) {
  localStorage.setItem(TK, d.token); S.user = d.user; auth();
  await refreshNotes(); await loadGroups();
  toast(S.unread ? `Signed in. You have ${S.unread} new notification${S.unread > 1 ? 's' : ''}` : 'Signed in as ' + S.user.name);
  const cb = after; after = null; if (cb) cb(); else close();
}

function profileForm() {
  const u = S.user;
  open(`${closeBtn}<h2>Your profile</h2><p class="note">Leaders see this when you request to join. ${/@guest\.local$/.test(u.email) ? '' : 'Signed in as ' + esc(u.email) + '.'}</p>
  <form id="pF"><label for="pc">Course</label><input class="in" id="pc" maxlength="60" value="${esc(u.course)}" placeholder="e.g. B.Tech CSE">
  <label for="py">Year</label><select class="in" id="py"><option value="">Not set</option>${CFG.years.map(y => `<option ${y === u.year ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select>
  <label for="pb">About you</label><input class="in" id="pb" maxlength="140" value="${esc(u.bio)}" placeholder="One line about you">
  <button class="btn p" style="width:100%;margin-top:16px">Save profile</button></form>`);
}

async function refreshNotes() {
  if (!S.user) { S.notes = []; S.unread = 0; auth(); return; }
  try {
    const d = await api('/notifications');
    const more = refreshNotes.ready && d.unread > S.unread;
    S.notes = d.notifications; S.unread = d.unread; refreshNotes.ready = true;
    auth();
    if (more) toast('You have a new notification');
  } catch (e) { /* offline or signed out: ignore */ }
}

async function bellPanel() {
  await refreshNotes();
  const a = S.notes;
  open(`${closeBtn}<h2>Notifications</h2>${a.length ? a.map(n => `<button class="nt ${n.is_read ? '' : 'u'}" data-act="note" data-id="${n.group_id}">${esc(n.text)}<small>${ago(n.created_at)}</small></button>`).join('') : '<p class="note">Nothing yet. You will see join requests here if you lead a group, and approval updates if you have asked to join one.</p>'}`);
  if (S.unread) { try { await api('/notifications/read', 'POST'); S.unread = 0; auth(); } catch (e) { /* ignore */ } }
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  if (e.target.id === 'ov') { close(); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === 'profile') { e.preventDefault(); if (S.user) profileForm(); return; }
  try {
    if (a === 'tab') {
      S.tab = t.dataset.v; document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b === t));
      if (S.tab === 'mine' && !S.user) signin(() => loadGroups());
      await loadGroups();
    } else if (a === 'open') { history.replaceState(null, '', '#g=' + id); detail(id); }
    else if (a === 'close') close();
    else if (a === 'signin') signin();
    else if (a === 'signout') logout(false);
    else if (a === 'amode') showAuth(t.dataset.v);
    else if (a === 'bell') bellPanel();
    else if (a === 'note') { history.replaceState(null, '', '#g=' + id); detail(id); }
    else if (a === 'signin-join') signin(() => detail(id));
    else if (a === 'create') { if (S.user) createForm(); else signin(createForm); }
    else if (a === 'copy') {
      const link = $('#il').value;
      try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
      catch (err) { $('#il').select(); toast('Press Ctrl+C to copy'); }
    } else if (a === 'ok' || a === 'no') {
      const r = await api(`/groups/${id}/requests/${t.dataset.u}`, 'PATCH', { status: a === 'ok' ? 'approved' : 'declined' });
      toast('Request ' + r.status); await detail(id); loadGroups();
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') close();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button:not([type=button])'), v = x => ($('#' + x) || {}).value || '';
  if (btn) btn.disabled = true;
  try {
    if (f.id === 'aF') {
      const m = f.dataset.mode;
      const body = m === 'login' ? { email: v('ae'), password: v('ap') }
        : m === 'register' ? { name: v('an'), email: v('ae'), password: v('ap'), course: v('ac'), year: v('ay') }
        : { name: v('an'), course: v('ac'), year: v('ay') };
      await onAuth(await api('/auth/' + m, 'POST', body));
    } else if (f.id === 'jF') {
      await api(`/groups/${f.dataset.id}/requests`, 'POST', { message: v('jm') });
      toast('Request sent'); await detail(f.dataset.id); loadGroups();
    } else if (f.id === 'cF') {
      const days = [...f.querySelectorAll('[name=day]:checked')].map(x => x.value);
      if (!days.length) { toast('Pick at least one day'); return; }
      const r = await api('/groups', 'POST', { title: v('ct'), subject: v('cs'), description: v('cd'), days, start_time: v('c1'), end_time: v('c2'),
        mode: v('cm'), location: v('cl'), capacity: Number(v('cp')), creator_bio: v('cb') });
      S.tab = 'all'; document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === 'all'));
      await loadGroups(); history.replaceState(null, '', '#g=' + r.id); await detail(r.id); toast('Group created');
    } else if (f.id === 'pF') {
      S.user = (await api('/auth/me', 'PATCH', { course: v('pc'), year: v('py'), bio: v('pb') })).user;
      auth(); toast('Profile saved'); close();
    }
  } catch (err) { toast(err.message); }
  finally { if (btn) btn.disabled = false; }
});

let debounce;
$('#q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(loadGroups, 250); });
['fs', 'fd', 'fm', 'fo', 'fa'].forEach(i => $('#' + i).addEventListener('change', loadGroups));

const hash = () => { const m = location.hash.match(/^#g=(\d+)$/); if (m) detail(m[1]); };
window.addEventListener('hashchange', hash);
setInterval(refreshNotes, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshNotes(); loadGroups(); } });

/* ---------- start ---------- */
(async function init() {
  try { CFG = await api('/config'); } catch (e) { toast('Cannot reach the server. Is it running?'); }
  $('#fs').innerHTML = '<option value="">All subjects</option>' + CFG.subjects.map(s => `<option>${esc(s)}</option>`).join('');
  $('#fd').innerHTML = '<option value="">Any day</option>' + CFG.days.map(s => `<option>${esc(s)}</option>`).join('');
  if (localStorage.getItem(TK)) {
    try { S.user = (await api('/auth/me')).user; } catch (e) { localStorage.removeItem(TK); }
  }
  auth();
  await Promise.all([loadGroups(), refreshNotes()]);
  hash();
})();
