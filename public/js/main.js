import { api, html, icon, initials, setUnauthorizedHandler, toast } from './lib.js';
import { calendarView } from './views/calendar.js';
import { dashboardView } from './views/dashboard.js';
import { loginView } from './views/login.js';
import { membersView } from './views/members.js';
import { profileView } from './views/profile.js';

const state = { user: null, appName: 'Bude Ebenweiler' };

const routes = [
  { path: '/', label: 'Übersicht', icon: 'home', view: dashboardView },
  { path: '/kalender', label: 'Kalender', icon: 'calendar', view: calendarView },
  { path: '/mitglieder', label: 'Mitglieder', icon: 'users', view: membersView },
  { path: '/profil', view: profileView },
];
const tabs = routes.filter((r) => r.label);

const ctx = {
  state,
  navigate,
  setUser(user) {
    state.user = user;
    renderShell();
  },
  async logout() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    history.replaceState(null, '', '/');
    renderApp();
  },
};

function navigate(to, { replace = false } = {}) {
  if (to !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', to);
  renderRoute();
}

function renderApp() {
  const app = document.getElementById('app');
  if (!state.user) {
    loginView(app, ctx);
    return;
  }
  app.innerHTML = String(html`
    <div class="app">
      <header class="topbar"><div class="topbar-inner" id="topbar"></div></header>
      <main class="main" id="view"></main>
      <nav class="tabbar" aria-label="Navigation">
        <div class="tabbar-inner">
          ${tabs.map((t) => html`<a class="tab" href="${t.path}" data-link>${icon(t.icon)}<span>${t.label}</span></a>`)}
        </div>
      </nav>
    </div>`);
  renderShell();
  renderRoute();
}

// Kopfzeile neu zeichnen (z. B. nachdem sich der Name geändert hat)
function renderShell() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  const { user } = state;
  bar.innerHTML = String(html`
    <a class="brand" href="/" data-link>${state.appName}</a>
    <nav class="topnav" aria-label="Navigation">
      ${tabs.map((t) => html`<a href="${t.path}" data-link>${icon(t.icon)}${t.label}</a>`)}
    </nav>
    <div class="menu-wrap">
      <button class="avatar avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Konto-Menü">
        ${initials(user.name)}
      </button>
      <div class="menu" role="menu" hidden>
        <div class="menu-head">
          <strong>${user.name}</strong>
          <span>@${user.username} · ${user.role === 'admin' ? 'Admin' : 'Mitglied'}</span>
        </div>
        <a href="/profil" data-link role="menuitem">${icon('user')} Profil & Passwort</a>
        <a href="/mitglieder" data-link role="menuitem">${icon('users')} Mitglieder</a>
        <button type="button" class="danger" data-logout role="menuitem">${icon('logout')} Abmelden</button>
      </div>
    </div>`);
  markActive();
}

function markActive() {
  for (const link of document.querySelectorAll('.tab, .topnav a')) {
    link.classList.toggle('active', link.getAttribute('href') === location.pathname);
  }
}

function renderRoute() {
  const main = document.getElementById('view');
  if (!main) return renderApp();
  closeMenu();

  let route = routes.find((r) => r.path === location.pathname);
  if (!route) {
    history.replaceState(null, '', '/');
    route = routes[0];
  }
  markActive();

  const page = document.createElement('div');
  main.replaceChildren(page);
  window.scrollTo(0, 0);
  Promise.resolve(route.view(page, ctx)).catch((err) => {
    if (!page.isConnected || err.status === 401) return;
    page.innerHTML = String(html`
      <div class="error-state">
        <h2>Das hat nicht geklappt</h2>
        <p>${err.message}</p>
        <button class="btn btn-ghost" data-retry>Nochmal versuchen</button>
      </div>`);
    page.querySelector('[data-retry]').onclick = renderRoute;
  });
}

// ---------- Konto-Menü ----------

function closeMenu() {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  menu.hidden = true;
  document.querySelector('.avatar-btn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const avatar = e.target.closest('.avatar-btn');
  if (avatar) {
    const menu = document.querySelector('.menu');
    menu.hidden = !menu.hidden;
    avatar.setAttribute('aria-expanded', String(!menu.hidden));
    return;
  }
  if (e.target.closest('[data-logout]')) {
    ctx.logout();
    return;
  }
  if (!e.target.closest('.menu')) closeMenu();

  // Interne Links ohne Neuladen der Seite
  const link = e.target.closest('a[data-link]');
  if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
    e.preventDefault();
    navigate(link.getAttribute('href'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

window.addEventListener('popstate', renderRoute);

// ---------- Start ----------

setUnauthorizedHandler(() => {
  if (!state.user) return;
  state.user = null;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  toast('Bitte melde dich erneut an.', 'error');
  renderApp();
});

async function boot() {
  try {
    const [config, me] = await Promise.all([api('/config'), api('/me')]);
    state.appName = config.appName;
    state.user = me.user;
    document.title = config.appName;
    renderApp();
  } catch (err) {
    document.getElementById('app').innerHTML = String(html`
      <div class="auth">
        <div class="error-state">
          <h2>Server nicht erreichbar</h2>
          <p>${err.message}</p>
          <button class="btn btn-ghost" data-reload>Neu laden</button>
        </div>
      </div>`);
    document.querySelector('[data-reload]').onclick = () => location.reload();
  }
}

boot();
