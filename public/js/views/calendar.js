import {
  api,
  confirmAction,
  dateKey,
  html,
  icon,
  loading,
  longDate,
  monthShort,
  monthYear,
  openModal,
  parseKey,
  timeLabel,
  toast,
  todayKey,
  weekday,
} from '../lib.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export async function calendarView(el, ctx) {
  const { user } = ctx.state;
  const params = new URLSearchParams(location.search);
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(params.get('datum') ?? '') ? params.get('datum') : null;

  let selected = requested;
  let month = parseKey(requested ?? todayKey());
  month.setDate(1);
  let events = [];

  el.innerHTML = String(loading());
  events = await api('/events');
  if (!el.isConnected) return;

  const canEdit = (ev) => user.role === 'admin' || ev.created_by === user.id;

  function eventCard(ev) {
    const date = parseKey(ev.date);
    const otherYear = date.getFullYear() !== new Date().getFullYear();
    return html`
      <article class="card event">
        <div class="date-badge" aria-hidden="true">
          <small>${monthShort(date)}</small>
          <b>${date.getDate()}</b>
          ${otherYear ? html`<span class="year">${date.getFullYear()}</span>` : ''}
        </div>
        <div class="event-body">
          <div class="event-top">
            <h3>${ev.title}</h3>
            ${canEdit(ev)
              ? html`<div class="event-actions">
                  <button class="icon-btn" data-edit="${ev.id}" aria-label="Event bearbeiten">${icon('pencil')}</button>
                  <button class="icon-btn danger" data-delete="${ev.id}" aria-label="Event löschen">${icon('trash')}</button>
                </div>`
              : ''}
          </div>
          <p class="meta">${icon('clock')}<span>${weekday(date)}, ${timeLabel(ev)}</span></p>
          ${ev.location ? html`<p class="meta">${icon('pin')}<span>${ev.location}</span></p>` : ''}
          ${ev.description ? html`<p class="desc">${ev.description}</p>` : ''}
          ${ev.created_by_name ? html`<p class="by">Erstellt von ${ev.created_by_name}</p>` : ''}
        </div>
      </article>`;
  }

  function calendar(byDate) {
    const year = month.getFullYear();
    const m = month.getMonth();
    const offset = (new Date(year, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const today = todayKey();

    const days = [];
    for (let i = 0; i < cells; i++) {
      const date = new Date(year, m, 1 - offset + i);
      const key = dateKey(date);
      const count = byDate.get(key)?.length ?? 0;
      const classes = [
        'day',
        date.getMonth() !== m && 'outside',
        key === today && 'today',
        key === selected && 'selected',
        count && 'has',
      ].filter(Boolean);
      const label = `${longDate(date)}${count ? `, ${count} ${count === 1 ? 'Event' : 'Events'}` : ''}`;
      days.push(html`
        <button type="button" class="${classes.join(' ')}" data-day="${key}" aria-label="${label}"
          aria-pressed="${key === selected}">${date.getDate()}</button>`);
    }

    return html`
      <div class="card cal-card">
        <div class="cal">
          <div class="cal-head">
            <button class="icon-btn" data-month="-1" aria-label="Vorheriger Monat">${icon('chevronLeft')}</button>
            <div class="cal-title" aria-live="polite">${monthYear(month)}</div>
            <button class="icon-btn" data-month="1" aria-label="Nächster Monat">${icon('chevronRight')}</button>
          </div>
          <div class="cal-grid">
            ${WEEKDAYS.map((d) => html`<div class="cal-wd" aria-hidden="true">${d}</div>`)}
            ${days}
          </div>
        </div>
      </div>`;
  }

  function draw() {
    const byDate = new Map();
    for (const ev of events) {
      if (!byDate.has(ev.date)) byDate.set(ev.date, []);
      byDate.get(ev.date).push(ev);
    }
    const today = todayKey();
    const upcoming = events.filter((ev) => ev.date >= today);
    const selectedEvents = selected ? (byDate.get(selected) ?? []) : [];

    el.innerHTML = String(html`
      <section class="hero">
        <h1>Kalender & Events</h1>
        <p class="subtitle">Plane gemeinsame Termine</p>
        <button class="btn btn-primary" data-new>${icon('calendarPlus')} Neues Event</button>
      </section>

      ${calendar(byDate)}

      ${selected
        ? html`
          <section class="section">
            <div class="section-head">
              <h2 class="small">${longDate(parseKey(selected))}</h2>
              <button class="icon-btn" data-clear aria-label="Auswahl aufheben">${icon('x')}</button>
            </div>
            ${selectedEvents.length
              ? html`<div class="stack">${selectedEvents.map(eventCard)}</div>`
              : html`
                <div class="card">
                  <p class="empty">Nichts geplant an diesem Tag.</p>
                  <button class="btn btn-soft btn-sm" data-new data-date="${selected}">
                    ${icon('plus')} Event an diesem Tag
                  </button>
                </div>`}
          </section>`
        : ''}

      <section class="section">
        <h2>Kommende Events</h2>
        ${upcoming.length
          ? html`<div class="stack">${upcoming.map(eventCard)}</div>`
          : html`<p class="empty">Keine kommenden Events. Leg los mit „Neues Event“!</p>`}
      </section>`);
  }

  async function reload() {
    events = await api('/events');
    if (el.isConnected) draw();
  }

  function openForm(ev = null, presetDate = null) {
    const date = ev?.date ?? presetDate ?? selected ?? todayKey();
    openModal({
      title: ev ? 'Event bearbeiten' : 'Neues Event',
      submitLabel: ev ? 'Speichern' : 'Event erstellen',
      body: html`
        <label class="field">
          <span>Titel</span>
          <input name="title" maxlength="100" required placeholder="z. B. Hüttenabend" value="${ev?.title ?? ''}" />
        </label>
        <div class="row">
          <label class="field">
            <span>Datum</span>
            <input type="date" name="date" required value="${date}" />
          </label>
          <label class="field">
            <span>Uhrzeit</span>
            <input type="time" name="time" value="${ev?.time ?? ''}" />
          </label>
        </div>
        <label class="field">
          <span>Ort</span>
          <input name="location" maxlength="100" placeholder="z. B. Ebenweiler Hütte" value="${ev?.location ?? ''}" />
        </label>
        <label class="field">
          <span>Beschreibung</span>
          <textarea name="description" maxlength="1000" placeholder="Was ist geplant?">${ev?.description ?? ''}</textarea>
        </label>`,
      onOpen: (dialog) => {
        if (!ev) dialog.querySelector('[name=title]').focus();
      },
      onSubmit: async (data) => {
        const body = Object.fromEntries(data);
        const saved = ev
          ? await api(`/events/${ev.id}`, { method: 'PUT', body })
          : await api('/events', { method: 'POST', body });
        toast(ev ? 'Event gespeichert' : 'Event erstellt');
        if (selected) selected = saved.date;
        month = parseKey(saved.date);
        month.setDate(1);
        await reload();
      },
    });
  }

  el.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.dataset.month) {
      month = new Date(month.getFullYear(), month.getMonth() + Number(target.dataset.month), 1);
      draw();
    } else if (target.dataset.day) {
      const key = target.dataset.day;
      selected = selected === key ? null : key;
      const date = parseKey(key);
      if (date.getMonth() !== month.getMonth()) month = new Date(date.getFullYear(), date.getMonth(), 1);
      draw();
    } else if (target.hasAttribute('data-clear')) {
      selected = null;
      draw();
    } else if (target.hasAttribute('data-new')) {
      openForm(null, target.dataset.date);
    } else if (target.dataset.edit) {
      openForm(events.find((ev) => ev.id === Number(target.dataset.edit)));
    } else if (target.dataset.delete) {
      const ev = events.find((x) => x.id === Number(target.dataset.delete));
      confirmAction({
        title: 'Event löschen?',
        message: `„${ev.title}“ am ${longDate(parseKey(ev.date))} wird für alle gelöscht.`,
        action: async () => {
          await api(`/events/${ev.id}`, { method: 'DELETE' });
          toast('Event gelöscht');
          await reload();
        },
      });
    }
  });

  draw();
}
