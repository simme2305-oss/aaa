import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLimiter, hashPassword, hashToken, newToken, verifyPassword } from './auth.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const COOKIE = 'sid';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

// ---------- Eingaben prüfen ----------

function text(value, { label, max, required = false }) {
  const str = typeof value === 'string' ? value.trim() : '';
  if (required && !str) fail(400, `Bitte gib ${label} ein.`);
  if (str.length > max) fail(400, `${label[0].toUpperCase()}${label.slice(1)} ist zu lang (max. ${max} Zeichen).`);
  return str;
}

function readName(value) {
  return text(value, { label: 'einen Namen', max: 60, required: true });
}

function readUsername(value) {
  const username = text(value, { label: 'einen Benutzernamen', max: 32, required: true }).toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    fail(400, 'Der Benutzername braucht 3–32 Zeichen: Kleinbuchstaben, Zahlen, Punkt, Minus oder Unterstrich.');
  }
  return username;
}

function readPassword(value, label = 'Das Passwort') {
  if (typeof value !== 'string' || value.length < 6) fail(400, `${label} muss mindestens 6 Zeichen haben.`);
  if (value.length > 200) fail(400, `${label} ist zu lang.`);
  return value;
}

function readRole(value) {
  if (value !== 'admin' && value !== 'member') fail(400, 'Ungültige Rolle.');
  return value;
}

function readDate(value) {
  const str = typeof value === 'string' ? value : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (match) {
    const [y, m, d] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) return str;
  }
  fail(400, 'Bitte wähle ein gültiges Datum.');
}

function readTime(value) {
  if (value == null || value === '') return null;
  const str = String(value).slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(str)) fail(400, 'Bitte gib eine gültige Uhrzeit ein.');
  return str;
}

function readEvent(body) {
  return {
    title: text(body.title, { label: 'einen Titel', max: 100, required: true }),
    date: readDate(body.date),
    time: readTime(body.time),
    location: text(body.location, { label: 'der Ort', max: 100 }) || null,
    description: text(body.description, { label: 'die Beschreibung', max: 1000 }) || null,
  };
}

function readId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(404, 'Nicht gefunden.');
  return id;
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------- App ----------

