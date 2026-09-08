// Pull monthly mean sea level for every station in data.json and write series.json.
//
//   node scripts/fetch-noaa.js                  sltrends product (default)
//   node scripts/fetch-noaa.js --source api     CO-OPS datagetter, as the notebook uses
//   node scripts/fetch-noaa.js --from-dir ./raw offline: parse files already downloaded
//   node scripts/fetch-noaa.js --out /tmp/series.json
//
// Two NOAA sources, both official:
//
//   sltrends  tidesandcurrents.noaa.gov/sltrends/data/<id>_meantrend.txt
//             The published sea level trends product. Monthly MSL in metres
//             relative to the most recent MSL datum, with NOAA's average
//             seasonal cycle ALREADY REMOVED, plus NOAA's own fitted trend line
//             and its 95% band. Runs later than the API export and gives us a
//             published trend to check our arithmetic against.
//
//   api       api.tidesandcurrents.noaa.gov/api/prod/datagetter, product
//             monthly_mean, datum MSL — the exact call globalSeaLevelAnalysis.ipynb
//             makes. Seasonal cycle intact, so the server deseasonalises it.
//
// Either way values are stored in millimetres on a dense monthly grid, with null
// for months NOAA does not report. Gaps stay gaps and are never interpolated.

"use strict";

const fs = require("fs");
const path = require("path");

const SLTRENDS = "https://tidesandcurrents.noaa.gov/sltrends/data";
const API = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const END_YEAR = Number(process.env.END_YEAR || new Date().getFullYear());

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** Pack {year, month} -> mm samples onto a dense monthly grid. */
function grid(samples) {
  const seen = new Map();
  for (const [year, month, mm] of samples) {
    const key = year * 12 + (month - 1);
    if (!seen.has(key)) seen.set(key, Number(mm.toFixed(2)));
  }
  if (!seen.size) throw new Error("no parsable records");
  const keys = [...seen.keys()].sort((a, b) => a - b);
  const first = keys[0], last = keys[keys.length - 1];
  const values = [];
  for (let k = first; k <= last; k++) values.push(seen.has(k) ? seen.get(k) : null);
  return {
    startYear: Math.floor(first / 12),
    startMonth: (first % 12) + 1,
    endYear: Math.floor(last / 12),
    endMonth: (last % 12) + 1,
    values,
    present: seen.size,
    slots: values.length,
  };
}

async function get(url, kind) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(90000),
    headers: { "User-Agent": "Earth2100/1.0 (sea level analysis)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return kind === "json" ? res.json() : res.text();
}

/**
 * Parse NOAA's sea level trends export. Handles both the whitespace-aligned
 * .txt served by the sltrends site and the comma-separated export, which carry
 * the same columns: Year, Month, Monthly_MSL, Linear_Trend, High_Conf, Low_Conf.
 */
function parseMeantrend(text) {
  const samples = [];
  const trendPts = [];
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s*,\s*|\s+/);
    if (f.length < 3) continue;
    const year = Number(f[0]), month = Number(f[1]), msl = Number(f[2]);
    if (!Number.isInteger(year) || year < 1800 || !Number.isInteger(month)) continue;
    if (month < 1 || month > 12 || !Number.isFinite(msl)) continue;
    samples.push([year, month, msl * 1000]);
    // Number("") is 0, not NaN, so an empty trend cell must be rejected by hand.
    // NOAA leaves these blank on the most recent months, past the fitted line.
    const cell = (f[3] || "").trim();
    const trend = cell === "" ? NaN : Number(cell);
    if (Number.isFinite(trend)) trendPts.push([year + (month - 0.5) / 12, trend * 1000]);
  }
  const out = grid(samples);
  // NOAA's own trend line is straight, so its slope is just rise over run.
  if (trendPts.length > 1) {
    const a = trendPts[0], b = trendPts[trendPts.length - 1];
    out.noaaTrend = Number(((b[1] - a[1]) / (b[0] - a[0])).toFixed(3));
  }
  out.seasonalRemoved = true;
  return out;
}

async function fromSltrends(station) {
  return parseMeantrend(await get(`${SLTRENDS}/${station}_meantrend.txt`, "text"));
}

/**
 * Offline import. Point this at a directory of files already downloaded from
 * the sltrends product and it builds series.json with no network at all.
 * A file matches a station if its name contains the 7-digit station ID, so
 * `8518750_meantrend.txt`, `battery-8518750.txt` and `8518750.txt` all work.
 */
