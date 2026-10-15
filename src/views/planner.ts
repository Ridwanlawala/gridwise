import { Chart } from '../lib/chart';
import { backupSizing, dailyKwh, fromPreset, PRESETS, savingTips, totalDailyKwh, type ApplianceItem } from '../lib/appliances';
import { cedis, esc, kwh, toast } from '../lib/format';
import { state, update } from '../lib/state';
import { ACTIVE_TARIFF, bandAdvice, monthlyBill } from '../lib/tariff';

const CATEGORY_LABEL: Record<string, string> = {
  lighting: 'Lighting', cooling: 'Cooling', kitchen: 'Kitchen', media: 'Media & devices', laundry: 'Laundry', business: 'Small business', other: 'Other',
};

export function renderPlanner(root: HTMLElement) {
  const groups = Object.entries(CATEGORY_LABEL).map(([cat, label]) => {
    const opts = PRESETS.filter((p) => p.category === cat).map((p) => `<option value="${p.id}">${p.icon} ${esc(p.name)} · ${p.watts} W</option>`).join('');
    return `<optgroup label="${label}">${opts}</optgroup>`;
  }).join('');

  root.innerHTML = `
  <section class="grid two">
    <div class="stack">
      <div class="card hero" id="plan-hero"></div>
      <div class="card">
        <div class="card-head">
          <h2>Your appliances</h2>
          <div class="seg" role="group" aria-label="Customer type">
            <button data-customer="residential">🏠 Home</button>
            <button data-customer="nonResidential">🏪 Business</button>
          </div>
        </div>
        <form class="add-row" id="add-form">
          <label class="sr" for="preset">Appliance</label>
          <select id="preset">${groups}</select>
          <button class="btn primary" type="submit">+ Add</button>
        </form>
        <ul class="appliances" id="app-list"></ul>
        <p class="muted small">Hours slider = hours switched on per day. Tap 🔋 to mark a load as essential for backup sizing.</p>
      </div>
    </div>
    <div class="stack">
      <div class="card" id="advice"></div>
      <div class="card"><h2>Biggest savings</h2><ol class="tips" id="tips"></ol></div>
      <div class="card"><h2>Where your units go</h2><div class="chart-box donut"><canvas id="share-chart" aria-label="Energy share by appliance"></canvas></div></div>
      <div class="card" id="bill"></div>
      <div class="card" id="backup"></div>
    </div>
  </section>`;

  const list = root.querySelector<HTMLUListElement>('#app-list')!;
  let chart: Chart | null = null;
  let backupHours = 4;

  const syncSeg = () => root.querySelectorAll<HTMLButtonElement>('[data-customer]').forEach((b) => b.classList.toggle('on', b.dataset.customer === state.customer));
  root.querySelectorAll<HTMLButtonElement>('[data-customer]').forEach((b) =>
    b.addEventListener('click', () => { update((s) => (s.customer = b.dataset.customer as typeof s.customer)); syncSeg(); refresh(); }),
  );
  syncSeg();

  root.querySelector('#add-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = root.querySelector<HTMLSelectElement>('#preset')!.value;
    const p = PRESETS.find((x) => x.id === id)!;
    update((s) => s.appliances.push(fromPreset(p)));
    renderList();
    refresh();
    toast(`${p.icon} ${p.name} added`);
  });

  function rowHtml(a: ApplianceItem) {
    return `<li class="appl" data-uid="${a.uid}">
      <div class="appl-top">
        <span class="appl-icon" aria-hidden="true">${a.icon}</span>
        <div class="appl-name"><strong>${esc(a.name)}</strong><span class="muted small">${a.watts} W${a.duty < 1 ? ` · cycles ~${Math.round(a.duty * 100)}%` : ''}</span></div>
        <span class="appl-kwh" data-f="kwh">${kwh(dailyKwh(a), 2)}/day</span>
      </div>
      <div class="appl-bottom">
        <div class="qty" aria-label="Quantity">
          <button data-act="dec" aria-label="Fewer">−</button><span data-f="qty">${a.qty}</span><button data-act="inc" aria-label="More">+</button>
        </div>
        <input type="range" min="0" max="24" step="0.25" value="${a.hours}" data-act="hours" aria-label="Hours per day for ${esc(a.name)}" />
        <span class="hours" data-f="hours">${a.hours} h/day</span>
        <button class="icon-btn ess ${a.essential ? 'on' : ''}" data-act="ess" title="Essential on backup" aria-pressed="${a.essential}">🔋</button>
        <button class="icon-btn" data-act="del" aria-label="Remove ${esc(a.name)}">✕</button>
      </div>
    </li>`;
  }

  function renderList() {
    list.innerHTML = state.appliances.length ? state.appliances.map(rowHtml).join('') : '<li class="empty">No appliances yet. Add one above.</li>';
  }

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!btn) return;
    const li = btn.closest<HTMLLIElement>('li')!;
    const uid = li.dataset.uid!;
    const act = btn.dataset.act;
    update((s) => {
      const a = s.appliances.find((x) => x.uid === uid);
      if (!a) return;
      if (act === 'inc') a.qty = Math.min(50, a.qty + 1);
      if (act === 'dec') a.qty = Math.max(1, a.qty - 1);
      if (act === 'ess') a.essential = !a.essential;
      if (act === 'del') s.appliances = s.appliances.filter((x) => x.uid !== uid);
    });
    if (act === 'del') renderList();
    else {
      const a = state.appliances.find((x) => x.uid === uid)!;
      li.querySelector('[data-f="qty"]')!.textContent = String(a.qty);
      li.querySelector('[data-f="kwh"]')!.textContent = `${kwh(dailyKwh(a), 2)}/day`;
      btn.classList.toggle('on', act === 'ess' ? a.essential : btn.classList.contains('on'));
      if (act === 'ess') btn.setAttribute('aria-pressed', String(a.essential));
    }
    refresh();
  });

  list.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.act !== 'hours') return;
    const li = input.closest<HTMLLIElement>('li')!;
    update((s) => {
      const a = s.appliances.find((x) => x.uid === li.dataset.uid);
      if (a) a.hours = Number(input.value);
    });
    const a = state.appliances.find((x) => x.uid === li.dataset.uid)!;
    li.querySelector('[data-f="hours"]')!.textContent = `${a.hours} h/day`;
    li.querySelector('[data-f="kwh"]')!.textContent = `${kwh(dailyKwh(a), 2)}/day`;
    refresh();
  });

  function refresh() {
    const daily = totalDailyKwh(state.appliances);
    const monthly = daily * 30;
    const bill = monthlyBill(monthly, state.customer);
    const advice = bandAdvice(monthly, state.customer);

    // band meter: 0–30–300–450 scale
    const max = 450;
    const pos = Math.min(100, (monthly / max) * 100);
    root.querySelector('#plan-hero')!.innerHTML = `
      <p class="eyebrow">Estimated monthly bill · ${ACTIVE_TARIFF.label}</p>
      <div class="big">${cedis(bill.totalCedis)}</div>
      <div class="hero-stats">
        <div><span>${kwh(daily, 2)}</span><small>per day</small></div>
        <div><span>${kwh(monthly, 0)}</span><small>per month</small></div>
        <div><span>${cedis(bill.totalCedis / 30)}</span><small>per day</small></div>
      </div>
      <div class="band-meter" aria-label="Tariff band position">
        ${state.customer === 'residential' ? `<div class="seg-l" style="width:${(30 / max) * 100}%" title="Lifeline 0–30 kWh">≤30</div>` : ''}
        <div class="seg-s" style="width:${((300 - (state.customer === 'residential' ? 30 : 0)) / max) * 100}%">0–300</div>
        <div class="seg-h">301+</div>
        <div class="marker" style="left:${pos}%"><span>${Math.round(monthly)}</span></div>
      </div>
      <span class="chip band-${bill.band}">${bill.bandLabel}</span>
      <span class="chip ghost">Effective ${cedis(bill.effectiveRate)}/kWh</span>`;

    root.querySelector('#advice')!.innerHTML = `
      <div class="advice ${advice.kind}">
        <h2>${advice.kwhToCut > 0 ? '⬇️ ' : '✅ '}${esc(advice.title)}</h2>
        <p>${esc(advice.detail)}</p>
        ${advice.monthlySaving > 0 ? `<p class="saving">Save about <strong>${cedis(advice.monthlySaving)}</strong> a month</p>` : ''}
      </div>`;

    const tips = savingTips(state.appliances, bill.marginalRate);
    root.querySelector('#tips')!.innerHTML = tips.length
      ? tips.map((t) => `<li><span>${esc(t.text)}</span><strong>−${cedis(t.cedisPerMonth)}<small>/mo</small></strong></li>`).join('')
      : '<li class="muted">Your setup is already lean. Nice.</li>';

    root.querySelector('#bill')!.innerHTML = `
      <h2>Bill breakdown</h2>
      <table class="tbl">
        <thead><tr><th>Block</th><th>kWh</th><th>Rate</th><th>Cost</th></tr></thead>
        <tbody>
          ${bill.lines.map((l) => `<tr><td>${l.label}</td><td>${l.kwh.toFixed(1)}</td><td>${cedis(l.rate, 4)}</td><td>${cedis(l.cedis)}</td></tr>`).join('')}
          <tr><td colspan="3">Service charge</td><td>${cedis(bill.serviceCedis)}</td></tr>
        </tbody>
        <tfoot><tr><td colspan="3">Total (before levies &amp; taxes)</td><td>${cedis(bill.totalCedis)}</td></tr></tfoot>
      </table>
      <p class="muted small">Rates: <a href="${ACTIVE_TARIFF.sourceUrl}" target="_blank" rel="noopener">PURC tariff schedule</a>, effective ${ACTIVE_TARIFF.effective}. Levies and VAT are not included, so treat this as approximate.</p>`;

    renderBackup();
    renderChart();
  }

  function renderBackup() {
    const b = backupSizing(state.appliances, backupHours);
    const el = root.querySelector<HTMLElement>('#backup')!;
    el.innerHTML = `
      <h2>🔋 Dumsor backup sizing</h2>
      <label class="field inline">Cover an outage of
        <input type="number" id="bk-hours" min="1" max="24" value="${backupHours}" /> hours
      </label>
      ${b.essentials.length ? `
      <div class="kpis">
        <div><span>${Math.round(b.averageWatts)} W</span><small>avg essential load</small></div>
        <div><span>${b.inverterVA} VA</span><small>inverter size</small></div>
        <div><span>${Math.ceil(b.lithiumAh)} Ah</span><small>12 V lithium</small></div>
        <div><span>${Math.ceil(b.leadAcidAh)} Ah</span><small>12 V lead-acid</small></div>
      </div>
      <p class="muted small">Essentials: ${b.essentials.map((a) => `${a.icon} ${esc(a.name)}${a.qty > 1 ? ` ×${a.qty}` : ''}`).join(', ')}. Sized for 50% depth of discharge (lead-acid), 80% (lithium) and 85% inverter efficiency.</p>`
      : '<p class="muted">Tap 🔋 on the loads you want running during outages.</p>'}`;
    el.querySelector<HTMLInputElement>('#bk-hours')!.addEventListener('change', (e) => {
      backupHours = Math.min(24, Math.max(1, Number((e.target as HTMLInputElement).value) || 4));
      renderBackup();
    });
  }

  function renderChart() {
    const items = [...state.appliances].map((a) => ({ label: `${a.icon} ${a.name}`, v: dailyKwh(a) })).sort((a, b) => b.v - a.v);
    const top = items.slice(0, 6);
    const rest = items.slice(6).reduce((s, x) => s + x.v, 0);
    if (rest > 0) top.push({ label: 'Other', v: rest });
    const data = { labels: top.map((t) => t.label), datasets: [{ data: top.map((t) => +t.v.toFixed(3)), backgroundColor: ['#006b3f', '#f2b705', '#ce1126', '#2a9d8f', '#264653', '#e76f51', '#9aa5b1'], borderWidth: 0 }] };
    if (chart) {
      chart.data = data;
      chart.update();
      return;
    }
    chart = new Chart(root.querySelector<HTMLCanvasElement>('#share-chart')!, {
      type: 'doughnut',
      data,
      options: {
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: window.innerWidth < 600 ? 'bottom' : 'right', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => ` ${(c.raw as number).toFixed(2)} kWh/day` } },
        },
      },
    });
  }

  renderList();
  refresh();
  return () => chart?.destroy();
}
