import { generatePassword, hashPassword } from './auth.js';

// Legt beim allerersten Start den Admin-Zugang an.
export async function ensureAdmin(db, { username, password, name = 'Admin' } = {}) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return null;

  username = (username || 'admin').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('ADMIN_USERNAME: 3–32 Zeichen, nur Kleinbuchstaben, Zahlen, Punkt, Minus oder Unterstrich.');
  }
  const generated = !password;
  if (generated) password = generatePassword(12);
  if (password.length < 6) throw new Error('ADMIN_PASSWORD muss mindestens 6 Zeichen haben.');

  db.prepare(`INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')`).run(
    name,
    username,
    await hashPassword(password),
  );
  return { username, password, generated };
}
