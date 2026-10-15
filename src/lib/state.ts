import { fromPreset, presetById, STARTER_HOUSEHOLD, totalDailyKwh, type ApplianceItem } from './appliances';
import { load, save } from './store';
import type { CustomerClass } from './tariff';

export interface AppState {
  customer: CustomerClass;
  appliances: ApplianceItem[];
  area: string;
  credit: { balance: number; unit: 'kwh' | 'cedis'; outageHours: number; target: string; useManual: boolean; manualDaily: number };
}

function starter(): ApplianceItem[] {
  return STARTER_HOUSEHOLD.map(([id, qty]) => fromPreset(presetById(id)!, qty));
}

const defaults = (): AppState => ({
  customer: 'residential',
  appliances: starter(),
  area: 'madina',
  credit: { balance: 60, unit: 'kwh', outageHours: 3, target: '', useManual: false, manualDaily: 4 },
});

export const state: AppState = { ...defaults(), ...load<Partial<AppState>>('state', {}) };

type Listener = () => void;
const listeners = new Set<Listener>();

export function update(mut: (s: AppState) => void) {
  mut(state);
  save('state', state);
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetState() {
  Object.assign(state, defaults());
  save('state', state);
  listeners.forEach((l) => l());
}

export const plannerDailyKwh = () => totalDailyKwh(state.appliances);
