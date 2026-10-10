import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';
import { openDb } from './src/db.js';
import { ensureAdmin } from './src/setup.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const db = openDb(path.join(dataDir, 'app.db'));

const admin = await ensureAdmin(db, {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD,
});
if (admin) {
  console.log('\n  Admin-Zugang wurde angelegt:');
  console.log(`    Benutzername: ${admin.username}`);
  if (admin.generated) console.log(`    Passwort:     ${admin.password}   (bitte notieren und nach dem Login ändern)`);
  else console.log('    Passwort:     (aus ADMIN_PASSWORD)');
  console.log('');
}

const app = createApp({
  db,
  appName: process.env.APP_NAME || 'Bude Ebenweiler',
  ...(process.env.TRUST_PROXY && { trustProxy: process.env.TRUST_PROXY }),
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`  Website läuft auf http://localhost:${port}`);
});
