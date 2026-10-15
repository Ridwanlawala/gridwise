/**
 * Ghana end-user electricity tariffs (PURC), Q4 2026 — effective 1 October 2026.
 *
 * Source: PURC 2026 Fourth Quarter Tariff Decision (24 Sept 2026)
 *   https://www.purc.com.gh/attachment/545028-20260924090934.pdf
 * Reported by: https://kumasimail.com/purc-keeps-electricity-water-tariffs-unchanged-for-fourth-quarter/
 *
 * Values are energy charges in Ghana pesewas (GHp) per kWh and service charges in GHp/month.
 * They EXCLUDE statutory levies and taxes (e.g. street-light levy, NESL, VAT where applicable),
 * so real bills and vend receipts will be somewhat higher. Treat results as approximate.
 */

export type CustomerClass = 'residential' | 'nonResidential';

export interface TariffBlock {
  /** upper bound of the block in kWh/month (Infinity for the last block) */
  upTo: number;
  /** GHp per kWh */
  ratePesewas: number;
}

export interface TariffSchedule {
  id: string;
  label: string;
  effective: string;
  sourceUrl: string;
  residential: {
    /** lifeline band is exclusive: only customers whose whole month stays <= limit get it */
    lifeline: { limit: number; ratePesewas: number; serviceChargePesewas: number };
    blocks: TariffBlock[];
    serviceChargePesewas: number;
  };
  nonResidential: {
    blocks: TariffBlock[];
    serviceChargePesewas: number;
  };
}

export const PURC_Q4_2026: TariffSchedule = {
  id: 'purc-2026-q4',
  label: 'PURC Q4 2026',
  effective: '2026-10-01',
  sourceUrl: 'https://www.purc.com.gh/attachment/545028-20260924090934.pdf',
  residential: {
    lifeline: { limit: 30, ratePesewas: 89.9315, serviceChargePesewas: 213.0 },
    blocks: [
      { upTo: 300, ratePesewas: 203.7509 },
      { upTo: Infinity, ratePesewas: 269.2235 },
    ],
    serviceChargePesewas: 1073.0886,
  },
  nonResidential: {
    blocks: [
      { upTo: 300, ratePesewas: 183.9549 },
      { upTo: Infinity, ratePesewas: 224.0395 },
    ],
    serviceChargePesewas: 1242.8245,
  },
};

export const ACTIVE_TARIFF = PURC_Q4_2026;

export type BandId = 'lifeline' | 'standard' | 'high';

export interface BillBreakdown {
  kwh: number;
  band: BandId;
  bandLabel: string;
  energyCedis: number;
  serviceCedis: number;
  totalCedis: number;
  /** average cost per kWh including service charge */
  effectiveRate: number;
  /** cost of the next kWh at this level of usage */
  marginalRate: number;
  lines: { label: string; kwh: number; rate: number; cedis: number }[];
}

const toCedis = (pesewas: number) => pesewas / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

function blockCost(kwh: number, blocks: TariffBlock[]) {
  let remaining = kwh;
  let lower = 0;
  const lines: BillBreakdown['lines'] = [];
  let marginal = toCedis(blocks[0].ratePesewas);
  for (const b of blocks) {
    if (remaining <= 0) break;
    const size = b.upTo - lower;
    const used = Math.min(remaining, size);
    const rate = toCedis(b.ratePesewas);
    const label = b.upTo === Infinity ? `${lower + 1}+ kWh` : `${lower === 0 ? 0 : lower + 1}–${b.upTo} kWh`;
    lines.push({ label, kwh: used, rate, cedis: used * rate });
    marginal = rate;
    remaining -= used;
    lower = b.upTo;
  }
  return { lines, energy: lines.reduce((s, l) => s + l.cedis, 0), marginal };
}

