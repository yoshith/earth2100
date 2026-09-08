// Parser checks for the sltrends meantrend format.
//
// The rows below are real lines from NOAA's published file for station 8665530
// (Charleston), kept short and used only to verify parsing: the header is
// skipped, a gap in the record survives as nulls, metres become millimetres,
// and the trailing rows NOAA emits without a trend column still yield a value.

"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SAMPLE = `Monthly mean sea levels with the average seasonal cycle removed.
The values are in meters relative to the most recent Mean Sea Level datum established by CO-OPS.
Column values are the Year, Month, Monthly Mean, Relative Sea Level Trend Line, Higher 95% Confidence Interval, and Lower 95% Confidence Interval.
Product of NOAA's National Ocean Service / Center for Operational Oceanographic Products and Services (CO-OPS)

Year   Month    Monthly_MSL        Linear_Trend     High_Conf.      Low_Conf.
1901   1        -0.238          -0.310           -0.295          -0.325
1901   2        -0.355          -0.310           -0.295          -0.325
1901   4        -0.271          -0.309           -0.295          -0.323
1901   5        -0.291          -0.309           -0.295          -0.323
1902   1        -0.322          -0.306           -0.292          -0.320
2025   10       0.281           0.128            0.140           0.116
2025   11       0.040
2025   12       0.111
`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meantrend-"));
fs.writeFileSync(path.join(dir, "8665530_meantrend.txt"), SAMPLE);

// Drive the real importer through a data.json containing just this station.
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "proj-"));
fs.mkdirSync(path.join(proj, "scripts"));
fs.copyFileSync(
  path.join(__dirname, "..", "scripts", "fetch-noaa.js"),
  path.join(proj, "scripts", "fetch-noaa.js")
);
fs.writeFileSync(
  path.join(proj, "data.json"),
  JSON.stringify({ meta: {}, stations: [{ id: "8665530", name: "Charleston", start: 1901 }], cities: [] })
);
const out = path.join(proj, "series.json");
execFileSync(process.execPath, [path.join(proj, "scripts", "fetch-noaa.js"), "--from-dir", dir, "--out", out], {
  stdio: "pipe",
});

const payload = JSON.parse(fs.readFileSync(out, "utf8"));
const s = payload.series["8665530"];
let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

console.log("meantrend parser");

check("header lines are skipped", () => {
  assert.strictEqual(s.startYear, 1901);
  assert.strictEqual(s.startMonth, 1);
});

check("metres are converted to millimetres", () => {
  assert.strictEqual(s.values[0], -238);
  assert.strictEqual(s.values[1], -355);
});

check("a missing month becomes null, not a shifted value", () => {
  assert.strictEqual(s.values[2], null, "March 1901 is absent from the file");
  assert.strictEqual(s.values[3], -271, "April must stay in April's slot");
});

check("the long gap is spanned by nulls, not closed up", () => {
  assert.strictEqual(s.endYear, 2025);
  assert.strictEqual(s.endMonth, 12);
  assert.strictEqual(s.slots, (2025 - 1901) * 12 + 12);
  assert.strictEqual(s.present, 8);
  assert.strictEqual(s.values[s.values.length - 1], 111);
});

check("rows with no trend column still yield a value", () => {
  assert.strictEqual(s.values[s.values.length - 2], 40); // 2025-11, trend columns absent
});

check("NOAA's published trend is recovered from the trend column", () => {
  // -0.310 m at 1901.04 to 0.128 m at 2025.79 => about 3.51 mm/yr
  assert.ok(Math.abs(s.noaaTrend - 3.51) < 0.02, `got ${s.noaaTrend}`);
});

check("the source is flagged as already deseasonalised", () => {
  assert.strictEqual(s.seasonalRemoved, true);
  assert.strictEqual(payload.meta.seasonalRemoved, true);
});

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(proj, { recursive: true, force: true });
console.log(`\n${pass} checks passed`);
