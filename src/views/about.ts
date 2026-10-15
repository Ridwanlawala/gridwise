import { ACTIVE_TARIFF } from '../lib/tariff';
import { toast } from '../lib/format';
import { resetState } from '../lib/state';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; }
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e as BeforeInstallPromptEvent; });

export function renderAbout(root: HTMLElement) {
  root.innerHTML = `
  <section class="grid two">
    <div class="stack">
      <div class="card prose">
        <h2>Why GridWise?</h2>
        <p>Ghanaian households and small businesses live with two energy problems at once: prepaid credit that runs out without warning, and <em>dumsor</em>, unplanned outages that ruin food, stop work and push people onto expensive generators.</p>
        <p>GridWise puts three tools in one offline-first app:</p>
        <ul>
          <li><strong>⚡ Energy planner</strong>: what each appliance costs per day in cedis under the current PURC tariff, which band you're in, and the cheapest changes that drop you into a lower band.</li>
          <li><strong>🔋 Credit forecaster</strong>: how many days your units will last, when to top up, and how much to buy to reach a date.</li>
          <li><strong>🗺️ Community outage map</strong>: one-tap outage reports by area, a live map, and an hour-by-hour model of when your area usually goes off.</li>
        </ul>
      </div>
      <div class="card prose">
        <h2>Data &amp; accuracy</h2>
        <p>Tariffs: <strong>${ACTIVE_TARIFF.label}</strong>, effective ${ACTIVE_TARIFF.effective}, from the <a href="${ACTIVE_TARIFF.sourceUrl}" target="_blank" rel="noopener">PURC tariff schedule</a>. Lifeline (0–30 kWh, exclusive): GH₵0.8993/kWh + GH₵2.13/month. Other residential: GH₵2.0375/kWh up to 300 kWh, GH₵2.6922/kWh above, + GH₵10.73/month.</p>
        <p class="muted small">Levies and VAT are not included, so estimates are approximate. Appliance wattages are typical values; check the label on yours for accuracy.</p>
        <p>Outage data in this demo is <strong>simulated community reports</strong> (stored on your device in IndexedDB). Your own reports are saved locally too.</p>
      </div>
    </div>
    <div class="stack">
      <div class="card prose">
        <h2>Works offline</h2>
        <p>GridWise is a Progressive Web App. After your first visit it loads with no data connection, and map tiles you've viewed are cached. Install it to your home screen for one-tap access.</p>
        <p>Status: <strong id="ab-net"></strong> · Service worker: <strong id="ab-sw"></strong></p>
        <button class="btn primary" id="ab-install">📲 Install app</button>
      </div>
      <div class="card prose">
        <h2>Privacy</h2>
        <p>No account, no tracking, no server. Everything you enter stays in your browser.</p>
        <button class="btn ghost" id="ab-reset">Reset my planner data</button>
      </div>
      <div class="card prose small">
        <p>Built for the Tech Hub Africa Hackathon 2026 · Electricity Efficiency track. MIT licensed. Map © OpenStreetMap contributors.</p>
      </div>
    </div>
  </section>`;
  const net = root.querySelector('#ab-net')!;
  const sw = root.querySelector('#ab-sw')!;
  net.textContent = navigator.onLine ? 'Online' : 'Offline';
  sw.textContent = 'checking…';
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((r) => (sw.textContent = r?.active ? 'active ✅' : 'not yet active'));
  } else sw.textContent = 'not supported';
  root.querySelector('#ab-install')!.addEventListener('click', async () => {
    if (deferredPrompt) { await deferredPrompt.prompt(); deferredPrompt = null; }
    else toast('Use your browser menu → "Add to Home screen"');
  });
  root.querySelector('#ab-reset')!.addEventListener('click', () => { resetState(); toast('Planner reset to the starter household'); });
}
