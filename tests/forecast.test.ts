import { describe, expect, it } from 'vitest';
import { effectiveDailyUse, forecast, topUpFor } from '../src/lib/forecast';

const base = { balance: 50, unit: 'kwh' as const, dailyKwh: 5, outageHoursPerDay: 0, customer: 'residential' as const, start: '2026-10-15T00:00:00Z' };

describe('credit forecaster', () => {
  it('divides kWh balance by daily use', () => {
    const f = forecast(base);
    expect(f.days).toBeCloseTo(10);
    expect(f.runOutDate.toISOString().slice(0, 10)).toBe('2026-10-25');
    expect(f.series[0].kwh).toBe(50);
    expect(f.series.at(-1)!.kwh).toBeCloseTo(0);
  });

  it('stretches credit when outages stop the meter', () => {
    expect(effectiveDailyUse(6, 6)).toBeCloseTo(4.5);
    expect(forecast({ ...base, outageHoursPerDay: 6 }).days).toBeGreaterThan(13);
  });

  it('converts a cedi balance with the household average rate', () => {
    const f = forecast({ ...base, unit: 'cedis', balance: 100 });
    expect(f.ratePerKwh).toBeGreaterThan(2);
    expect(f.balanceKwh).toBeCloseTo(100 / f.ratePerKwh);
  });

  it('computes the top-up needed to reach a date', () => {
    const t = topUpFor(base, new Date('2026-11-14T00:00:00Z'));
    expect(t.kwhNeeded).toBeCloseTo(30 * 5 - 50);
    expect(t.cedisNeeded).toBeGreaterThan(0);
  });
});
