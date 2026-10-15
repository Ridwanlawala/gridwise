/**
 * Community outage reports and pattern analysis.
 * Ghana runs on GMT (UTC+0, no daylight saving), so all hour-of-day maths uses UTC hours,
 * which equal local Ghana time regardless of where the browser is.
 */

export interface Area {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

/** Approximate neighbourhood centre points (for map display only). */
export const AREAS: Area[] = [
  { id: 'madina', name: 'Madina', city: 'Accra', lat: 5.673, lng: -0.166 },
  { id: 'east-legon', name: 'East Legon', city: 'Accra', lat: 5.635, lng: -0.161 },
  { id: 'adenta', name: 'Adenta', city: 'Accra', lat: 5.709, lng: -0.155 },
  { id: 'achimota', name: 'Achimota', city: 'Accra', lat: 5.62, lng: -0.229 },
  { id: 'dansoman', name: 'Dansoman', city: 'Accra', lat: 5.55, lng: -0.268 },
  { id: 'spintex', name: 'Spintex', city: 'Accra', lat: 5.633, lng: -0.1 },
  { id: 'kasoa', name: 'Kasoa', city: 'Central', lat: 5.534, lng: -0.424 },
  { id: 'tema-25', name: 'Tema Comm. 25', city: 'Tema', lat: 5.735, lng: -0.025 },
  { id: 'ahodwo', name: 'Ahodwo', city: 'Kumasi', lat: 6.665, lng: -1.62 },
  { id: 'bantama', name: 'Bantama', city: 'Kumasi', lat: 6.703, lng: -1.634 },
  { id: 'suame', name: 'Suame', city: 'Kumasi', lat: 6.724, lng: -1.628 },
  { id: 'anaji', name: 'Anaji', city: 'Takoradi', lat: 4.933, lng: -1.777 },
  { id: 'abura', name: 'Abura', city: 'Cape Coast', lat: 5.12, lng: -1.265 },
  { id: 'bankoe', name: 'Bankoe', city: 'Ho', lat: 6.61, lng: 0.47 },
  { id: 'vittin', name: 'Vittin', city: 'Tamale', lat: 9.38, lng: -0.835 },
];

export const areaById = (id: string) => AREAS.find((a) => a.id === id);

export interface OutageReport {
  id: string;
  area: string;
  /** ISO timestamp */
  start: string;
  /** ISO timestamp, null while ongoing */
  end: string | null;
  note: string;
  confirmations: number;
  source: 'demo' | 'user';
  createdAt: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Seeded PRNG so the demo data is stable for a given day. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** Demo load-shedding profiles: start hour (GMT), typical length (h), daily probability. */
const PROFILES: Record<string, { start: number; len: number; p: number }[]> = {
  madina: [{ start: 18, len: 4, p: 0.62 }],
  'east-legon': [{ start: 13, len: 2, p: 0.12 }],
  adenta: [{ start: 19, len: 4, p: 0.5 }],
  achimota: [{ start: 9, len: 3, p: 0.22 }],
  dansoman: [{ start: 12, len: 4, p: 0.48 }],
  spintex: [{ start: 18, len: 3, p: 0.45 }],
  kasoa: [{ start: 6, len: 4, p: 0.55 }, { start: 20, len: 2, p: 0.2 }],
  'tema-25': [{ start: 0, len: 4, p: 0.4 }],
  ahodwo: [{ start: 17, len: 4, p: 0.42 }],
  bantama: [{ start: 7, len: 4, p: 0.5 }],
  suame: [{ start: 12, len: 5, p: 0.52 }],
  anaji: [{ start: 18, len: 4, p: 0.35 }],
  abura: [{ start: 6, len: 3, p: 0.38 }],
  bankoe: [{ start: 19, len: 3, p: 0.33 }],
  vittin: [{ start: 13, len: 4, p: 0.5 }],
};

const NOTES = ['Whole street off', 'Lights went off, neighbours too', 'Power gone again', 'Off since evening', 'Low voltage then off', 'ECG truck seen nearby', 'Fridge stopped, entire block dark', 'Dumsor again'];

/** Generate ~4 weeks of community reports ending at `now`. */
export function generateDemoReports(now: Date = new Date(), days = 28): OutageReport[] {
  const out: OutageReport[] = [];
  const todayIndex = Math.floor(now.getTime() / DAY);
  for (const area of AREAS) {
    for (let d = days; d >= 0; d--) {
      const dayIndex = todayIndex - d;
      const rand = mulberry32(hash(`${area.id}:${dayIndex}`));
      const dayStart = dayIndex * DAY;
      const windows = [...(PROFILES[area.id] || [])];
      if (rand() < 0.06) windows.push({ start: Math.floor(rand() * 24), len: 1 + Math.floor(rand() * 2), p: 1 });
      for (const w of windows) {
        if (rand() > w.p) continue;
        const jitter = Math.round((rand() - 0.5) * 2 * 60) * 60_000; // ±60 min
        const start = dayStart + w.start * HOUR + jitter;
        const len = Math.max(0.75, w.len + (rand() - 0.5) * 2) * HOUR;
        if (start > now.getTime()) continue;
        const endTs = start + len;
        out.push({
          id: `demo-${area.id}-${dayIndex}-${w.start}`,
          area: area.id,
          start: new Date(start).toISOString(),
          end: endTs > now.getTime() ? null : new Date(endTs).toISOString(),
          note: NOTES[Math.floor(rand() * NOTES.length)],
          confirmations: 1 + Math.floor(rand() * 14),
          source: 'demo',
          createdAt: new Date(start + 5 * 60_000).toISOString(),
        });
      }
    }
  }
  return out;
}

export function isOngoing(r: OutageReport, now = new Date()) {
  return r.end === null && now.getTime() - new Date(r.start).getTime() < 12 * HOUR;
}

/** End time used for analysis: ongoing reports count up to now (capped at 12 h). */
function effectiveEnd(r: OutageReport, now: Date) {
  if (r.end) return new Date(r.end).getTime();
  return Math.min(now.getTime(), new Date(r.start).getTime() + 12 * HOUR);
}

export interface Window {
  startHour: number;
  endHour: number;
  probability: number;
  label: string;
}

export interface AreaAnalysis {
  area: string;
  days: number;
  hourly: number[];
  weekday: number[];
  windows: Window[];
  outagesLast7: number;
  hoursOffLast7: number;
  avgDurationHours: number;
  reliability: number;
  nextLikely: { at: Date; window: Window } | null;
  ongoing: OutageReport | null;
}

export const fmtHour = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Probability-by-hour model over the last `days` days, plus predicted outage windows. */
export function analyseArea(reports: OutageReport[], area: string, now = new Date(), days = 28, threshold = 0.3): AreaAnalysis {
  const mine = reports.filter((r) => r.area === area);
  const todayIndex = Math.floor(now.getTime() / DAY);
  const firstDay = todayIndex - days;
  const grid: boolean[][] = Array.from({ length: days }, () => Array(24).fill(false));
  const weekdayHours = Array(7).fill(0);
  const weekdayCount = Array(7).fill(0);
  for (let i = 0; i < days; i++) weekdayCount[new Date((firstDay + i) * DAY).getUTCDay()]++;

  for (const r of mine) {
    const s = new Date(r.start).getTime();
    const e = effectiveEnd(r, now);
    for (let t = Math.floor(s / HOUR) * HOUR; t < e; t += HOUR) {
      const di = Math.floor(t / DAY) - firstDay;
      if (di < 0 || di >= days) continue;
      const h = new Date(t).getUTCHours();
      if (!grid[di][h]) {
        grid[di][h] = true;
        weekdayHours[new Date(t).getUTCDay()]++;
      }
    }
  }
  const hourly = Array.from({ length: 24 }, (_, h) => grid.reduce((n, row) => n + (row[h] ? 1 : 0), 0) / days);
  const weekday = weekdayHours.map((n, i) => (weekdayCount[i] ? n / weekdayCount[i] : 0));

  const windows = findWindows(hourly, threshold);

  const weekAgo = now.getTime() - 7 * DAY;
  const recent = mine.filter((r) => new Date(r.start).getTime() >= weekAgo);
  const hoursOffLast7 = recent.reduce((s, r) => s + (effectiveEnd(r, now) - new Date(r.start).getTime()) / HOUR, 0);
  const durations = mine.filter((r) => r.end).map((r) => (new Date(r.end!).getTime() - new Date(r.start).getTime()) / HOUR);
  const avgDurationHours = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const totalOffHours = grid.flat().filter(Boolean).length;
  const reliability = 1 - totalOffHours / (days * 24);
  const ongoing = mine.find((r) => isOngoing(r, now)) || null;

  return {
    area,
    days,
    hourly,
    weekday,
    windows,
    outagesLast7: recent.length,
    hoursOffLast7,
    avgDurationHours,
    reliability,
    nextLikely: nextLikely(windows, now),
    ongoing,
  };
}

/** Contiguous runs of hours above threshold, handling runs that wrap past midnight. */
export function findWindows(hourly: number[], threshold: number): Window[] {
  const above = hourly.map((p) => p >= threshold);
  if (above.every(Boolean)) return [{ startHour: 0, endHour: 24, probability: avg(hourly), label: 'All day' }];
  // rotate so we start on a "below" hour, making wrap-around runs contiguous
  const offset = above.indexOf(false);
  const runs: Window[] = [];
  let runStart = -1;
  for (let i = 1; i <= 24; i++) {
    const h = (offset + i) % 24;
    if (above[h] && runStart < 0) runStart = offset + i;
    if ((!above[h] || i === 24) && runStart >= 0) {
      const endAbs = above[h] ? offset + i + 1 : offset + i;
      const hours = Array.from({ length: endAbs - runStart }, (_, k) => hourly[(runStart + k) % 24]);
      const startHour = runStart % 24;
      const endHour = endAbs % 24;
      runs.push({ startHour, endHour, probability: Math.max(...hours), label: `${fmtHour(startHour)}–${fmtHour(endHour)}` });
      runStart = -1;
    }
  }
  return runs.sort((a, b) => b.probability - a.probability);
}

function nextLikely(windows: Window[], now: Date) {
  if (!windows.length) return null;
  const nowH = now.getUTCHours() + now.getUTCMinutes() / 60;
  let best: { at: Date; window: Window; inHours: number } | null = null;
  for (const w of windows) {
    let inHours = w.startHour - nowH;
    const len = (w.endHour - w.startHour + 24) % 24 || 24;
    const inside = ((nowH - w.startHour + 24) % 24) < len;
    if (inside) inHours = 0;
    else if (inHours < 0) inHours += 24;
    if (!best || inHours < best.inHours) {
      const at = inside ? now : new Date(now.getTime() + inHours * HOUR);
      if (!inside) at.setUTCMinutes(0, 0, 0);
      best = { at, window: w, inHours };
    }
  }
  return best ? { at: best.at, window: best.window } : null;
}

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/** Count of ongoing outages per area right now (for map colouring). */
export function liveStatus(reports: OutageReport[], now = new Date()) {
  const map = new Map<string, { ongoing: OutageReport | null; last24: number }>();
  for (const a of AREAS) map.set(a.id, { ongoing: null, last24: 0 });
  for (const r of reports) {
    const m = map.get(r.area);
    if (!m) continue;
    if (isOngoing(r, now)) m.ongoing = r;
    if (now.getTime() - new Date(r.start).getTime() < DAY) m.last24++;
  }
  return map;
}

export function nearestArea(lat: number, lng: number): Area {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dist = (a: Area) => {
    const dLat = rad(a.lat - lat);
    const dLng = rad(a.lng - lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(a.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(x));
  };
  return AREAS.reduce((best, a) => (dist(a) < dist(best) ? a : best), AREAS[0]);
}

export function toCsv(reports: OutageReport[]) {
  const rows = [['id', 'area', 'city', 'start', 'end', 'confirmations', 'source', 'note']];
  for (const r of reports) {
    const a = areaById(r.area);
    rows.push([r.id, a?.name ?? r.area, a?.city ?? '', r.start, r.end ?? '', String(r.confirmations), r.source, r.note.replace(/"/g, '""')]);
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
}
