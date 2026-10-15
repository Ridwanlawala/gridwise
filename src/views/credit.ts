import { Chart } from '../lib/chart';
import { forecast, topUpFor, type ForecastInput } from '../lib/forecast';
import { cedis, dateGh, kwh } from '../lib/format';
import { plannerDailyKwh, state, update } from '../lib/state';

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function renderCredit(root: HTMLElement) {
  const c = state.credit;
  if (!c.target) c.target = isoDate(new Date(Date.now() + 30 * DAY));

  root.innerHTML = `
  <section class="grid two">
    <div class="stack">
      <div class="card">
        <h2>Your prepaid meter</h2>
        <div class="field">
          <label for="cr-balance">Credit left on the meter</label>
          <div class="input-group">
            <input id="cr-balance" type="number" min="0" step="0.1" value="${c.balance}" inputmode="decimal" />
            <div class="seg small" role="group" aria-label="Unit">
              <button data-unit="kwh">kWh</button><button data-unit="cedis">GH₵</button>
            </div>
          </div>
        </div>
        <div class="field">
          <label for="cr-daily">Daily use</label>
          <div class="input-group">
            <input id="cr-daily" type="number" min="0" step="0.1" inputmode="decimal" />
            <span class="suffix">kWh/day</span>
          </div>
          <label class="check"><input type="checkbox" id="cr-planner" ${c.useManual ? '' : 'checked'} /> Use my appliance plan: <span id="cr-plan-val"></span></label>
        </div>
        <div class="field">
          <label for="cr-outage">Average outage hours per day: <strong id="cr-outage-val">${c.outageHours} h</strong></label>
          <input id="cr-outage" type="range" min="0" max="16" step="0.5" value="${c.outageHours}" />
          <p class="muted small">Your meter doesn't run when the grid is off, so dumsor stretches your units.</p>
        </div>
      </div>
      <div class="card">
        <h2>Top-up planner</h2>
        <div class="field">
          <label for="cr-target">I want my credit to last until</label>
          <input id="cr-target" type="date" value="${c.target}" />
        </div>
        <div id="cr-topup" class="topup"></div>
        <h3>Quick compare</h3>
        <div class="compare" id="cr-compare"></div>
      </div>
    </div>
    <div class="stack lead">
      <div class="card hero" id="cr-hero"></div>
      <div class="card"><h2>Credit burn-down</h2><div class="chart-box"><canvas id="cr-chart" aria-label="Remaining credit over time"></canvas></div></div>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  let chart: Chart | null = null;

  const daily = () => (c.useManual ? c.manualDaily : plannerDailyKwh());
  const input = (): ForecastInput => ({ balance: c.balance, unit: c.unit, dailyKwh: daily(), outageHoursPerDay: c.outageHours, customer: state.customer, start: new Date().toISOString() });

  const syncUnit = () => root.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) => b.classList.toggle('on', b.dataset.unit === c.unit));
  root.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) => b.addEventListener('click', () => { update((s) => (s.credit.unit = b.dataset.unit as 'kwh' | 'cedis')); syncUnit(); refresh(); }));

  $('#cr-balance').addEventListener('input', (e) => { update((s) => (s.credit.balance = Math.max(0, Number((e.target as HTMLInputElement).value) || 0))); refresh(); });
  $('#cr-daily').addEventListener('input', (e) => {
    update((s) => { s.credit.manualDaily = Math.max(0, Number((e.target as HTMLInputElement).value) || 0); s.credit.useManual = true; });
    $<HTMLInputElement>('#cr-planner').checked = false;
    refresh(false);
  });
  $('#cr-planner').addEventListener('change', (e) => { update((s) => (s.credit.useManual = !(e.target as HTMLInputElement).checked)); refresh(); });
  $('#cr-outage').addEventListener('input', (e) => {
    update((s) => (s.credit.outageHours = Number((e.target as HTMLInputElement).value)));
    $('#cr-outage-val').textContent = `${c.outageHours} h`;
    refresh();
  });
  $('#cr-target').addEventListener('change', (e) => { update((s) => (s.credit.target = (e.target as HTMLInputElement).value)); refresh(); });

  function refresh(syncDaily = true) {
    if (syncDaily) $<HTMLInputElement>('#cr-daily').value = daily().toFixed(2);
    $('#cr-plan-val').textContent = kwh(plannerDailyKwh(), 2);
    const f = forecast(input());
    const days = f.days;
    const tone = days < 3 ? 'danger' : days < 7 ? 'warn' : 'ok';
    $('#cr-hero').innerHTML = `
      <p class="eyebrow">Your credit lasts about</p>
      <div class="big ${tone}">${Number.isFinite(days) ? `${days < 10 ? days.toFixed(1) : Math.round(days)} days` : '—'}</div>
      <div class="hero-stats">
        <div><span>${kwh(f.balanceKwh, 1)}</span><small>units left</small></div>
        <div><span>${kwh(f.effectiveDailyKwh, 2)}</span><small>metered / day</small></div>
        <div><span>${cedis(f.ratePerKwh)}</span><small>avg per kWh</small></div>
      </div>
      ${Number.isFinite(days) ? `<p class="runout">Runs out around <strong>${dateGh(f.runOutDate)}</strong>. Top up by <strong>${dateGh(f.lowBalanceDate)}</strong> to avoid a blackout at night.</p>` : '<p class="runout">Add your daily use to see a forecast.</p>'}`;

    const target = new Date(`${c.target}T23:59:00Z`);
    const t = topUpFor(input(), target);
    $('#cr-topup').innerHTML = t.kwhNeeded > 0
      ? `<div class="big-sm">${cedis(Math.ceil(t.cedisNeeded))}</div><p>buys about <strong>${kwh(t.kwhNeeded, 0)}</strong> more, enough to reach ${dateGh(target)} (${Math.round(t.daysNeeded)} days).</p>`
      : `<div class="big-sm ok">No top-up needed</div><p>Your current credit already covers you to ${dateGh(target)}.</p>`;

    $('#cr-compare').innerHTML = [50, 100, 200, 500].map((amt) => {
      const extra = forecast({ ...input(), balance: amt, unit: 'cedis' });
      return `<div><strong>${cedis(amt, 0)}</strong><span>${kwh(extra.balanceKwh, 0)}</span><small>+${Number.isFinite(extra.days) ? Math.round(extra.days) : '—'} days</small></div>`;
    }).join('');

    renderChart(f.series);
  }

  function renderChart(series: ReturnType<typeof forecast>['series']) {
    const data = {
      labels: series.map((p) => dateGh(p.date)),
      datasets: [{ label: 'kWh left', data: series.map((p) => +p.kwh.toFixed(2)), borderColor: '#006b3f', backgroundColor: 'rgba(0,107,63,.12)', fill: true, tension: 0.25, pointRadius: 0 }],
    };
    if (chart) { chart.data = data; chart.update(); return; }
    chart = new Chart($<HTMLCanvasElement>('#cr-chart'), {
      type: 'line',
      data,
      options: {
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: 'kWh' } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  syncUnit();
  refresh();
  return () => chart?.destroy();
}
