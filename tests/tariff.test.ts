import { describe, expect, it } from 'vitest';
import { bandAdvice, monthlyBill } from '../src/lib/tariff';

describe('monthlyBill (PURC Q4 2026)', () => {
  it('bills lifeline customers at 89.9315 GHp/kWh plus GH₵2.13 service charge', () => {
    const b = monthlyBill(30);
    expect(b.band).toBe('lifeline');
    expect(b.totalCedis).toBeCloseTo(30 * 0.899315 + 2.13, 2);
  });

  it('drops the lifeline rate entirely once usage passes 30 kWh (exclusive band)', () => {
    const b = monthlyBill(31);
    expect(b.band).toBe('standard');
    expect(b.totalCedis).toBeCloseTo(31 * 2.037509 + 10.730886, 2);
    expect(b.totalCedis).toBeGreaterThan(monthlyBill(30).totalCedis * 2);
  });

  it('charges units above 300 kWh at the higher block rate', () => {
    const b = monthlyBill(400);
    expect(b.band).toBe('high');
    expect(b.totalCedis).toBeCloseTo(300 * 2.037509 + 100 * 2.692235 + 10.730886, 2);
    expect(b.marginalRate).toBeCloseTo(2.692235, 5);
  });

  it('supports non-residential customers', () => {
    const b = monthlyBill(500, 'nonResidential');
    expect(b.totalCedis).toBeCloseTo(300 * 1.839549 + 200 * 2.240395 + 12.428245, 2);
  });

  it('handles zero usage', () => {
    expect(monthlyBill(0).totalCedis).toBeCloseTo(2.13, 2);
  });
});

describe('bandAdvice', () => {
  it('flags the lifeline cliff for households just above 30 kWh', () => {
    const a = bandAdvice(40);
    expect(a.kind).toBe('lifeline-cliff');
    expect(a.kwhToCut).toBeCloseTo(10);
    expect(a.monthlySaving).toBeGreaterThan(50);
  });
  it('flags the high block above 300 kWh', () => {
    const a = bandAdvice(360);
    expect(a.kind).toBe('high-band');
    expect(a.kwhToCut).toBeCloseTo(60);
    expect(a.monthlySaving).toBeCloseTo(60 * 2.692235, 1);
  });
});
