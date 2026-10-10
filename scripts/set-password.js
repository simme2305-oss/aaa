// Setzt das Passwort eines Mitglieds neu – z. B. wenn der Admin sein Passwort vergessen hat.
// Aufruf: npm run passwort -- <benutzername> <neues-passwort>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth.js';
import { openDb } from '../src/db.js';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Aufruf: npm run passwort -- <benutzername> <neues-passwort>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Das Passwort muss mindestens 6 Zeichen haben.');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = openDb(path.join(path.resolve(process.env.DATA_DIR || path.join(root, 'data')), 'app.db'));
const user = db.prepare('SELECT id, name FROM users WHERE username = ?').get(username.toLowerCase());
if (!user) {
  const names = db.prepare('SELECT username FROM users ORDER BY username').all().map((u) => u.username);
  console.error(`Benutzer "${username}" gibt es nicht. Vorhanden: ${names.join(', ') || '(keine)'}`);
  process.exit(1);
}

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
console.log(`Passwort für ${user.name} (${username}) wurde geändert.`);