export function createApp({ db, appName, trustProxy = 'loopback, linklocal, uniquelocal' }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  const q = {
    sessionUser: db.prepare(`
      SELECT u.id, u.name, u.username, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`),
    createSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    deleteOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
    deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),

    userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    userWithHash: db.prepare('SELECT * FROM users WHERE id = ?'),
    member: db.prepare('SELECT id, name, username, role, created_at FROM users WHERE id = ?'),
    members: db.prepare(`
      SELECT id, name, username, role, created_at FROM users
      ORDER BY role = 'admin' DESC, name COLLATE NOCASE`),
    adminCount: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`),
    usernameTaken: db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?'),
    insertUser: db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'),
    updateUser: db.prepare('UPDATE users SET name = ?, username = ?, role = ? WHERE id = ?'),
    updateName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

    events: db.prepare(`
      SELECT e.id, e.title, e.date, e.time, e.location, e.description, e.created_by,
             u.name AS created_by_name
      FROM events e LEFT JOIN users u ON u.id = e.created_by
      ORDER BY e.date, COALESCE(e.time, ''), e.id`),
    event: db.prepare(`
      SELECT e.id, e.title, e.date, e.time, e.location, e.description, e.created_by,
             u.name AS created_by_name
      FROM events e LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = ?`),
    insertEvent: db.prepare(`
      INSERT INTO events (title, date, time, location, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?)`),
    updateEvent: db.prepare(`
      UPDATE events SET title = ?, date = ?, time = ?, location = ?, description = ? WHERE id = ?`),
    deleteEvent: db.prepare('DELETE FROM events WHERE id = ?'),
  };

  const ipLimiter = createLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
  const userLimiter = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  let dummyHash;

  function startSession(req, res, userId) {
    const token = newToken();
    q.deleteExpiredSessions.run(Date.now());
    q.createSession.run(hashToken(token), userId, Date.now() + SESSION_MS);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: SESSION_MS,
      path: '/',
    });
  }

  const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Bitte melde dich an.' });
    next();
  };

  const requireAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Bitte melde dich an.' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins.' });
    next();
  };

  // ---------- Middleware ----------

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
    });
    next();
  });

  app.use('/api', express.json({ limit: '50kb' }));

  // Schreibende Anfragen nur von der eigenen Seite (Schutz gegen CSRF).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.get('origin');
    if (!origin) return next();
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {}
    if (host && (host === req.get('host') || host === req.get('x-forwarded-host'))) return next();
    res.status(403).json({ error: 'Ungültige Anfrage.' });
  });

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const token = readCookie(req, COOKIE);
    if (token) {
      req.sessionHash = hashToken(token);
      req.user = q.sessionUser.get(req.sessionHash, Date.now()) ?? null;
    }
    next();
  });

  // ---------- Öffentlich ----------

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ appName }));

  app.post('/api/login', async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) fail(400, 'Bitte Benutzername und Passwort eingeben.');

    const ipKey = `ip:${req.ip}`;
    const userKey = `user:${username}`;
    if (ipLimiter.blocked(ipKey) || userLimiter.blocked(userKey)) {
      fail(429, 'Zu viele Fehlversuche. Bitte warte 15 Minuten.');
    }

    const user = q.userByUsername.get(username);
    dummyHash ??= await hashPassword(newToken());
    const ok = await verifyPassword(password, user?.password_hash ?? dummyHash);
    if (!user || !ok) {
      ipLimiter.fail(ipKey);
      userLimiter.fail(userKey);
      fail(401, 'Benutzername oder Passwort falsch.');
    }

    userLimiter.reset(userKey);
    startSession(req, res, user.id);
    res.json({ user: q.member.get(user.id) });
  });

  app.post('/api/logout', (req, res) => {
    if (req.sessionHash) q.deleteSession.run(req.sessionHash);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ user: req.user ? q.member.get(req.user.id) : null });
  });

  // ---------- Eigenes Profil ----------

  app.patch('/api/me', requireAuth, (req, res) => {
    q.updateName.run(readName(req.body?.name), req.user.id);
    res.json({ user: q.member.get(req.user.id) });
  });

  app.post('/api/me/password', requireAuth, async (req, res) => {
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const next = readPassword(req.body?.newPassword, 'Das neue Passwort');
    const user = q.userWithHash.get(req.user.id);
    if (!(await verifyPassword(current, user.password_hash))) fail(400, 'Das aktuelle Passwort stimmt nicht.');
    q.updatePassword.run(await hashPassword(next), user.id);
    q.deleteOtherSessions.run(user.id, req.sessionHash);
    res.json({ ok: true });
  });

  // ---------- Mitglieder ----------

  app.get('/api/members', requireAuth, (req, res) => {
    res.json(q.members.all());
  });

  app.post('/api/members', requireAdmin, async (req, res) => {
    const name = readName(req.body?.name);
    const username = readUsername(req.body?.username);
    const password = readPassword(req.body?.password);
    const role = readRole(req.body?.role ?? 'member');
    if (q.usernameTaken.get(username, 0)) fail(409, 'Dieser Benutzername ist schon vergeben.');
    const { lastInsertRowid } = q.insertUser.run(name, username, await hashPassword(password), role);
    res.status(201).json(q.member.get(lastInsertRowid));
  });

  app.patch('/api/members/:id', requireAdmin, async (req, res) => {
    const id = readId(req.params.id);
    const member = q.member.get(id);
    if (!member) fail(404, 'Mitglied nicht gefunden.');

    const body = req.body ?? {};
    const name = body.name === undefined ? member.name : readName(body.name);
    const username = body.username === undefined ? member.username : readUsername(body.username);
    const role = body.role === undefined ? member.role : readRole(body.role);
    const password = body.password ? readPassword(body.password) : null;

    if (q.usernameTaken.get(username, id)) fail(409, 'Dieser Benutzername ist schon vergeben.');
    if (member.role === 'admin' && role !== 'admin' && q.adminCount.get().n <= 1) {
      fail(400, 'Es muss mindestens einen Admin geben.');
    }

    q.updateUser.run(name, username, role, id);
    if (password) {
      q.updatePassword.run(await hashPassword(password), id);
      if (id === req.user.id) q.deleteOtherSessions.run(id, req.sessionHash);
      else q.deleteUserSessions.run(id);
    }
    res.json(q.member.get(id));
  });

  app.delete('/api/members/:id', requireAdmin, (req, res) => {
    const id = readId(req.params.id);
    if (id === req.user.id) fail(400, 'Du kannst dich nicht selbst entfernen.');
    if (!q.member.get(id)) fail(404, 'Mitglied nicht gefunden.');
    q.deleteUser.run(id);
    res.json({ ok: true });
  });

  // ---------- Kalender ----------

  const canEdit = (user, event) => user.role === 'admin' || event.created_by === user.id;

  app.get('/api/events', requireAuth, (req, res) => {
    res.json(q.events.all());
  });

  app.post('/api/events', requireAuth, (req, res) => {
    const e = readEvent(req.body ?? {});
    const { lastInsertRowid } = q.insertEvent.run(e.title, e.date, e.time, e.location, e.description, req.user.id);
    res.status(201).json(q.event.get(lastInsertRowid));
  });

  app.put('/api/events/:id', requireAuth, (req, res) => {
    const id = readId(req.params.id);
    const existing = q.event.get(id);
    if (!existing) fail(404, 'Event nicht gefunden.');
    if (!canEdit(req.user, existing)) fail(403, 'Nur wer das Event erstellt hat oder ein Admin darf es ändern.');
    const e = readEvent(req.body ?? {});
    q.updateEvent.run(e.title, e.date, e.time, e.location, e.description, id);
    res.json(q.event.get(id));
  });

  app.delete('/api/events/:id', requireAuth, (req, res) => {
    const id = readId(req.params.id);
    const existing = q.event.get(id);
    if (!existing) fail(404, 'Event nicht gefunden.');
    if (!canEdit(req.user, existing)) fail(403, 'Nur wer das Event erstellt hat oder ein Admin darf es löschen.');
    q.deleteEvent.run(id);
    res.json({ ok: true });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));

  // ---------- Frontend ----------

  app.use(express.static(PUBLIC_DIR, { index: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));

  // Alle Seiten-Pfade (/, /kalender, /mitglieder, ...) liefern die App aus.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path)) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) console.error(err);
    const message =
      err instanceof HttpError ? err.message : status === 400 ? 'Ungültige Anfrage.' : 'Etwas ist schiefgelaufen.';
    res.status(status).json({ error: message });
  });

  return app;
}
