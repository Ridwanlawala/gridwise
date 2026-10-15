/**
 * Typical appliance ratings for Ghanaian homes and small shops.
 * `watts` is nameplate power; `duty` is the share of switched-on time the appliance actually draws
 * that power (compressors cycle, irons thermostat, etc.). Figures are typical ranges, not measurements.
 */
export interface AppliancePreset {
  id: string;
  name: string;
  icon: string;
  watts: number;
  hours: number;
  duty: number;
  category: 'cooling' | 'kitchen' | 'lighting' | 'media' | 'laundry' | 'business' | 'other';
  /** marks loads you would want on backup power during an outage */
  essential?: boolean;
  tip?: string;
}

export const PRESETS: AppliancePreset[] = [
  { id: 'led', name: 'LED bulb (9 W)', icon: '💡', watts: 9, hours: 6, duty: 1, category: 'lighting', essential: true },
  { id: 'cfl', name: 'Energy-saver bulb (20 W)', icon: '💡', watts: 20, hours: 6, duty: 1, category: 'lighting', tip: 'Swap for a 9 W LED: same light, about half the power.' },
  { id: 'incandescent', name: 'Filament bulb (60 W)', icon: '🔆', watts: 60, hours: 6, duty: 1, category: 'lighting', tip: 'A 9 W LED gives the same light for 85% less power.' },
  { id: 'fan', name: 'Standing fan', icon: '🌀', watts: 60, hours: 8, duty: 1, category: 'cooling', essential: true },
  { id: 'ceiling-fan', name: 'Ceiling fan', icon: '🌀', watts: 75, hours: 8, duty: 1, category: 'cooling' },
  { id: 'ac1', name: 'Air conditioner 1 HP', icon: '❄️', watts: 900, hours: 6, duty: 0.7, category: 'cooling', tip: 'Set to 24–25 °C and close doors; each degree cooler adds roughly 6–8% to AC use.' },
  { id: 'ac15', name: 'Air conditioner 1.5 HP', icon: '❄️', watts: 1300, hours: 6, duty: 0.7, category: 'cooling', tip: 'An inverter AC typically uses 30–40% less than a fixed-speed unit.' },
  { id: 'fridge', name: 'Fridge (table-top/double door)', icon: '🧊', watts: 150, hours: 24, duty: 0.4, category: 'kitchen', essential: true, tip: 'Keep the seal clean and leave a gap behind the coils; avoid opening during outages.' },
  { id: 'freezer', name: 'Chest freezer', icon: '🧊', watts: 200, hours: 24, duty: 0.45, category: 'kitchen', tip: 'A full freezer holds cold longer through dumsor; fill gaps with water bottles.' },
  { id: 'kettle', name: 'Electric kettle', icon: '🫖', watts: 2000, hours: 0.25, duty: 1, category: 'kitchen', tip: 'Boil only the water you need.' },
  { id: 'rice', name: 'Rice cooker', icon: '🍚', watts: 700, hours: 0.75, duty: 0.8, category: 'kitchen' },
  { id: 'blender', name: 'Blender', icon: '🥤', watts: 400, hours: 0.15, duty: 1, category: 'kitchen' },
  { id: 'microwave', name: 'Microwave', icon: '📦', watts: 1000, hours: 0.25, duty: 1, category: 'kitchen' },
  { id: 'hotplate', name: 'Electric hotplate', icon: '🍳', watts: 1500, hours: 1, duty: 0.8, category: 'kitchen', tip: 'Lids on pots cut cooking energy by up to a third.' },
  { id: 'tv', name: 'LED TV 32–43"', icon: '📺', watts: 70, hours: 5, duty: 1, category: 'media', essential: true },
  { id: 'decoder', name: 'Satellite decoder', icon: '📡', watts: 15, hours: 6, duty: 1, category: 'media', tip: 'Switch off at the wall: decoders draw power on standby all night.' },
  { id: 'phone', name: 'Phone charger', icon: '📱', watts: 10, hours: 3, duty: 1, category: 'media', essential: true },
  { id: 'laptop', name: 'Laptop', icon: '💻', watts: 65, hours: 6, duty: 0.8, category: 'media', essential: true },
  { id: 'router', name: 'Wi-Fi router', icon: '📶', watts: 12, hours: 24, duty: 1, category: 'media', essential: true },
  { id: 'iron', name: 'Pressing iron', icon: '👕', watts: 1200, hours: 0.5, duty: 0.6, category: 'laundry', tip: 'Iron in one batch per week instead of daily to avoid repeated heat-up.' },
  { id: 'washer', name: 'Washing machine', icon: '🧺', watts: 500, hours: 1, duty: 0.6, category: 'laundry' },
  { id: 'heater', name: 'Water heater', icon: '🚿', watts: 2000, hours: 1, duty: 0.8, category: 'other', tip: 'A timer or switching on 20 minutes before bathing saves a lot.' },
  { id: 'pump', name: 'Water pump (1 HP)', icon: '💧', watts: 750, hours: 1, duty: 1, category: 'other' },
  { id: 'clipper', name: 'Barbering clipper', icon: '💈', watts: 15, hours: 8, duty: 1, category: 'business' },
  { id: 'dryer', name: 'Salon hood dryer', icon: '💇', watts: 1200, hours: 4, duty: 0.7, category: 'business' },
  { id: 'sewing', name: 'Electric sewing machine', icon: '🧵', watts: 100, hours: 6, duty: 0.5, category: 'business' },
  { id: 'display-fridge', name: 'Drinks display fridge', icon: '🥤', watts: 300, hours: 24, duty: 0.5, category: 'business', tip: 'Glass-door coolers work hardest in the sun; move out of direct sunlight.' },
  { id: 'printer', name: 'Printer / photocopier', icon: '🖨️', watts: 400, hours: 2, duty: 0.4, category: 'business' },
];

