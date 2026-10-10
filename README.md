# Bude Ebenweiler – Gruppen-Website

Eine Website für eure Gruppe mit **Kalender**, **Admin-Login** und **Passwortsperre**.
Aufbau und Design orientieren sich an der Lovable-Seite (dunkles Grün, Karten, Navigation unten).

## Funktionen

- **Passwortsperre:** Ohne Login sieht man nur die Anmeldeseite. Es gibt keine öffentliche Registrierung.
- **Admin-Login:** Admins können unter **Mitglieder** neue Leute hinzufügen, Namen und Rollen ändern,
  Passwörter zurücksetzen und Leute entfernen. Nach dem Anlegen zeigt die Seite die Zugangsdaten an,
  die man mit einem Klick kopieren und z. B. per WhatsApp weiterschicken kann.
- **Kalender & Events:** Monatsansicht, Tage mit Events sind markiert, Liste „Kommende Events“.
  Alle Mitglieder können Events erstellen. Ändern oder löschen darf ein Event nur, wer es erstellt hat, oder ein Admin.
- **Übersicht:** Die nächsten Termine und die Mitglieder auf einen Blick.
- **Profil:** Jede Person kann ihren Namen und ihr Passwort selbst ändern.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.13.

```bash
npm install
cp .env.example .env     # Admin-Name und Passwort in .env eintragen
npm start
```

Danach läuft die Seite auf <http://localhost:3000>.

Beim **allerersten Start** wird der Admin-Zugang aus `ADMIN_USERNAME` und `ADMIN_PASSWORD` angelegt.
Fehlt `ADMIN_PASSWORD`, wird ein zufälliges Passwort erzeugt und im Terminal angezeigt.
Ändere es nach dem ersten Login unter **Profil & Passwort**.

### Einstellungen (`.env`)

| Variable         | Bedeutung                                              | Standard           |
| ---------------- | ------------------------------------------------------ | ------------------ |
| `APP_NAME`       | Name oben links und auf der Login-Seite                | `Bude Ebenweiler` |
| `ADMIN_USERNAME` | Benutzername des ersten Admins (nur beim ersten Start) | `admin`            |
| `ADMIN_PASSWORD` | Passwort des ersten Admins (nur beim ersten Start)     | zufällig           |
| `PORT`           | Port des Servers                                       | `3000`             |
| `DATA_DIR`       | Ordner für die Datenbank `app.db`                      | `./data`           |

### Passwort vergessen?

Auf dem Server kann man jedes Passwort neu setzen, auch das vom Admin:

```bash
npm run passwort -- admin neues-passwort
```

## Online stellen

Die Seite braucht einen Host, auf dem Node.js läuft, zum Beispiel Render, Railway, Fly.io,
einen eigenen Server oder einen Raspberry Pi. Reine Static-Hoster wie GitHub Pages reichen nicht.

- Startbefehl: `npm start`, Build-Befehl: `npm install`
- Setze `ADMIN_USERNAME`, `ADMIN_PASSWORD` und `APP_NAME` als Umgebungsvariablen.
- **Wichtig:** Die Daten liegen in `DATA_DIR`. Dieser Ordner muss dauerhaft gespeichert werden
  (z. B. „Persistent Disk“ bei Render oder „Volume“ bei Railway). Sonst sind Mitglieder und Events nach einem Neustart weg.
- Nutze die Seite nur über **HTTPS**, damit Passwörter verschlüsselt übertragen werden.

## Sicherheit

- Passwörter werden nur als scrypt-Hash gespeichert.
- Anmeldung über ein `HttpOnly`-Cookie, Sitzungen laufen nach 30 Tagen ab.
- Nach 10 falschen Passwörtern ist ein Benutzername für 15 Minuten gesperrt.
- Wird ein Passwort zurückgesetzt oder eine Person entfernt, wird sie sofort abgemeldet.
- Es bleibt immer mindestens ein Admin übrig.

## Entwicklung

```bash
npm run dev   # startet neu, wenn sich Dateien ändern
npm test      # API-Tests (Login, Rechte, Mitglieder, Kalender)
```

Aufbau:

```
server.js            Startpunkt
src/app.js           API und Auslieferung der Seite
src/db.js            SQLite-Datenbank (eingebaut in Node.js)
src/auth.js          Passwörter, Sitzungen, Schutz vor Durchprobieren
public/              Frontend (HTML, CSS, JavaScript ohne Build-Schritt)
  js/views/          Seiten: Login, Übersicht, Kalender, Mitglieder, Profil
test/                Tests
```
