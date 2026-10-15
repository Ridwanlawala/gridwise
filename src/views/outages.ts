import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Chart } from '../lib/chart';
import { cedis, dateTimeGh, esc, pct, relative, timeGh, toast } from '../lib/format';
import { analyseArea, AREAS, areaById, fmtHour, generateDemoReports, liveStatus, nearestArea, toCsv, type OutageReport } from '../lib/outages';
import { state, update } from '../lib/state';
import { clearAll, getAll, putMany } from '../lib/store';
import { monthlyBill } from '../lib/tariff';
import { totalDailyKwh } from '../lib/appliances';

const SEED_FLAG = 'gridwise.seededAt';

/** Seed demo data on first run, and refresh it when it has gone stale (> 1 day old). */
export async function ensureDemoData() {
  const seededAt = Number(localStorage.getItem(SEED_FLAG) || 0);
  if (Date.now() - seededAt < 86_400_000) return;
  const existing = await getAll<OutageReport>();
  const userReports = existing.filter((r) => r.source === 'user');
  await clearAll();
  await putMany([...generateDemoReports(), ...userReports]);
  localStorage.setItem(SEED_FLAG, String(Date.now()));
}

export function renderOutages(root: HTMLElement) {
  const options = AREAS.map((a) => `<option value="${a.id}">${a.name} · ${a.city}</option>`).join('');
  root.innerHTML = `
  <section class="grid two">
    <div class="stack">
      <div class="card map-card">
        <div class="card-head">
          <h2>Live outage map</h2>
          <div class="legend"><span class="dot red"></span>Off now <span class="dot amber"></span>Off in 24 h <span class="dot green"></span>Stable</div>
        </div>
        <div id="map" role="region" aria-label="Map of outage reports"></div>
      </div>
      <div class="card">
        <h2>Report your area</h2>
        <div class="field">
          <label for="ot-area">Area</label>
          <div class="input-group">
            <select id="ot-area">${options}</select>
            <button class="btn" id="ot-locate" type="button" title="Use my location">📍 Near me</button>
          </div>
        </div>
        <details class="more">
          <summary>Add details (optional)</summary>
          <div class="field"><label for="ot-start">Went off at</label><input id="ot-start" type="time" /></div>
          <div class="field"><label for="ot-note">Note</label><input id="ot-note" type="text" maxlength="120" placeholder="e.g. whole street off, transformer noise" /></div>
        </details>
        <div class="report-btns">
          <button class="btn big danger" id="ot-off">⚡ Lights out</button>
          <button class="btn big success" id="ot-on">💡 Power is back</button>
        </div>
      </div>
    </div>
    <div class="stack">
      <div class="card" id="ot-status"></div>
      <div class="card">
        <div class="card-head"><h2>When does it usually go off?</h2><span class="muted small">last 28 days · Ghana time</span></div>
        <div class="chart-box"><canvas id="ot-chart" aria-label="Outage probability by hour"></canvas></div>
        <div id="ot-windows"></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Recent reports</h2>
          <div class="row-btns"><button class="btn small" id="ot-csv">⬇ CSV</button><button class="btn small ghost" id="ot-reset">Reset demo</button></div>
        </div>
        <ul class="reports" id="ot-list"></ul>
      </div>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const areaSel = $<HTMLSelectElement>('#ot-area');
  areaSel.value = state.area;
  let reports: OutageReport[] = [];
  let chart: Chart | null = null;
  const markers = new Map<string, L.CircleMarker>();

  const map = L.map($('#map'), { zoomControl: true, attributionControl: true }).setView([6.6, -1.0], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 50);

  function drawMarkers() {
    const live = liveStatus(reports);
    for (const a of AREAS) {
      const s = live.get(a.id)!;
      const color = s.ongoing ? '#ce1126' : s.last24 ? '#f2b705' : '#1a9e5c';
      const popup = `<strong>${a.name}</strong>, ${a.city}<br>${s.ongoing ? `⚡ Off since ${timeGh(new Date(s.ongoing.start))} · ${s.ongoing.confirmations} reports` : s.last24 ? `${s.last24} outage(s) in last 24 h` : 'No outages in last 24 h'}`;
      let m = markers.get(a.id);
      if (!m) {
        m = L.circleMarker([a.lat, a.lng], { radius: 10, weight: 2, color: '#fff', fillOpacity: 0.9 }).addTo(map);
        m.on('click', () => selectArea(a.id, false));
        markers.set(a.id, m);
      }
      m.setStyle({ fillColor: color, radius: a.id === state.area ? 14 : 10, weight: a.id === state.area ? 3 : 2 });
      m.bindPopup(popup);
    }
  }

  function selectArea(id: string, fly = true) {
    update((s) => (s.area = id));
    areaSel.value = id;
    const a = areaById(id)!;
    if (fly) map.flyTo([a.lat, a.lng], 11, { duration: 0.8 });
    else markers.get(id)?.openPopup();
    renderInsight();
    drawMarkers();
  }

  function renderInsight() {
    const a = areaById(state.area)!;
    const an = analyseArea(reports, a.id);
    const next = an.nextLikely;
    const bill = monthlyBill(totalDailyKwh(state.appliances) * 30, state.customer);
    $('#ot-status').innerHTML = `
      <div class="status ${an.ongoing ? 'off' : 'on'}">
        <div class="status-dot"></div>
        <div>
          <p class="eyebrow">${esc(a.name)}, ${esc(a.city)}</p>
          <h2>${an.ongoing ? `Power is OFF · since ${timeGh(new Date(an.ongoing.start))}` : 'Power is ON'}</h2>
          <p class="muted">${an.ongoing ? `${an.ongoing.confirmations} neighbour report(s) · ${relative(new Date(an.ongoing.start))}` : next ? `Next likely outage: <strong>${next.at.getTime() <= Date.now() + 60_000 ? 'now' : `${dateTimeGh(next.at)}`}</strong> (${next.window.label}, ${pct(next.window.probability)} of days)` : 'No regular outage pattern detected.'}</p>
        </div>
      </div>
      <div class="kpis">
        <div><span>${pct(an.reliability)}</span><small>supply reliability</small></div>
        <div><span>${an.outagesLast7}</span><small>outages · 7 days</small></div>
        <div><span>${an.hoursOffLast7.toFixed(0)} h</span><small>without power · 7 days</small></div>
        <div><span>${an.avgDurationHours.toFixed(1)} h</span><small>avg outage</small></div>
      </div>
      ${next ? `<p class="hint">💡 Plan ahead: charge phones, run the iron or pump before ${fmtHour(next.window.startHour)}. Keep the fridge shut during the outage: a closed fridge stays cold for about 4 hours. Typical outage here lasts ${an.avgDurationHours.toFixed(1)} h; at your ${cedis(bill.effectiveRate)}/kWh, a fully-charged 1 kWh battery costs about ${cedis(bill.effectiveRate)} to refill.</p>` : ''}`;

    const colors = an.hourly.map((p, h) => (an.windows.some((w) => inWindow(h, w.startHour, w.endHour)) ? '#ce1126' : p > 0 ? '#f2b705' : '#d9dee3'));
    const data = { labels: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')), datasets: [{ label: 'Chance of outage', data: an.hourly.map((p) => Math.round(p * 100)), backgroundColor: colors, borderRadius: 4 }] };
    if (chart) { chart.data = data; chart.update(); }
    else {
      chart = new Chart($<HTMLCanvasElement>('#ot-chart'), {
        type: 'bar',
        data,
        options: {
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }, x: { grid: { display: false }, title: { display: true, text: 'Hour of day (GMT)' } } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `${i[0].label}:00`, label: (c) => ` ${c.raw}% of days had an outage` } } },
        },
      });
    }
    $('#ot-windows').innerHTML = an.windows.length
      ? `<div class="windows">${an.windows.slice(0, 3).map((w) => `<span class="chip band-high">⚠ ${w.label} · ${pct(w.probability)}</span>`).join('')}</div>`
      : '<p class="muted small">No hour has outages on 30%+ of days. 🎉</p>';

    const mine = reports.filter((r) => r.area === a.id).sort((x, y) => y.start.localeCompare(x.start)).slice(0, 8);
    $('#ot-list').innerHTML = mine.map((r) => {
      const dur = r.end ? `${((new Date(r.end).getTime() - new Date(r.start).getTime()) / 3_600_000).toFixed(1)} h` : 'ongoing';
      return `<li class="${r.end ? '' : 'live'}">
        <div><strong>${dateTimeGh(new Date(r.start))}</strong> <span class="chip ${r.end ? 'ghost' : 'band-high'}">${dur}</span>${r.source === 'user' ? ' <span class="chip you">you</span>' : ''}<br><span class="muted small">${esc(r.note)}</span></div>
        <button class="btn small ghost" data-confirm="${r.id}" title="I had this outage too">👍 ${r.confirmations}</button>
      </li>`;
    }).join('') || '<li class="empty">No reports for this area yet.</li>';
  }

  async function reload() {
    reports = await getAll<OutageReport>();
    drawMarkers();
    renderInsight();
  }

  areaSel.addEventListener('change', () => selectArea(areaSel.value));

  $('#ot-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Location is not available on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => { const a = nearestArea(pos.coords.latitude, pos.coords.longitude); selectArea(a.id); toast(`📍 Nearest area: ${a.name}`); },
      () => toast('Could not get your location; pick your area instead'),
      { timeout: 8000 },
    );
  });

  $('#ot-off').addEventListener('click', async () => {
    const now = new Date();
    const ongoing = reports.find((r) => r.area === state.area && r.end === null);
    if (ongoing) {
      ongoing.confirmations++;
      await putMany([ongoing]);
      toast(`Confirmed: you and ${ongoing.confirmations - 1} neighbour(s) report power off`);
    } else {
      const t = $<HTMLInputElement>('#ot-start').value;
      const start = new Date(now);
      if (t) { const [h, m] = t.split(':').map(Number); start.setUTCHours(h, m, 0, 0); if (start > now) start.setUTCDate(start.getUTCDate() - 1); }
      const note = $<HTMLInputElement>('#ot-note').value.trim() || 'Reported from GridWise';
      await putMany([{ id: `user-${now.getTime()}`, area: state.area, start: start.toISOString(), end: null, note, confirmations: 1, source: 'user', createdAt: now.toISOString() }]);
      toast('⚡ Outage reported. Thanks for helping your neighbours!');
    }
    await reload();
  });

  $('#ot-on').addEventListener('click', async () => {
    const ongoing = reports.filter((r) => r.area === state.area && r.end === null);
    if (!ongoing.length) return toast('No open outage in this area');
    const now = new Date().toISOString();
    ongoing.forEach((r) => (r.end = now));
    await putMany(ongoing);
    toast('💡 Marked as restored');
    await reload();
  });

  $('#ot-list').addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-confirm]');
    if (!b) return;
    const r = reports.find((x) => x.id === b.dataset.confirm);
    if (!r) return;
    r.confirmations++;
    await putMany([r]);
    await reload();
  });

  $('#ot-csv').addEventListener('click', () => {
    const blob = new Blob([toCsv(reports)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gridwise-outages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#ot-reset').addEventListener('click', async () => {
    localStorage.removeItem(SEED_FLAG);
    await clearAll();
    await ensureDemoData();
    await reload();
    toast('Demo data regenerated');
  });

  reload();
  return () => { chart?.destroy(); map.remove(); };
}

function inWindow(h: number, start: number, end: number) {
  return end > start ? h >= start && h < end : h >= start || h < end;
}
