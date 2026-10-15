# ⚡ GridWise: spend less on power, beat dumsor

**An offline-first web app that helps Ghanaian households and small businesses plan their electricity spend in cedis, forecast prepaid credit, and track neighbourhood outages ("dumsor").**

Built for the **Tech Hub Africa Hackathon 2026 · Electricity Efficiency track**.

- **Live demo:** `https://<your-github-username>.github.io/gridwise/` *(enabled automatically by the included GitHub Actions workflow once the repo is pushed)*
- **Demo video:** see the DoraHacks BUIDL page
- **Stack:** Vite · TypeScript (no framework) · Leaflet + OpenStreetMap · Chart.js · Workbox PWA · IndexedDB · Vitest
- **No backend, no API keys, no paid services.** Everything runs in the browser.

---

## The problem

Electricity in Ghana is a daily budgeting problem and a reliability problem at the same time:

1. **Prepaid credit runs out without warning.** Most ECG customers are on prepaid meters. People top up, then find out at 9 pm that the units are gone. Few know how many days a GH₵100 top-up actually lasts in their home.
2. **Tariff bands are invisible.** The PURC residential tariff has a *lifeline* band (0–30 kWh/month) that is **exclusive**: one unit over 30 kWh and the whole month is billed at more than twice the rate, plus a five-times higher service charge. Above 300 kWh every extra unit costs ~32% more. Households cannot see where they sit or which appliance pushes them over.
3. **Dumsor is unpredictable.** Unplanned outages spoil food, stop barbers, tailors and cold-store sellers working, and push families onto petrol generators. Outages in a given area often follow patterns, but that knowledge lives in WhatsApp groups and memory.

## What GridWise does

### 1. ⚡ Appliance energy planner
- Pick appliances from 28 Ghana-typical presets (fans, table-top fridges, chest freezers, 1 HP / 1.5 HP ACs, pressing irons, decoders, clippers, salon dryers, display fridges and more), set quantity and hours per day.
- Duty-cycle aware: compressors and thermostatic loads are not counted at full nameplate power 24 h a day.
- Instant **daily kWh, monthly kWh and monthly bill in cedis** using the current PURC tariff blocks and service charges, with a block-by-block bill breakdown.
- **Band meter** showing exactly where the household sits relative to the lifeline (≤30 kWh) and 300 kWh thresholds.
- **Band advice:** "You're 10 kWh over lifeline; cut 0.33 kWh/day and save about GH₵63/month" or "Your top 60 kWh are in the expensive block".
- **Quantified saving tips**, priced at the household's *marginal* rate (what actually comes off the bill): swap filament/CFL bulbs to LED, 2 h less AC, water-heater timer, weekly batch ironing, decoder standby, and more.
- **Dumsor backup sizing:** mark essential loads (🔋) and an outage length; get average load, inverter VA and battery Ah for 12 V lithium (80% DoD) and lead-acid (50% DoD).
- Home vs. small business (non-residential tariff) toggle.

### 2. 🔋 Prepaid-credit forecaster
- Enter the credit on the meter in **kWh or GH₵**, use the planner's daily kWh or type your own.
- Accounts for **outage hours**: the meter doesn't run when the grid is down, so dumsor stretches units.
- Shows **days remaining, run-out date and a "top up by" date** (2 days of buffer), plus a burn-down chart.
- **Top-up planner:** "I want my credit to last until 14 Nov" → how many cedis to buy.
- Quick compare: what GH₵50 / 100 / 200 / 500 buys in kWh and days for *this* household.

### 3. 🗺️ Community outage reporter + map
- **One-tap "Lights out" / "Power is back"** reports per area, with optional start time and note; "📍 Near me" picks the nearest area by geolocation.
- If an outage is already open in the area, a report becomes a **confirmation** (+1 neighbour), the way a real crowd-sourced feed should dedupe.
- **Leaflet + OpenStreetMap live map** of 15 areas across Accra, Tema, Kasoa, Kumasi, Takoradi, Cape Coast, Ho and Tamale, coloured *off now / off in last 24 h / stable*.
- **Outage-pattern model:** for the selected area, an hour-by-hour probability chart over the last 28 days (Ghana time), detected **likely outage windows** (contiguous hours above 30%, including windows that wrap past midnight), the **next likely outage**, supply reliability %, outages and hours off in the last 7 days, and average outage length.
- Practical prompt: "charge phones, run the iron or pump before 18:00".
- Upvote ("👍 me too") on past reports, **CSV export**, and "reset demo data".

### 4. 📴 Works offline (PWA)
- Workbox service worker precaches the app shell; the whole app loads with no connection after the first visit.
- OpenStreetMap tiles you have viewed are cached (cache-first, 400 tiles, 30 days).
- Installable to the home screen (manifest + icons), online/offline indicator in the header.
- All data stays on the device: settings in `localStorage`, outage reports in **IndexedDB** (with a `localStorage` fallback).

## Tariff data (source and caveats)

GridWise uses the **PURC 2026 Fourth Quarter tariff schedule, effective 1 October 2026** (unchanged from Q3 2026):

| Customer class | Block | Energy charge | Service charge |
|---|---|---|---|
| Residential lifeline (exclusive) | 0–30 kWh | 89.9315 GHp/kWh | 213.0000 GHp/month (GH₵2.13) |
| Residential, all others | 0–300 kWh | 203.7509 GHp/kWh | 1073.0886 GHp/month (GH₵10.73) |
| | 301+ kWh | 269.2235 GHp/kWh | |
| Non-residential | 0–300 kWh | 183.9549 GHp/kWh | 1242.8245 GHp/month (GH₵12.43) |
| | 301+ kWh | 224.0395 GHp/kWh | |

