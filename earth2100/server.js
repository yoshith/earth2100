// Earth2100 — sea level rise simulator
// Single Express service. All figures come from globalSeaLevelAnalysis.ipynb
// (NOAA CO-OPS monthly MSL, 1854-2024). Nothing is simulated.

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const BASE = DATA.meta.baselineYear; // 2024

// --- Projection model (reconstructed from the notebook's own outputs) -------
// Level relative to the 2024 baseline, in mm.
//   year <= 2024 : observed quadratic  L = rate*t + 0.5*accel*t^2
//   year >  2024 : SSP2-4.5 fitted curve scaled to the chosen scenario's 2100 endpoint
function stationLevel(s, year, scenario) {
  if (year < s.start) return null; // no observational record yet
  const t = year - BASE;
  if (t <= 0) return s.rate * t; // observed linear OLS trend
  const scale = s.proj[scenario][0] / s.proj.ssp245[0];
  return scale * (s.r245 * t + 0.5 * s.a245 * t * t); // SSP-fitted projection
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

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/meta", (_req, res) => res.json(DATA.meta));
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
    lat: s.lat, lon: s.lon, record_start: s.start, subsidence_mm_yr: s.subs,
    measured_rate_mm_yr: s.rate, rate_stderr: s.stderr, theil_sen_mm_yr: s.theilsen,
    acceleration_mm_yr2: s.accel, eustatic_rate_mm_yr: s.corrected,
    total_observed_rise_mm: s.totalRise,
    projection_2100_mm: { ssp126: s.proj.ssp126, ssp245: s.proj.ssp245, ssp585: s.proj.ssp585 },
    rise_at_year_mm: Number(stationLevel(s, year, scenario).toFixed(1)),
    year, scenario,
  });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Earth2100 running on port ${PORT}`));
