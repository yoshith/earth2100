// Earth2100 — sea level rise analyzer
//
// Summary figures come from globalSeaLevelAnalysis.ipynb (NOAA CO-OPS monthly
// MSL). Rate-through-time and the land/ocean partition are computed here from
// the monthly series itself, retrieved from the same NOAA endpoint the notebook
// uses. Nothing is simulated; where data is missing the API says so.

const express = require("express");
const path = require("path");
const fs = require("fs");
const T = require("./lib/trends");

const app = express();
const PORT = process.env.PORT || 10000;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const BASE = DATA.meta.baselineYear; // 2024

// --- Projection model (unchanged; reconstructed from the notebook's outputs) --
// Level relative to the 2024 baseline, in mm.
//   year <= 2024 : observed linear OLS trend
//   year >  2024 : SSP2-4.5 fitted curve scaled to the scenario's 2100 endpoint
function stationLevel(s, year, scenario) {
  if (year < s.start) return null;
  const t = year - BASE;
  if (t <= 0) return s.rate * t;
  const scale = s.proj[scenario][0] / s.proj.ssp245[0];
  return scale * (s.r245 * t + 0.5 * s.a245 * t * t);
}
function stationRate(s, year, scenario) {
  if (year < s.start) return null;
  const t = year - BASE;
  if (t <= 0) return s.rate;
  const scale = s.proj[scenario][0] / s.proj.ssp245[0];
  return scale * (s.r245 + s.a245 * t);
}
function activeMean(year, scenario, fn) {
  const v = DATA.stations.map((s) => fn(s, year, scenario)).filter((x) => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
const meanLevel = (y, sc) => activeMean(y, sc, stationLevel);
const meanRate = (y, sc) => activeMean(y, sc, stationRate);
const activeCount = (y) => DATA.stations.filter((s) => y >= s.start).length;

// --- Monthly series ---------------------------------------------------------
// Preferred: series.json committed alongside the app (npm run fetch).
// Fallback: pull from NOAA on boot. If both fail the rate endpoints return 503
// with an explanation rather than inventing numbers.

let SERIES = null;
let SERIES_META = null;
let SERIES_ERROR = null;

function ingest(payload) {
  const out = {};
  for (const [id, s] of Object.entries(payload.series)) {
    const base = { id, startYear: s.startYear, startMonth: s.startMonth, values: s.values };
    // The sltrends product already has NOAA's average seasonal cycle removed.
    // Removing it twice would be wrong, so trust the flag the fetcher recorded.
    const done = s.seasonalRemoved ?? payload.meta.seasonalRemoved ?? false;
    const series = done ? { ...base, deseasonalised: true } : T.deseasonalise(base);
    series.raw = base;
    series.present = s.present;
    series.seasonalRemovedBySource = done;
    series.noaaTrend = s.noaaTrend;
    out[id] = series;
  }
  SERIES = out;
  SERIES_META = payload.meta;
  SERIES_ERROR = null;
}

async function loadSeries() {
  const local = path.join(__dirname, "series.json");
  if (fs.existsSync(local)) {
    try {
      ingest(JSON.parse(fs.readFileSync(local, "utf8")));
      console.log(`Loaded series.json — ${SERIES_META.records.toLocaleString()} monthly records`);
      return;
    } catch (err) {
      console.warn("series.json unreadable:", err.message);
    }
  }
  console.log("No series.json — fetching from NOAA…");
  try {
    const tmp = path.join(require("os").tmpdir(), "earth2100-series.json");
    const { execFileSync } = require("child_process");
    execFileSync(process.execPath, [path.join(__dirname, "scripts", "fetch-noaa.js"), "--out", tmp], {
      stdio: "inherit",
      timeout: 240000,
    });
    ingest(JSON.parse(fs.readFileSync(tmp, "utf8")));
    console.log("Fetched monthly series from NOAA.");
  } catch (err) {
    SERIES_ERROR =
      "Monthly series unavailable. Run `npm run fetch` to write series.json, or check that " +
      "api.tidesandcurrents.noaa.gov is reachable from this host.";
    console.warn(SERIES_ERROR);
  }
}

function needSeries(res) {
  if (SERIES) return true;
  res.status(503).json({ error: SERIES_ERROR || "Monthly series still loading." });
  return false;
}

// --- Rate analysis ----------------------------------------------------------

const cache = new Map();
const cached = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

function rateReport(s, series, windowYears) {
  const full = T.fullRecordTrend(series);
  const centred = T.rollingTrend(series, { windowYears, align: "centre" });
  const trailing = T.rollingTrend(series, { windowYears, align: "trailing" });
  const current = trailing.length ? trailing[trailing.length - 1] : null;

  // Orton's estimator: 8-year running means differenced across the recent period.
  // Two versions. The first ends September 2018 to match NPCC4 exactly, so the
  // number is directly comparable to the published 4.6 mm/yr at The Battery. The
  // second runs to the end of the record, which now holds several more years
  // than NPCC4 had. Reporting only the updated one would quietly move the
  // goalposts; reporting only the matched one would waste the newer data.
  const pts = T.points(series);
  const lastT = pts.length ? pts[pts.length - 1].t : null;
  const centreLimit = lastT !== null ? lastT - 4 : null; // an 8-year mean is centred
  const endpoint =
    lastT !== null
      ? T.endpointRate(series, { meanYears: 8, t1: 1990, t2: Math.min(2018.7, centreLimit) })
      : null;
  const endpointLatest =
    centreLimit !== null && centreLimit > 2019.5
      ? T.endpointRate(series, { meanYears: 8, t1: 1990, t2: centreLimit })
      : null;

  const vlm = s.vlm || { rate: s.subs, unc: null, source: null, status: "unsourced" };

  return {
    station: { id: s.id, name: s.name, loc: s.loc, start: s.start },
    windowYears,
    nodalNote:
      "Window length is kept near the 18.61-year lunar nodal cycle; a window that is not " +
      "close to a whole multiple of it aliases nodal modulation into the slope.",
    deseasonalised: true,
    seasonalRemovedBySource: series.seasonalRemovedBySource === true,
    // NOAA publishes its own linear trend for these stations. Ours should land
    // close to it; a large gap means something is wrong with our fit, not theirs.
    noaaPublishedTrend: series.noaaTrend ?? null,
    fullRecord: full,
    rolling: centred,
    rollingTrailing: trailing,
    current,
    endpoint,
    endpointLatest,
    vlm,
    split: {
      // Land motion is constant, so subtracting it leaves all curvature in the ocean term.
      centuryTotal: full ? full.slope : null,
      centuryOcean: full ? Number((full.slope - vlm.rate).toFixed(3)) : null,
      recentTotal: current ? current.slope : null,
      recentOcean: current ? Number((current.slope - vlm.rate).toFixed(3)) : null,
      land: vlm.rate,
    },
  };
}

function decomposeReport(s, series) {
  const vlm = s.vlm || { rate: s.subs, unc: null, source: null, status: "unsourced" };
  const pts = T.points(series);
  if (!pts.length) return null;
  const t0 = pts[0].t;
  const anchor = pts[0].y;

  const annual = T.annualMean(series);
  const smooth = T.runningMean(series, 8).filter((_, i) => i % 3 === 0);
  const shift = (arr) => arr.map((p) => ({ t: p.t, y: Number((p.y - anchor).toFixed(2)) }));
  const landAt = (t) => Number((vlm.rate * (t - t0)).toFixed(2));

  return {
    station: { id: s.id, name: s.name, loc: s.loc },
    vlm,
    refYear: Number(t0.toFixed(2)),
    total: { annual: shift(annual), smooth: shift(smooth) },
    land: smooth.map((p) => ({ t: p.t, y: landAt(p.t) })),
    ocean: smooth.map((p) => ({
      t: p.t,
      y: Number((p.y - anchor - vlm.rate * (p.t - t0)).toFixed(2)),
    })),
    caption:
      "Relative sea level split into vertical land motion (constant rate) and the ocean " +
      "residual. Because the land term is a straight line, any acceleration in the total " +
      "belongs entirely to the ocean term.",
  };
}

// --- Routes -----------------------------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/meta", (_req, res) =>
  res.json({ ...DATA.meta, series: SERIES_META, seriesError: SERIES_ERROR })
);
app.get("/api/stations", (_req, res) => res.json(DATA.stations));
app.get("/api/cities", (_req, res) => res.json(DATA.cities));

app.get("/api/level/:year", (req, res) => {
  const year = Number(req.params.year);
  const scenario = String(req.query.scenario || "ssp245");
  if (!Number.isFinite(year)) return res.status(400).json({ error: "year must be a number" });
  res.json({
    year,
    scenario,
    active_stations: activeCount(year),
    mean_rise_mm_vs_2024: Number(meanLevel(year, scenario).toFixed(1)),
    mean_rate_mm_per_yr: Number(meanRate(year, scenario).toFixed(2)),
    stations: DATA.stations
      .filter((s) => stationLevel(s, year, scenario) !== null)
      .map((s) => ({ id: s.id, name: s.name, rise_mm: Number(stationLevel(s, year, scenario).toFixed(1)) })),
    source: DATA.meta.source,
  });
});

app.get("/api/station/:id", (req, res) => {
  const s = DATA.stations.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "station not found" });
  const year = Number(req.query.year || BASE);
  const scenario = String(req.query.scenario || "ssp245");
  res.json({
    id: s.id, name: s.name, location: s.loc, region: s.region,
    lat: s.lat, lon: s.lon, record_start: s.start,
    vlm: s.vlm, subsidence_mm_yr: s.subs,
    measured_rate_mm_yr: s.rate, rate_stderr: s.stderr, theil_sen_mm_yr: s.theilsen,
    acceleration_mm_yr2: s.accel, eustatic_rate_mm_yr: s.corrected,
    total_observed_rise_mm: s.totalRise,
    projection_2100_mm: { ssp126: s.proj.ssp126, ssp245: s.proj.ssp245, ssp585: s.proj.ssp585 },
    rise_at_year_mm: Number(stationLevel(s, year, scenario).toFixed(1)),
    year, scenario,
  });
});