function fromDir(dir, station, stationName) {
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  let hit = files.find((f) => f.includes(station));

  // Some NOAA exports drop the station ID from the filename, leaving only the
  // place name — and spelling it loosely ("SanFransisco", "Honululu"). Fall back
  // to comparing letters only, which tolerates case, spacing and punctuation but
  // still requires the name to actually be in there.
  if (!hit && stationName) {
    const letters = (x) => x.toLowerCase().replace(/[^a-z]/g, "");
    const want = letters(stationName);
    const near = (a, b) => {
      if (a.includes(b) || b.includes(a)) return true;
      if (Math.abs(a.length - b.length) > 2) return false;
      let diff = 0;                       // tolerate a couple of misspelt letters
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff++;
      return diff <= 2;
    };
    const matches = files.filter((f) => {
      const stem = letters(f.replace(/\.[^.]+$/, "").replace(/noaa|mean|sea|level|meantrend/gi, ""));
      return near(stem, want);
    });
    if (matches.length > 1) {
      throw new Error(`ambiguous: ${matches.join(", ")} all look like ${stationName}`);
    }
    hit = matches[0];
  }
  if (!hit) throw new Error("no file matching this station ID or name");
  const text = fs.readFileSync(path.join(dir, hit), "utf8");
  if (!/^\s*\d{4}\s*[,\s]\s*\d{1,2}\s*[,\s]\s*-?[\d.]/m.test(text)) {
    throw new Error(`${hit} does not look like a meantrend file`);
  }
  const out = parseMeantrend(text);
  out.file = hit;
  return out;
}

async function fromApi(station, startYear) {
  const qs = new URLSearchParams({
    begin_date: `${startYear}0101`,
    end_date: `${END_YEAR}1231`,
    station,
    product: "monthly_mean",
    datum: "MSL",
    time_zone: "gmt",
    units: "metric",
    application: "Earth2100",
    format: "json",
  });
  const body = await get(`${API}?${qs}`, "json");
  if (body.error) throw new Error(body.error.message || "API error");
  if (!Array.isArray(body.data) || !body.data.length) throw new Error("no data returned");

  const samples = [];
  for (const row of body.data) {
    const year = parseInt(row.year, 10), month = parseInt(row.month, 10);
    if (!year || !month) continue;
    const raw = [row.MSL, row.value, row.v].find(
      (x) => x !== undefined && x !== null && String(x).trim() !== "" && String(x) !== "null"
    );
    const metres = Number(raw);
    if (!Number.isFinite(metres)) continue;
    samples.push([year, month, metres * 1000]);
  }
  const out = grid(samples);
  out.seasonalRemoved = false;
  return out;
}

async function main() {
  const fromDirPath = arg("--from-dir", null);
  const source = fromDirPath ? "sltrends" : arg("--source", "sltrends");
  if (!["sltrends", "api"].includes(source)) {
    console.error("--source must be sltrends or api");
    process.exit(1);
  }
  if (fromDirPath && !fs.existsSync(fromDirPath)) {
    console.error(`No such directory: ${fromDirPath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data.json"), "utf8"));
  const series = {};
  const failures = [];

  console.log(fromDirPath ? `Source: local files in ${fromDirPath}\n` : `Source: ${source}\n`);
  for (const s of data.stations) {
    process.stdout.write(`${s.name.padEnd(16)} ${s.id}  `);
    try {
      const r = fromDirPath
        ? fromDir(fromDirPath, s.id, s.name)
        : source === "sltrends"
        ? await fromSltrends(s.id)
        : await fromApi(s.id, s.start);
      series[s.id] = { id: s.id, ...r };
      const cov = ((r.present / r.slots) * 100).toFixed(0);
      const noaa = r.noaaTrend !== undefined ? `  NOAA trend ${r.noaaTrend} mm/yr` : "";
      console.log(`${String(r.present).padStart(5)} months  ${r.startYear}-${r.endYear}  ${cov}% complete${noaa}`);
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failures.push(s.id);
    }
    if (!fromDirPath) await new Promise((r) => setTimeout(r, 400)); // be polite
  }

  if (!Object.keys(series).length) {
    console.error("\nNo stations retrieved. Nothing written.");
    process.exit(1);
  }

  const total = Object.values(series).reduce((a, s) => a + s.present, 0);
  const payload = {
    meta: {
      source:
        source === "sltrends"
          ? "NOAA CO-OPS sea level trends (monthly MSL, average seasonal cycle removed)"
          : "NOAA CO-OPS monthly mean sea level (MSL datum, metric)",
      endpoint: fromDirPath ? `local import from ${fromDirPath}` : source === "sltrends" ? SLTRENDS : API,
      seasonalRemoved: source === "sltrends",
      retrieved: new Date().toISOString().slice(0, 10),
      units: "mm",
      stations: Object.keys(series).length,
      records: total,
      note: "Dense monthly grid; null marks a month NOAA does not report. No interpolation.",
    },
    series,
  };

  const file = arg("--out", path.join(__dirname, "..", "series.json"));
  fs.writeFileSync(file, JSON.stringify(payload));
  console.log(`\nWrote ${file} — ${total.toLocaleString()} monthly records, ` +
    `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  if (failures.length) console.log(`Missing stations: ${failures.join(", ")}`);
  if (source === "sltrends") {
    console.log("Run `npm test` to check our trends against NOAA's published ones.");
  }
}

main().catch((err) => {
  console.error("Fetch failed:", err.message);
  process.exit(1);
});
