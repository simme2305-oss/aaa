import {
  api,
  confirmAction,
  copyText,
  generatePassword,
  html,
  icon,
  initials,
  loading,
  memberSince,
  openModal,
  raw,
  toast,
} from '../lib.js';

// "Simon Boos" -> "simon", bei Kollision "simon.boos", "simon2", ...
function suggestUsername(name, taken) {
  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9._-]/g, '');
  const parts = name.trim().split(/\s+/).map(slug).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0].padEnd(3, '1').slice(0, 32);
  const candidates = [first];
  if (parts.length > 1) candidates.push(`${parts[0]}.${parts[parts.length - 1]}`.slice(0, 32));
  for (let i = 2; i < 100; i++) candidates.push(`${first.slice(0, 30)}${i}`);
  return candidates.find((c) => !taken.has(c)) ?? first;
}

function credentialsText(appName, username, password) {
  return [
    `Dein Zugang für ${appName}:`,
    `Link: ${location.origin}/`,
    `Benutzername: ${username}`,
    `Passwort: ${password}`,
    '',
    'Du kannst das Passwort nach dem Login unter „Profil & Passwort“ ändern.',
  ].join('\n');
}

function showCredentials({ title, intro, appName, member, password }) {
  const text = credentialsText(appName, member.username, password);
  openModal({
    title,
    body: html`
      <p>${intro}</p>
      <dl class="credentials">
        <div><dt>Benutzername</dt><dd class="mono">${member.username}</dd></div>
        <div><dt>Passwort</dt><dd class="mono">${password}</dd></div>
      </dl>
      <p class="muted">Das Passwort wird nur jetzt angezeigt. Schick die Daten am besten direkt weiter.</p>`,
    cancelLabel: 'Fertig',
    submitLabel: raw(`${icon('copy')} Zugangsdaten kopieren`),
    onSubmit: async () => {
      if (await copyText(text)) toast('Zugangsdaten kopiert');
      else toast('Kopieren hat nicht geklappt', 'error');
      return false;
    },
  });
}

function passwordField({ label, hint, value = '', required = true }) {
  return html`
    <label class="field">
      <span>${label}</span>
      <div class="input-row">
        <input name="password" class="mono" autocomplete="new-password" spellcheck="false" autocapitalize="none"
          value="${value}" ${raw(required ? 'required minlength="6"' : 'minlength="6"')} />
        <button type="button" class="btn btn-ghost" data-generate aria-label="Neues Passwort erzeugen">
          ${icon('refresh')}
        </button>
      </div>
      ${hint ? html`<small>${hint}</small>` : ''}
    </label>`;
}

function bindGenerate(dialog) {
  dialog.querySelector('[data-generate]').addEventListener('click', () => {
    const input = dialog.querySelector('[name=password]');
    input.value = generatePassword();
    input.focus();
  });
}

