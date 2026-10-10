import { api, html, icon, initials, memberSince, passwordInput, toast } from '../lib.js';

export function profileView(el, ctx) {
  const { user } = ctx.state;

  el.innerHTML = String(html`
    <section class="hero">
      <h1>Profil</h1>
      <p class="subtitle">Dein Zugang zur Gruppe</p>
    </section>

    <div class="stack">
      <div class="card profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${initials(user.name)}</span>
        <div>
          <h2>${user.name}</h2>
          <p class="muted">@${user.username} · ${user.role === 'admin' ? 'Admin' : 'Mitglied'} · dabei seit ${memberSince(user.created_at)}</p>
        </div>
      </div>

      <form class="card" data-form="name">
        <h2 class="card-title">Name</h2>
        <label class="field">
          <span>So sehen dich die anderen</span>
          <input name="name" maxlength="60" required value="${user.name}" autocomplete="name" />
        </label>
        <div class="form-error" role="alert" hidden></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Speichern</button></div>
      </form>

      <form class="card" data-form="password">
        <h2 class="card-title">Passwort ändern</h2>
        <label class="field">
          <span>Aktuelles Passwort</span>
          ${passwordInput({ name: 'currentPassword', autocomplete: 'current-password' })}
        </label>
        <label class="field">
          <span>Neues Passwort</span>
          ${passwordInput({ name: 'newPassword', autocomplete: 'new-password', minlength: 6 })}
          <small>Mindestens 6 Zeichen.</small>
        </label>
        <label class="field">
          <span>Neues Passwort wiederholen</span>
          ${passwordInput({ name: 'repeatPassword', autocomplete: 'new-password', minlength: 6 })}
        </label>
        <div class="form-error" role="alert" hidden></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Passwort ändern</button></div>
      </form>

      <button class="btn btn-danger btn-block" data-logout>${icon('logout')} Abmelden</button>
    </div>`);

  async function handle(form, action) {
    const errorBox = form.querySelector('.form-error');
    const button = form.querySelector('[type=submit]');
    errorBox.hidden = true;
    button.disabled = true;
    try {
      await action();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  el.querySelector('[data-form=name]').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    handle(form, async () => {
      const { user: updated } = await api('/me', { method: 'PATCH', body: { name: form.querySelector('[name=name]').value } });
      ctx.setUser(updated);
      toast('Name gespeichert');
      profileView(el, ctx);
    });
  });

  el.querySelector('[data-form=password]').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    handle(form, async () => {
      if (form.newPassword.value !== form.repeatPassword.value) throw new Error('Die neuen Passwörter stimmen nicht überein.');
      await api('/me/password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword.value, newPassword: form.newPassword.value },
      });
      form.reset();
      toast('Passwort geändert');
    });
  });
}
