export const cedis = (n: number, digits = 2) =>
  `GH₵${(Number.isFinite(n) ? n : 0).toLocaleString('en-GH', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const kwh = (n: number, digits = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(digits)} kWh`;

export const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Dates and times shown in Ghana time (GMT). */
export const dateGh = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Accra' });
export const timeGh = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
export const dateTimeGh = (d: Date) => `${dateGh(d)}, ${timeGh(d)}`;

export function relative(d: Date, now = new Date()) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (Math.abs(mins) < 1) return 'just now';
  const fut = mins < 0;
  const m = Math.abs(mins);
  const s = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return fut ? `in ${s}` : `${s} ago`;
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function toast(msg: string) {
  let el = document.querySelector<HTMLDivElement>('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout((el as unknown as { _t: number })._t);
  (el as unknown as { _t: number })._t = window.setTimeout(() => el!.classList.remove('show'), 2600);
}
