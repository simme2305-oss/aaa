import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { ensureAdmin } from '../src/setup.js';

let server;
let base;

before(async () => {
  const db = openDb(':memory:');
  await ensureAdmin(db, { username: 'chef', password: 'geheim123' });
  const app = createApp({ db, appName: 'Testhütte' });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function client() {
  let cookie = '';
  return async function request(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

async function login(username, password) {
  const request = client();
  const res = await request('POST', '/api/login', { username, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return request;
}

describe('Passwortsperre', () => {
  test('ohne Login gibt es keine Daten', async () => {
    const request = client();
    assert.equal((await request('GET', '/api/events')).status, 401);
    assert.equal((await request('GET', '/api/members')).status, 401);
    assert.deepEqual((await request('GET', '/api/me')).body, { user: null });
  });

  test('falsches Passwort wird abgelehnt', async () => {
    const res = await client()('POST', '/api/login', { username: 'chef', password: 'falsch' });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /falsch/);
  });

  test('Login, Abmelden', async () => {
    const request = await login('CHEF', 'geheim123');
    const me = await request('GET', '/api/me');
    assert.equal(me.body.user.username, 'chef');
    assert.equal(me.body.user.role, 'admin');
    assert.equal(me.body.user.password_hash, undefined);
    await request('POST', '/api/logout');
    assert.equal((await request('GET', '/api/events')).status, 401);
  });

  test('fremde Seiten dürfen nichts ändern (CSRF)', async () => {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://boese.example' },
      body: JSON.stringify({ username: 'chef', password: 'geheim123' }),
    });
    assert.equal(res.status, 403);
  });

  test('Seiten-Pfade liefern die App aus', async () => {
    for (const path of ['/', '/kalender', '/mitglieder']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200);
      assert.match(await res.text(), /<div id="app">/);
    }
  });
});

describe('Mitglieder', () => {
  test('Admin fügt Person hinzu, die sich danach anmelden kann', async () => {
    const admin = await login('chef', 'geheim123');
    const created = await admin('POST', '/api/members', {
      name: 'Simon Boos',
      username: 'simon',
      password: 'start123',
      role: 'member',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Simon Boos');

    const dup = await admin('POST', '/api/members', { name: 'X', username: 'Simon', password: 'start123' });
    assert.equal(dup.status, 409);

    const simon = await login('simon', 'start123');
    const list = await simon('GET', '/api/members');
    assert.deepEqual(list.body.map((m) => m.username).sort(), ['chef', 'simon']);
  });

  test('normale Mitglieder dürfen niemanden hinzufügen', async () => {
    const simon = await login('simon', 'start123');
    const res = await simon('POST', '/api/members', { name: 'Hacker', username: 'hacker', password: 'abcdef' });
    assert.equal(res.status, 403);
  });

  test('ungültige Eingaben werden abgelehnt', async () => {
    const admin = await login('chef', 'geheim123');
    assert.equal((await admin('POST', '/api/members', { name: '', username: 'abc', password: 'abcdef' })).status, 400);
    assert.equal((await admin('POST', '/api/members', { name: 'A', username: 'a b', password: 'abcdef' })).status, 400);
    assert.equal((await admin('POST', '/api/members', { name: 'A', username: 'abc', password: '123' })).status, 400);
  });

  test('Passwort zurücksetzen meldet die Person ab', async () => {
    const admin = await login('chef', 'geheim123');
    const simon = await login('simon', 'start123');
    const { body: list } = await admin('GET', '/api/members');
    const id = list.find((m) => m.username === 'simon').id;

    assert.equal((await admin('PATCH', `/api/members/${id}`, { password: 'neu12345' })).status, 200);
    assert.equal((await simon('GET', '/api/events')).status, 401);
    await login('simon', 'neu12345');
  });

  test('der letzte Admin bleibt Admin und kann sich nicht selbst löschen', async () => {
    const admin = await login('chef', 'geheim123');
    const { body: me } = await admin('GET', '/api/me');
    const demote = await admin('PATCH', `/api/members/${me.user.id}`, { role: 'member' });
    assert.equal(demote.status, 400);
    assert.equal((await admin('DELETE', `/api/members/${me.user.id}`)).status, 400);
  });

  test('eigenes Passwort ändern', async () => {
    const simon = await login('simon', 'neu12345');
    const wrong = await simon('POST', '/api/me/password', { currentPassword: 'falsch', newPassword: 'abcdef' });
    assert.equal(wrong.status, 400);
    const ok = await simon('POST', '/api/me/password', { currentPassword: 'neu12345', newPassword: 'meins123' });
    assert.equal(ok.status, 200);
    assert.equal((await simon('GET', '/api/me')).body.user.username, 'simon');
    await login('simon', 'meins123');
  });
});

describe('Kalender', () => {
  test('Events anlegen, ändern und löschen mit Rechten', async () => {
    const admin = await login('chef', 'geheim123');
    const simon = await login('simon', 'meins123');

    const created = await simon('POST', '/api/events', {
      title: 'Hütte',
      date: '2026-10-10',
      time: '19:00',
      location: 'Ebenweiler Hütte',
      description: 'Hütte bald',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.created_by_name, 'Simon Boos');

    const adminEvent = await admin('POST', '/api/events', { title: 'Grillen', date: '2026-10-03', time: '' });
    assert.equal(adminEvent.body.time, null);

    const { body: events } = await simon('GET', '/api/events');
    assert.deepEqual(events.map((e) => e.title), ['Grillen', 'Hütte']);

    // Simon darf das Event vom Admin nicht ändern, der Admin darf alles.
    assert.equal((await simon('DELETE', `/api/events/${adminEvent.body.id}`)).status, 403);
    const edited = await admin('PUT', `/api/events/${created.body.id}`, { ...created.body, title: 'Hüttenabend' });
    assert.equal(edited.body.title, 'Hüttenabend');
    assert.equal((await simon('DELETE', `/api/events/${created.body.id}`)).status, 200);
  });

  test('ungültige Daten werden abgelehnt', async () => {
    const admin = await login('chef', 'geheim123');
    assert.equal((await admin('POST', '/api/events', { title: '', date: '2026-10-10' })).status, 400);
    assert.equal((await admin('POST', '/api/events', { title: 'A', date: '2026-02-30' })).status, 400);
    assert.equal((await admin('POST', '/api/events', { title: 'A', date: '2026-10-10', time: '25:00' })).status, 400);
  });
});
