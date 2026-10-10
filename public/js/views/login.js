import { api, html, icon, passwordInput } from '../lib.js';

export function loginView(root, ctx) {
  root.innerHTML = String(html`
    <div class="auth">
      <div class="auth-card">
        <div class="auth-icon">${icon('lock')}</div>
        <h1>${ctx.state.appName}</h1>
        <p class="subtitle">Dieser Bereich ist passwortgeschützt. Melde dich mit deinen Zugangsdaten an.</p>
        <form class="card" novalidate>
          <label class="field">
            <span>Benutzername</span>
            <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required />
          </label>
          <label class="field">
            <span>Passwort</span>
            ${passwordInput({ name: 'password', autocomplete: 'current-password' })}
          </label>
          <div class="form-error" role="alert" hidden></div>
          <button class="btn btn-primary btn-block" type="submit">Anmelden</button>
        </form>
        <p class="auth-foot">Noch keinen Zugang? Frag den Admin deiner Gruppe.</p>
      </div>
    </div>`);

  const form = root.querySelector('form');
  const errorBox = root.querySelector('.form-error');
  const button = form.querySelector('[type=submit]');
  form.username.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      errorBox.textContent = 'Bitte Benutzername und Passwort eingeben.';
      errorBox.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = 'Anmelden …';
    try {
      const { user } = await api('/login', { method: 'POST', body: { username, password } });
      ctx.state.user = user;
      ctx.navigate(location.pathname + location.search, { replace: true });
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      form.password.select();
      button.disabled = false;
      button.textContent = 'Anmelden';
    }
  });
}
