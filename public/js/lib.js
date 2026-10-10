// ---------- API ----------

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Keine Verbindung zum Server.', 0);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/login') {
    onUnauthorized();
    throw new ApiError(data?.error || 'Bitte melde dich an.', 401);
  }
  if (!res.ok) throw new ApiError(data?.error || 'Etwas ist schiefgelaufen.', res.status);
  return data;
}

// ---------- HTML-Templates (Werte werden automatisch escaped) ----------

class Raw {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value) => new Raw(value);

export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function renderValue(value) {
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value === false || value == null) return '';
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += renderValue(value) + strings[i + 1];
  });
  return new Raw(out);
}

// ---------- Icons (Lucide, ISC-Lizenz) ----------

const ICONS = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  calendarPlus:
    '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userPlus:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};

export function icon(name) {
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`,
  );
}

// ---------- Datum ----------

const pad = (n) => String(n).padStart(2, '0');
const formatter = (options) => new Intl.DateTimeFormat('de-DE', options);
const fmtWeekday = formatter({ weekday: 'long' });
const fmtMonthShort = formatter({ month: 'short' });
const fmtMonthYear = formatter({ month: 'long', year: 'numeric' });
const fmtLong = formatter({ weekday: 'long', day: 'numeric', month: 'long' });
const fmtLongYear = formatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYearShort = formatter({ month: 'short', year: 'numeric' });

export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const weekday = (d) => fmtWeekday.format(d);
export const monthShort = (d) => fmtMonthShort.format(d).toUpperCase();
export const monthYear = (d) => fmtMonthYear.format(d);
export const longDate = (d) => (d.getFullYear() === new Date().getFullYear() ? fmtLong : fmtLongYear).format(d);
export const memberSince = (iso) => fmtMonthYearShort.format(new Date(iso));

export function timeLabel(event) {
  return event.time ? `${event.time} Uhr` : 'ganztägig';
}

// ---------- Personen ----------

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0];
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] : '';
  return (first + last).toUpperCase();
}

const PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 10) {
  let out = '';
  const limit = 256 - (256 % PW_ALPHABET.length);
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += PW_ALPHABET[byte % PW_ALPHABET.length];
    }
  }
  return out;
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    // In einem offenen Dialog ist der Rest der Seite gesperrt – dort einfügen.
    (document.querySelector('dialog[open]') ?? document.body).append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

// ---------- Toasts ----------

export function toast(message, type = 'ok') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.innerHTML = String(html`${icon(type === 'error' ? 'alert' : 'check')}<span>${message}</span>`);
  box.append(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- Dialoge ----------

/**
 * Öffnet einen Dialog mit Formular. `onSubmit(formData, dialog)` darf async sein;
 * wirft es einen Fehler, wird er im Dialog angezeigt. Gibt es `false` zurück, bleibt der Dialog offen.
 */
export function openModal({
  title,
  body,
  submitLabel = 'Speichern',
  cancelLabel = 'Abbrechen',
  submitClass = 'btn-primary',
  extraFooter = '',
  onSubmit,
  onOpen,
  onClose,
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = String(html`
    <form class="modal-form">
      <div class="modal-head">
        <h2>${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <div class="modal-body">
        ${body}
        <div class="form-error" role="alert" hidden></div>
      </div>
      <div class="modal-foot">
        ${extraFooter}
        <span class="spacer"></span>
        ${cancelLabel ? html`<button type="button" class="btn btn-ghost" data-close>${cancelLabel}</button>` : ''}
        <button type="submit" class="btn ${submitClass}">${submitLabel}</button>
      </div>
    </form>`);

  const form = dialog.querySelector('form');
  const errorBox = dialog.querySelector('.form-error');
  const submitButton = dialog.querySelector('[type=submit]');

  dialog.showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return dialog.close();
    errorBox.hidden = true;
    submitButton.disabled = true;
    try {
      const result = await onSubmit(new FormData(form), dialog);
      if (result !== false) dialog.close();
    } catch (err) {
      dialog.showError(err.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.body.append(dialog);
  dialog.showModal();
  onOpen?.(dialog);
  return dialog;
}

export function confirmAction({ title, message, confirmLabel = 'Löschen', action }) {
  return openModal({
    title,
    body: html`<p>${message}</p>`,
    submitLabel: confirmLabel,
    submitClass: 'btn-danger-solid',
    onSubmit: action,
  });
}

// Augen-Button neben Passwortfeldern
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-toggle-password]');
  if (!button) return;
  const input = button.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.innerHTML = String(icon(show ? 'eyeOff' : 'eye'));
  button.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
});

export function passwordInput({ name, autocomplete, required = true, value = '', minlength = 0 }) {
  return html`
    <div class="input-wrap">
      <input
        type="password"
        name="${name}"
        autocomplete="${autocomplete}"
        value="${value}"
        ${raw(required ? 'required' : '')}
        ${raw(minlength ? `minlength="${minlength}"` : '')}
      />
      <button type="button" class="icon-btn" data-toggle-password aria-label="Passwort anzeigen">${icon('eye')}</button>
    </div>
  `;
}

export const loading = () => html`<div class="loading"><div class="spinner"></div></div>`;
