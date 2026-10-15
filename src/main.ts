import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { renderAbout } from './views/about';
import { renderCredit } from './views/credit';
import { ensureDemoData, renderOutages } from './views/outages';
import { renderPlanner } from './views/planner';

type View = (root: HTMLElement) => void | (() => void);
const ROUTES: Record<string, { title: string; view: View }> = {
  planner: { title: 'Energy planner', view: renderPlanner },
  credit: { title: 'Credit forecast', view: renderCredit },
  outages: { title: 'Outage map', view: renderOutages },
  about: { title: 'About', view: renderAbout },
};

const main = document.querySelector<HTMLElement>('#view')!;
let cleanup: void | (() => void);

function route() {
  const key = location.hash.replace('#/', '') || 'planner';
  const r = ROUTES[key] ?? ROUTES.planner;
  if (typeof cleanup === 'function') cleanup();
  document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.route === key ? 'page' : 'false'));
  document.title = `${r.title} · GridWise`;
  main.classList.remove('enter');
  void main.offsetWidth;
  main.classList.add('enter');
  cleanup = r.view(main);
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function netStatus() {
  const pill = document.querySelector<HTMLElement>('#net')!;
  pill.textContent = navigator.onLine ? '● Online' : '● Offline mode';
  pill.classList.toggle('offline', !navigator.onLine);
}

window.addEventListener('hashchange', route);
window.addEventListener('online', netStatus);
window.addEventListener('offline', netStatus);
netStatus();

ensureDemoData().finally(route);

registerSW({ immediate: true });