export async function membersView(el, ctx) {
  const { user, appName } = ctx.state;
  const isAdmin = user.role === 'admin';

  el.innerHTML = String(loading());
  let members = await api('/members');
  if (!el.isConnected) return;

  function draw() {
    el.innerHTML = String(html`
      <section class="hero">
        <h1>Mitglieder</h1>
        <p class="subtitle">${members.length} ${members.length === 1 ? 'Person' : 'Personen'} in der Gruppe</p>
        ${isAdmin ? html`<button class="btn btn-primary" data-add>${icon('userPlus')} Person hinzufügen</button>` : ''}
      </section>

      <div class="card">
        <ul class="list">
          ${members.map(
            (m) => html`
              <li class="member">
                <span class="avatar" aria-hidden="true">${initials(m.name)}</span>
                <div class="member-main">
                  <div class="member-name">
                    <span>${m.name}</span>
                    ${m.role === 'admin' ? html`<span class="badge">${icon('shield')} Admin</span>` : ''}
                    ${m.id === user.id ? html`<span class="badge badge-muted">Du</span>` : ''}
                  </div>
                  <div class="member-sub">@${m.username} · dabei seit ${memberSince(m.created_at)}</div>
                </div>
                ${isAdmin
                  ? html`<button class="icon-btn" data-edit="${m.id}" aria-label="${m.name} verwalten">
                      ${icon('pencil')}
                    </button>`
                  : ''}
              </li>`,
          )}
        </ul>
      </div>

      ${isAdmin
        ? html`<p class="hint">${icon('info')}<span>Nur eingeloggte Mitglieder sehen die Seite. Neue Leute bekommen
            ihren Zugang von dir – es gibt keine öffentliche Registrierung.</span></p>`
        : html`<p class="hint">${icon('info')}<span>Neue Leute kann nur ein Admin hinzufügen.</span></p>`}`);
  }

  async function reload() {
    members = await api('/members');
    if (el.isConnected) draw();
  }

  function openAdd() {
    const taken = new Set(members.map((m) => m.username));
    let usernameTouched = false;
    openModal({
      title: 'Person hinzufügen',
      submitLabel: 'Hinzufügen',
      body: html`
        <label class="field">
          <span>Name</span>
          <input name="name" maxlength="60" required placeholder="z. B. Simon Boos" autocomplete="off" />
        </label>
        <label class="field">
          <span>Benutzername</span>
          <input name="username" required minlength="3" maxlength="32" pattern="[a-z0-9._\\-]+"
            autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="z. B. simon" />
          <small>Damit meldet sich die Person an. Nur Kleinbuchstaben, Zahlen, Punkt, Minus.</small>
        </label>
        ${passwordField({ label: 'Passwort', value: generatePassword(), hint: 'Vorschlag – du kannst es auch selbst festlegen.' })}
        <label class="field">
          <span>Rolle</span>
          <select name="role">
            <option value="member">Mitglied</option>
            <option value="admin">Admin – darf Leute hinzufügen und verwalten</option>
          </select>
        </label>`,
      onOpen: (dialog) => {
        const name = dialog.querySelector('[name=name]');
        const username = dialog.querySelector('[name=username]');
        name.focus();
        name.addEventListener('input', () => {
          if (!usernameTouched) username.value = suggestUsername(name.value, taken);
        });
        username.addEventListener('input', () => {
          usernameTouched = true;
          username.value = username.value.toLowerCase();
        });
        bindGenerate(dialog);
      },
      onSubmit: async (data) => {
        const body = Object.fromEntries(data);
        const member = await api('/members', { method: 'POST', body });
        await reload();
        setTimeout(() =>
          showCredentials({
            title: 'Zugang erstellt',
            intro: `${member.name} kann sich jetzt mit diesen Daten anmelden:`,
            appName,
            member,
            password: body.password,
          }),
        );
      },
    });
  }

  function openEdit(member) {
    const isSelf = member.id === user.id;
    openModal({
      title: `${member.name} verwalten`,
      body: html`
        <label class="field">
          <span>Name</span>
          <input name="name" maxlength="60" required value="${member.name}" />
        </label>
        <label class="field">
          <span>Benutzername</span>
          <input name="username" required minlength="3" maxlength="32" pattern="[a-z0-9._\\-]+"
            autocapitalize="none" spellcheck="false" value="${member.username}" />
        </label>
        <label class="field">
          <span>Rolle</span>
          <select name="role">
            <option value="member" ${raw(member.role === 'member' ? 'selected' : '')}>Mitglied</option>
            <option value="admin" ${raw(member.role === 'admin' ? 'selected' : '')}>Admin</option>
          </select>
        </label>
        ${passwordField({
          label: 'Neues Passwort (optional)',
          required: false,
          hint: 'Leer lassen, um das Passwort nicht zu ändern. Die Person wird dann abgemeldet.',
        })}`,
      extraFooter: isSelf
        ? ''
        : html`<button type="button" class="btn btn-danger" data-remove>${icon('trash')} Entfernen</button>`,
      onOpen: (dialog) => {
        bindGenerate(dialog);
        dialog.querySelector('[data-remove]')?.addEventListener('click', () => {
          dialog.close();
          confirmAction({
            title: 'Person entfernen?',
            message: `${member.name} (@${member.username}) verliert sofort den Zugang zur Seite. Von ${member.name} erstellte Events bleiben erhalten.`,
            confirmLabel: 'Entfernen',
            action: async () => {
              await api(`/members/${member.id}`, { method: 'DELETE' });
              toast(`${member.name} wurde entfernt`);
              await reload();
            },
          });
        });
      },
      onSubmit: async (data) => {
        const body = Object.fromEntries(data);
        if (!body.password) delete body.password;
        const updated = await api(`/members/${member.id}`, { method: 'PATCH', body });
        if (isSelf) ctx.setUser({ ...user, ...updated });
        await reload();
        if (isSelf && updated.role !== 'admin') {
          ctx.navigate('/mitglieder', { replace: true });
        }
        if (body.password) {
          setTimeout(() =>
            showCredentials({
              title: 'Passwort geändert',
              intro: `Neue Zugangsdaten für ${updated.name}:`,
              appName,
              member: updated,
              password: body.password,
            }),
          );
        } else {
          toast('Gespeichert');
        }
      },
    });
  }

  el.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-add')) openAdd();
    else if (target.dataset.edit) openEdit(members.find((m) => m.id === Number(target.dataset.edit)));
  });

  draw();

  if (isAdmin && new URLSearchParams(location.search).has('neu')) {
    history.replaceState(null, '', '/mitglieder');
    openAdd();
  }
}