- Source: PURC tariff decision, <https://www.purc.com.gh/attachment/545028-20260924090934.pdf> (24 Sept 2026); reported at <https://kumasimail.com/purc-keeps-electricity-water-tariffs-unchanged-for-fourth-quarter/>.
- **Approximate:** estimates exclude statutory levies and taxes (street-light levy, NESL, VAT where it applies), so real bills and vend receipts will be somewhat higher. Prepaid cedi-to-kWh conversion uses the household's average effective rate at its monthly consumption level.
- PURC reviews tariffs quarterly. Updating is a one-object change in [`src/lib/tariff.ts`](src/lib/tariff.ts).
- Appliance wattages and duty cycles are typical values, not measurements; tip savings for some appliances use simple heuristics (e.g. 15% for maintenance tips) and are labelled as estimates.

## Architecture

```
index.html             app shell: header, nav (bottom bar on mobile, tabs on desktop)
src/
  main.ts              hash router, online/offline status, service-worker registration
  styles.css           mobile-first design system (Ghana green/gold/red accents)
  lib/
    tariff.ts          PURC tariff schedule + block billing, band advice (pure functions)
    appliances.ts      appliance presets, kWh maths, saving tips, backup sizing
    forecast.ts        prepaid-credit forecast, top-up calculator
    outages.ts         areas, demo-data generator, hour-of-day outage model, window detection
    store.ts           IndexedDB wrapper (localStorage fallback) + settings persistence
    state.ts           tiny observable app state persisted to localStorage
    chart.ts           tree-shaken Chart.js registration
    format.ts          cedi/kWh/date formatting in Ghana time, toast
  views/
    planner.ts  credit.ts  outages.ts  about.ts
tests/                 Vitest unit tests for tariff, forecast and outage model
.github/workflows/     CI: test → build → deploy to GitHub Pages
```

Design choices:

- **Logic is pure and unit-tested.** Billing, forecasting and the outage model are framework-free functions in `src/lib`, covered by 16 Vitest tests (lifeline cliff, block boundaries, non-residential, outage-stretched credit, midnight-wrapping windows, pattern recovery from the demo generator).
- **Ghana time everywhere.** Ghana is on GMT with no daylight saving, so the outage model buckets by UTC hour and displays with `timeZone: 'Africa/Accra'`. Results are correct even if the judge's laptop is in another time zone.
- **Deterministic demo data.** `generateDemoReports()` uses a seeded PRNG per area and day, producing ~4 weeks of realistic load-shedding patterns (e.g. Madina evenings, Kasoa mornings, Tema late night) relative to *now*, so the demo is always fresh. It regenerates daily while keeping user reports.
- **No framework, small bundle.** ~125 kB gzipped JS including Leaflet and Chart.js. Works on low-end Android phones and expensive mobile data.
- **Relative base path** (`base: './'`), so the same build works on GitHub Pages, any static host, or a USB stick.

## Run it locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build (service worker active) at http://localhost:4173
```

To test offline: run `npm run build && npm run preview`, open the app once, then switch DevTools → Network → Offline and reload.

## Deploy (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` runs tests, builds, and publishes `dist/` to GitHub Pages on every push to `main`. In the repo: **Settings → Pages → Source: GitHub Actions** (the workflow also tries to enable it automatically).

## Impact for Ghana

- **Money:** a household at 40 kWh/month pays about GH₵92 instead of about GH₵29 at 30 kWh, because the lifeline band is exclusive. GridWise surfaces this cliff and the exact daily cut needed. For a typical fan + fridge + TV + AC home (~222 kWh/month, ~GH₵463), the top suggested changes add up to roughly GH₵100 a month.
- **Fewer surprise blackouts:** the credit forecaster turns "units finished at night" into a planned top-up date and amount.
- **Living with dumsor:** outage windows let families and micro-businesses (barbers, tailors, cold-drink sellers) shift ironing, pumping, charging and production ahead of likely outages, and size backup batteries sensibly instead of over-buying generators.
- **Data for utilities and planners:** crowd-sourced, timestamped reports by area (exportable as CSV) are the raw material for holding distributors to account on reliability.
- **Built for real conditions:** offline-first, tiny bundle, no sign-up, works on any phone browser.

## Roadmap

- Sync community reports through a lightweight backend (e.g. Supabase) with spam protection and per-area moderation; SMS/USSD reporting for feature phones.
- Import official ECG/NEDCo load-management schedules when published, and blend them with crowd reports.
- Twi, Ga, Ewe and Hausa translations.
- Push notifications: "credit runs out tomorrow" and "outage likely in your area in 1 hour".
- Meter-reading log to calibrate the planner against real consumption.
- Solar + battery payback calculator, comparing against generator fuel costs.
- Expand to other African utilities (Nigeria's band-based tariffs, Kenya Power tokens) via pluggable tariff schedules.

## Limitations

- Outage data in the demo is **simulated**; real deployment needs a shared backend.
- Tariff estimates exclude levies and taxes (see above).
- Area coordinates are approximate neighbourhood centre points.

## License

[MIT](LICENSE) © 2026 Lawal Ridwan. Map data © OpenStreetMap contributors.
