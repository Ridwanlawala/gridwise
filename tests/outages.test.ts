import { describe, expect, it } from 'vitest';
import { analyseArea, findWindows, generateDemoReports, nearestArea, type OutageReport } from '../src/lib/outages';

const now = new Date('2026-10-15T12:00:00Z');

describe('findWindows', () => {
  it('finds a simple evening window', () => {
    const h = Array(24).fill(0);
    [18, 19, 20, 21].forEach((i) => (h[i] = 0.6));
    const w = findWindows(h, 0.3);
    expect(w).toHaveLength(1);
    expect(w[0].label).toBe('18:00–22:00');
  });
  it('joins windows that wrap past midnight', () => {
    const h = Array(24).fill(0);
    [22, 23, 0, 1].forEach((i) => (h[i] = 0.5));
    const w = findWindows(h, 0.3);
    expect(w).toHaveLength(1);
    expect(w[0].startHour).toBe(22);
    expect(w[0].endHour).toBe(2);
  });
});

describe('analyseArea', () => {
  it('learns the outage window from reports', () => {
    const reports: OutageReport[] = [];
    for (let d = 1; d <= 28; d++) {
      const day = new Date(now.getTime() - d * 86_400_000);
      day.setUTCHours(18, 0, 0, 0);
      reports.push({ id: `r${d}`, area: 'madina', start: day.toISOString(), end: new Date(day.getTime() + 3 * 3_600_000).toISOString(), note: '', confirmations: 1, source: 'user', createdAt: day.toISOString() });
    }
    const a = analyseArea(reports, 'madina', now);
    expect(a.hourly[19]).toBeCloseTo(1);
    expect(a.hourly[12]).toBe(0);
    expect(a.windows[0].label).toBe('18:00–21:00');
    expect(a.nextLikely!.at.getUTCHours()).toBe(18);
    expect(a.avgDurationHours).toBeCloseTo(3);
  });

  it('recovers the seeded demo pattern for Madina (evenings)', () => {
    const a = analyseArea(generateDemoReports(now), 'madina', now);
    const peak = a.hourly.indexOf(Math.max(...a.hourly));
    expect(peak).toBeGreaterThanOrEqual(17);
    expect(peak).toBeLessThanOrEqual(22);
  });
});

describe('nearestArea', () => {
  it('maps Kumasi coordinates to a Kumasi area', () => {
    expect(nearestArea(6.69, -1.62).city).toBe('Kumasi');
  });
});
