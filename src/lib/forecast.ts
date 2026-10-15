import { monthlyBill, type CustomerClass } from './tariff';

export interface ForecastInput {
  balance: number;
  unit: 'kwh' | 'cedis';
  dailyKwh: number;
  /** average hours per day with no grid power; the meter does not run during outages */
  outageHoursPerDay: number;
  customer: CustomerClass;
  /** ISO date the forecast starts from */
  start: string;
}

export interface ForecastResult {
  balanceKwh: number;
  effectiveDailyKwh: number;
  ratePerKwh: number;
  days: number;
  runOutDate: Date;
  lowBalanceDate: Date;
  series: { date: Date; kwh: number; cedis: number }[];
}

export function effectiveDailyUse(dailyKwh: number, outageHoursPerDay: number) {
  const onShare = Math.min(1, Math.max(0, (24 - outageHoursPerDay) / 24));
  return dailyKwh * onShare;
}

/** Average cost of a kWh for this household, used to convert cedi balances to units. */
export function averageRate(dailyKwh: number, customer: CustomerClass) {
  const bill = monthlyBill(Math.max(dailyKwh * 30, 1), customer);
  return bill.effectiveRate;
}

const DAY = 86_400_000;

export function forecast(input: ForecastInput): ForecastResult {
  const daily = effectiveDailyUse(input.dailyKwh, input.outageHoursPerDay);
  const rate = averageRate(daily, input.customer);
  const balanceKwh = input.unit === 'kwh' ? input.balance : input.balance / rate;
  const days = daily > 0 ? balanceKwh / daily : Infinity;
  const start = new Date(input.start);
  const runOut = new Date(start.getTime() + (Number.isFinite(days) ? days : 3650) * DAY);
  const lowBalanceDate = new Date(runOut.getTime() - 2 * DAY);
  const series: ForecastResult['series'] = [];
  const horizon = Math.min(Math.ceil(Number.isFinite(days) ? days : 60), 90);
  for (let d = 0; d <= horizon; d++) {
    const kwh = Math.max(0, balanceKwh - daily * d);
    series.push({ date: new Date(start.getTime() + d * DAY), kwh, cedis: kwh * rate });
  }
  return { balanceKwh, effectiveDailyKwh: daily, ratePerKwh: rate, days, runOutDate: runOut, lowBalanceDate, series };
}

/** Cedis needed so that credit lasts until `target` (inclusive of the current balance). */
export function topUpFor(input: ForecastInput, target: Date) {
  const f = forecast(input);
  const daysNeeded = Math.max(0, (target.getTime() - new Date(input.start).getTime()) / DAY);
  const kwhNeeded = Math.max(0, daysNeeded * f.effectiveDailyKwh - f.balanceKwh);
  return { kwhNeeded, cedisNeeded: kwhNeeded * f.ratePerKwh, daysNeeded };
}