export interface ApplianceItem {
  uid: string;
  presetId: string;
  name: string;
  icon: string;
  watts: number;
  hours: number;
  duty: number;
  qty: number;
  essential: boolean;
}

export function dailyKwh(a: Pick<ApplianceItem, 'watts' | 'hours' | 'duty' | 'qty'>): number {
  return (a.watts * a.hours * a.duty * a.qty) / 1000;
}

export function totalDailyKwh(items: ApplianceItem[]): number {
  return items.reduce((s, a) => s + dailyKwh(a), 0);
}

export function fromPreset(p: AppliancePreset, qty = 1): ApplianceItem {
  return {
    uid: `${p.id}-${Math.random().toString(36).slice(2, 8)}`,
    presetId: p.id,
    name: p.name,
    icon: p.icon,
    watts: p.watts,
    hours: p.hours,
    duty: p.duty,
    qty,
    essential: !!p.essential,
  };
}

export function presetById(id: string) {
  return PRESETS.find((p) => p.id === id);
}

export const STARTER_HOUSEHOLD: [string, number][] = [
  ['led', 6], ['fan', 2], ['fridge', 1], ['tv', 1], ['decoder', 1], ['phone', 3], ['iron', 1], ['ac1', 1],
];

export interface SavingTip {
  text: string;
  kwhPerMonth: number;
  cedisPerMonth: number;
}

/**
 * Concrete, quantified tips. Saving values use the household's marginal rate so they reflect
 * what actually comes off the bill.
 */
export function savingTips(items: ApplianceItem[], marginalRate: number): SavingTip[] {
  const tips: SavingTip[] = [];
  for (const a of items) {
    const p = presetById(a.presetId);
    const monthly = dailyKwh(a) * 30;
    if (a.presetId === 'incandescent' || a.presetId === 'cfl') {
      const led = dailyKwh({ ...a, watts: 9 }) * 30;
      tips.push({ text: `Swap ${a.qty}× ${a.name} for 9 W LEDs`, kwhPerMonth: monthly - led, cedisPerMonth: (monthly - led) * marginalRate });
    } else if (a.presetId.startsWith('ac') && a.hours > 2) {
      const saved = dailyKwh({ ...a, hours: 2 }) * 30;
      tips.push({ text: `Run ${a.name} 2 h less a day (use a fan for the evening)`, kwhPerMonth: saved, cedisPerMonth: saved * marginalRate });
    } else if (a.presetId === 'heater') {
      const saved = monthly * 0.5;
      tips.push({ text: 'Put the water heater on a 20-minute timer', kwhPerMonth: saved, cedisPerMonth: saved * marginalRate });
    } else if (a.presetId === 'iron' && a.hours >= 0.3) {
      const saved = monthly * 0.4;
      tips.push({ text: 'Iron once a week in one batch', kwhPerMonth: saved, cedisPerMonth: saved * marginalRate });
    } else if (a.presetId === 'decoder') {
      const standby = (8 * 16 * a.qty * 30) / 1000; // ~8 W standby, 16 h/day
      tips.push({ text: 'Switch the decoder off at the wall overnight', kwhPerMonth: standby, cedisPerMonth: standby * marginalRate });
    } else if (p?.tip && monthly > 15) {
      const saved = monthly * 0.15;
      tips.push({ text: `${a.name}: ${p.tip}`, kwhPerMonth: saved, cedisPerMonth: saved * marginalRate });
    }
  }
  return tips.filter((t) => t.kwhPerMonth > 0.2).sort((x, y) => y.cedisPerMonth - x.cedisPerMonth).slice(0, 5);
}

/**
 * Backup sizing for a dumsor window: energy the essential loads need for `hours`,
 * converted to battery amp-hours. Lead-acid is sized for 50% depth of discharge, lithium (LiFePO4) for 80%,
 * with ~85% inverter efficiency.
 */
export function backupSizing(items: ApplianceItem[], hours: number, systemVolts = 12) {
  const essentials = items.filter((a) => a.essential);
  const watts = essentials.reduce((s, a) => s + a.watts * a.duty * a.qty, 0);
  const peakWatts = essentials.reduce((s, a) => s + a.watts * a.qty, 0);
  const wh = (watts * hours) / 0.85;
  return {
    essentials,
    averageWatts: watts,
    inverterVA: Math.ceil((peakWatts * 1.25) / 100) * 100 || 0,
    energyWh: wh,
    leadAcidAh: wh / systemVolts / 0.5,
    lithiumAh: wh / systemVolts / 0.8,
  };
}