// Rate through time for one station.
app.get("/api/rates/:id", (req, res) => {
  if (!needSeries(res)) return;
  const s = DATA.stations.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "station not found" });
  const series = SERIES[s.id];
  if (!series) return res.status(404).json({ error: "no monthly series for this station" });
  let w = Number(req.query.window || 19);
  if (!Number.isFinite(w) || w < 5 || w > 60) w = 19;
  res.json(cached(`rates:${s.id}:${w}`, () => rateReport(s, series, w)));
});

// NPCC4 Figure 6 style land/ocean partition for one station.
app.get("/api/decompose/:id", (req, res) => {
  if (!needSeries(res)) return;
  const s = DATA.stations.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "station not found" });
  const series = SERIES[s.id];
  if (!series) return res.status(404).json({ error: "no monthly series for this station" });
  res.json(cached(`dec:${s.id}`, () => decomposeReport(s, series)));
});

// Century rate vs recent rate for every station — the comparison table.
app.get("/api/rate-summary", (req, res) => {
  if (!needSeries(res)) return;
  let w = Number(req.query.window || 19);
  if (!Number.isFinite(w) || w < 5 || w > 60) w = 19;
  res.json(
    cached(`summary:${w}`, () => ({
      windowYears: w,
      stations: DATA.stations
        .filter((s) => SERIES[s.id])
        .map((s) => {
          const r = rateReport(s, SERIES[s.id], w);
          return {
            id: s.id,
            name: s.name,
            century: r.fullRecord ? r.fullRecord.slope : null,
            noaaPublished: r.noaaPublishedTrend,
            centurySe: r.fullRecord ? r.fullRecord.se : null,
            recent: r.current ? r.current.slope : null,
            recentSe: r.current ? r.current.se : null,
            recentAt: r.current ? r.current.t : null,
            endpoint: r.endpoint ? r.endpoint.rate : null,
            endpointLatest: r.endpointLatest ? r.endpointLatest.rate : null,
            land: r.split.land,
            centuryOcean: r.split.centuryOcean,
            recentOcean: r.split.recentOcean,
            vlmStatus: r.vlm.status,
          };
        }),
    }))
  );
});

// Raw monthly series, so anyone can check the arithmetic.
app.get("/api/series/:id", (req, res) => {
  if (!needSeries(res)) return;
  const series = SERIES[req.params.id];
  if (!series) return res.status(404).json({ error: "no monthly series for this station" });
  res.json({ id: req.params.id, units: "mm", datum: "MSL", deseasonalised: false, ...series.raw });
});

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", series: SERIES ? "loaded" : "unavailable" })
);

loadSeries().finally(() => {
  app.listen(PORT, () => console.log(`Earth2100 running on port ${PORT}`));
});
