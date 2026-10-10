import { api, html, icon, initials, loading, monthShort, parseKey, timeLabel, todayKey, weekday } from '../lib.js';

export async function dashboardView(el, ctx) {
  const { user } = ctx.state;
  el.innerHTML = String(loading());
  const [events, members] = await Promise.all([api('/events'), api('/members')]);
  if (!el.isConnected) return;

  const today = todayKey();
  const upcoming = events.filter((ev) => ev.date >= today).slice(0, 3);
  const shown = members.slice(0, 6);

  el.innerHTML = String(html`
    <section class="hero">
      <h1>Hallo ${user.name}</h1>
      <p class="subtitle">Was gerade in der Gruppe los ist.</p>
    </section>

    <div class="stack">
      <div class="card">
        <div class="card-head">
          <div class="card-label">${icon('calendar')} Nächste Termine</div>
          <a class="card-link" href="/kalender" data-link>Alle ansehen</a>
        </div>
        ${upcoming.length
          ? html`<ul class="mini-list">
              ${upcoming.map((ev) => {
                const date = parseKey(ev.date);
                return html`<li>
                  <a href="/kalender?datum=${ev.date}" data-link>
                    <span class="mini-date"><small>${monthShort(date)}</small><b>${date.getDate()}</b></span>
                    <span>
                      <span class="mini-title">${ev.title}</span>
                      <span class="mini-meta">${weekday(date)}, ${timeLabel(ev)}${ev.location ? ` · ${ev.location}` : ''}</span>
                    </span>
                  </a>
                </li>`;
              })}
            </ul>`
          : html`<p class="card-text">Keine Termine geplant.</p>`}
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-label">${icon('users')} Mitglieder</div>
          <a class="card-link" href="/mitglieder" data-link>Alle ansehen</a>
        </div>
        <div class="big-number accent">${members.length}</div>
        <p class="muted">${members.length === 1 ? 'Person' : 'Personen'} in der Gruppe</p>
        <div class="avatar-stack" aria-hidden="true">
          ${shown.map((m) => html`<span class="avatar" title="${m.name}">${initials(m.name)}</span>`)}
          ${members.length > shown.length ? html`<span class="avatar more">+${members.length - shown.length}</span>` : ''}
        </div>
      </div>

      ${user.role === 'admin'
        ? html`<div class="card">
            <div class="card-label">${icon('shield')} Admin-Bereich</div>
            <p class="card-text admin-text">Füge neue Leute hinzu und verwalte die Zugänge deiner Gruppe.</p>
            <a class="btn btn-soft btn-sm" href="/mitglieder?neu=1" data-link>${icon('userPlus')} Person hinzufügen</a>
          </div>`
        : ''}
    </div>`);
}
