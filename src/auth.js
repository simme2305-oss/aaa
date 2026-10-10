import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Ohne leicht verwechselbare Zeichen (0/O, 1/l/I), damit man es gut abtippen kann.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 10) {
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 256 - (256 % ALPHABET.length)) out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

// Zählt Fehlversuche pro Schlüssel (IP oder Benutzername) in einem Zeitfenster.
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const prune = (now) => {
    for (const [key, entry] of hits) if (now - entry.start > windowMs) hits.delete(key);
  };
  return {
    blocked(key) {
      const entry = hits.get(key);
      if (!entry) return false;
      if (Date.now() - entry.start > windowMs) {
        hits.delete(key);
        return false;
      }
      return entry.count >= max;
    },
    fail(key) {
      const now = Date.now();
      if (hits.size > 5000) prune(now);
      const entry = hits.get(key);
      if (!entry || now - entry.start > windowMs) hits.set(key, { count: 1, start: now });
      else entry.count++;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