/** Monthly bill estimate for a given consumption (kWh/month). */
export function monthlyBill(
  kwh: number,
  customer: CustomerClass = 'residential',
  tariff: TariffSchedule = ACTIVE_TARIFF,
): BillBreakdown {
  const k = Math.max(0, kwh);
  if (customer === 'residential') {
    const r = tariff.residential;
    if (k <= r.lifeline.limit) {
      const rate = toCedis(r.lifeline.ratePesewas);
      const energy = k * rate;
      const service = toCedis(r.lifeline.serviceChargePesewas);
      return finish(k, 'lifeline', 'Lifeline (0–30 kWh)', energy, service, rate, [
        { label: '0–30 kWh lifeline', kwh: k, rate, cedis: energy },
      ]);
    }
    const { lines, energy, marginal } = blockCost(k, r.blocks);
    return finish(k, k > 300 ? 'high' : 'standard', k > 300 ? 'Above 300 kWh' : 'Standard (31–300 kWh)', energy, toCedis(r.serviceChargePesewas), marginal, lines);
  }
  const n = tariff.nonResidential;
  const { lines, energy, marginal } = blockCost(k, n.blocks);
  return finish(k, k > 300 ? 'high' : 'standard', k > 300 ? 'Above 300 kWh' : '0–300 kWh', energy, toCedis(n.serviceChargePesewas), marginal, lines);
}

function finish(
  kwh: number, band: BandId, bandLabel: string, energy: number, service: number, marginal: number,
  lines: BillBreakdown['lines'],
): BillBreakdown {
  const total = energy + service;
  return {
    kwh,
    band,
    bandLabel,
    energyCedis: round2(energy),
    serviceCedis: round2(service),
    totalCedis: round2(total),
    effectiveRate: kwh > 0 ? total / kwh : 0,
    marginalRate: marginal,
    lines: lines.map((l) => ({ ...l, cedis: round2(l.cedis) })),
  };
}

/**
 * Inverse: how many kWh does a prepaid top-up of `cedis` buy, given the household's
 * expected monthly consumption? Uses the effective (average) rate at that consumption level,
 * which is how a month of vends averages out on a prepaid meter. Approximate.
 */
export function kwhForCedis(cedis: number, monthlyKwh: number, customer: CustomerClass = 'residential') {
  const bill = monthlyBill(Math.max(monthlyKwh, 1), customer);
  // service charge is spread over the month's vends; use energy-only average plus service share
  const rate = bill.effectiveRate || toCedis(ACTIVE_TARIFF.residential.blocks[0].ratePesewas);
  return cedis / rate;
}

export interface BandAdvice {
  kind: 'lifeline-cliff' | 'high-band' | 'ok-lifeline' | 'ok-standard';
  title: string;
  detail: string;
  kwhToCut: number;
  monthlySaving: number;
}

/** Advice on dropping into a cheaper band. */
export function bandAdvice(monthlyKwh: number, customer: CustomerClass = 'residential'): BandAdvice {
  const now = monthlyBill(monthlyKwh, customer);
  if (customer === 'residential' && monthlyKwh > 30 && monthlyKwh <= 60) {
    const target = monthlyBill(30, customer);
    const cut = monthlyKwh - 30;
    return {
      kind: 'lifeline-cliff',
      title: 'You are close to the lifeline band',
      detail: `Lifeline is exclusive: one unit over 30 kWh and every unit is billed at the standard rate plus a higher service charge. Cutting ${cut.toFixed(1)} kWh/month (${(cut / 30).toFixed(2)} kWh/day) brings your bill to about GH₵${target.totalCedis.toFixed(2)}.`,
      kwhToCut: cut,
      monthlySaving: round2(now.totalCedis - target.totalCedis),
    };
  }
  if (monthlyKwh > 300) {
    const target = monthlyBill(300, customer);
    const cut = monthlyKwh - 300;
    return {
      kind: 'high-band',
      title: 'Your top units are in the expensive block',
      detail: `Every unit above 300 kWh costs GH₵${now.marginalRate.toFixed(2)}. Cutting ${cut.toFixed(0)} kWh/month (${(cut / 30).toFixed(1)} kWh/day) keeps you in the 0–300 block.`,
      kwhToCut: cut,
      monthlySaving: round2(now.totalCedis - target.totalCedis),
    };
  }
  if (now.band === 'lifeline') {
    return { kind: 'ok-lifeline', title: 'You are on the lifeline band', detail: 'Stay at or below 30 kWh a month to keep the cheapest rate and lowest service charge.', kwhToCut: 0, monthlySaving: 0 };
  }
  return { kind: 'ok-standard', title: 'You are in the 0–300 kWh block', detail: `Stay at or below 300 kWh a month to avoid the GH₵${toCedis(ACTIVE_TARIFF.residential.blocks[1].ratePesewas).toFixed(2)}/kWh block.`, kwhToCut: 0, monthlySaving: 0 };
}
