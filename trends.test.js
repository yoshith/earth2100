// Synthetic-data checks for lib/trends.js.
//
// Everything here is generated, with known answers, purely to verify the maths.
// None of it is sea level data and none of it reaches the application.

"use strict";
const assert = require("assert");
const T = require("../lib/trends");

function synth({ startYear = 1900, years = 120, rate = 2.0, accel = 0, seasonal = 0, noise = 0, phi = 0, gaps = [] }) {
  const values = [];
  let prev = 0;
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
  for (let i = 0; i < years * 12; i++) {
    const t = i / 12;
    const month = i % 12;
    const e = phi * prev + noise * rnd();
    prev = e;
    const y = rate * t + 0.5 * accel * t * t + seasonal * Math.sin((2 * Math.PI * month) / 12) + e;
    const year = startYear + Math.floor(i / 12);
    values.push(gaps.some(([a, b]) => year >= a && year <= b) ? null : y);
  }
  return { id: "synthetic", startYear, startMonth: 1, values };
}

let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

console.log("trend maths");

check("recovers a known linear rate", () => {
  const fit = T.fullRecordTrend(synth({ rate: 3.0 }));
  assert.ok(Math.abs(fit.slope - 3.0) < 1e-6, `got ${fit.slope}`);
});

check("deseasonalising removes the seasonal bias in the slope", () => {
  const s = synth({ rate: 2.5, seasonal: 60 });
  const raw = T.fullRecordTrend(s).slope;
  const des = T.fullRecordTrend(T.deseasonalise(s)).slope;
  assert.ok(Math.abs(des - 2.5) < 1e-6, `deseasonalised should be exact, got ${des}`);
  assert.ok(Math.abs(raw - 2.5) > Math.abs(des - 2.5), `raw should be biased, got ${raw}`);
});

check("deseasonalising shrinks residual variance", () => {
  const s = synth({ rate: 2.5, seasonal: 60 });
  const a = T.ols(T.points(s));
  const b = T.ols(T.points(T.deseasonalise(s)));
  assert.ok(b.seOls < a.seOls / 5, `${b.seOls} vs ${a.seOls}`);
});

check("rolling window tracks a known acceleration", () => {
  // rate(t) = 1.5 + 0.04t; over a 120-year record the window slope should climb
  const r = T.rollingTrend(synth({ rate: 1.5, accel: 0.04, years: 120 }), { windowYears: 19 });
  const first = r[0].slope, last = r[r.length - 1].slope;
  assert.ok(last > first + 3, `${first} -> ${last}`);
  // centred window on a quadratic returns the instantaneous rate at its centre
  const mid = r[Math.floor(r.length / 2)];
  const expected = 1.5 + 0.04 * (mid.t - 1900);
  assert.ok(Math.abs(mid.slope - expected) < 0.05, `${mid.slope} vs ${expected}`);
});

check("AR(1) correction widens the interval on autocorrelated noise", () => {
  const s = T.deseasonalise(synth({ rate: 2.0, noise: 40, phi: 0.85 }));
  const r = T.rollingTrend(s, { windowYears: 19 });
  const w = r[Math.floor(r.length / 2)];
  assert.ok(w.phi > 0.4, `phi=${w.phi}`);
  assert.ok(w.se > w.seOls * 1.5, `se ${w.se} vs ols ${w.seOls}`);
  assert.ok(w.nEff < w.n, `nEff=${w.nEff} n=${w.n}`);
});

check("windows straddling a gap are dropped, not mis-fitted", () => {
  const r = T.rollingTrend(synth({ rate: 2.0, years: 120, gaps: [[1940, 1955]] }), { windowYears: 19 });
  const straddling = r.filter((p) => p.t > 1940 && p.t < 1955);
  assert.strictEqual(straddling.length, 0);
  assert.ok(r.every((p) => p.coverage >= 0.8));
});

check("endpoint differencing recovers a known rate", () => {
  const s = T.deseasonalise(synth({ rate: 4.0, years: 120 }));
  const e = T.endpointRate(s, { meanYears: 8, t1: 1950, t2: 1990 });
  assert.ok(Math.abs(e.rate - 4.0) < 0.05, `got ${e.rate}`);
});

check("a centred window cannot reach the end of the record", () => {
  const s = T.deseasonalise(synth({ rate: 2.0, years: 120 })); // 1900-2019
  const centred = T.rollingTrend(s, { windowYears: 19, align: "centre" });
  const trailing = T.rollingTrend(s, { windowYears: 19, align: "trailing" });
  const lastObs = 2019.96;
  assert.ok(lastObs - centred[centred.length - 1].t > 9, "centred lags by half a window");
  assert.ok(lastObs - trailing[trailing.length - 1].t < 0.2, "trailing reaches the present");
});

check("endpoint and window methods disagree under acceleration", () => {
  const s = T.deseasonalise(synth({ rate: 1.5, accel: 0.04, years: 120 }));
  const e = T.endpointRate(s, { meanYears: 8, t1: 1980, t2: 2008.7 });
  const r = T.rollingTrend(s, { windowYears: 19, align: "centre" });
  const w = T.nearest(r.map((p) => ({ t: p.t, y: p.slope })), 2008.7, 2);
  assert.ok(e && w, "both estimators must return a value");
  assert.ok(Math.abs(e.rate - w.y) > 0.2, `endpoint ${e.rate} vs window ${w.y}`);
});

check("partition puts all curvature in the ocean term", () => {
  const s = T.deseasonalise(synth({ rate: 1.5, accel: 0.04, years: 120 }));
  const d = T.decompose(s, 1.5, 1900);
  const landFit = T.ols(d.land.map((p) => ({ t: p.t, y: p.y })));
  assert.ok(Math.abs(landFit.slope - 1.5) < 1e-6, "land term must be exactly linear");
  const oceanFit = T.ols(d.ocean.map((p) => ({ t: p.t, y: p.y })));
  assert.ok(oceanFit.slope > 1.5, `ocean carries the growth: ${oceanFit.slope}`);
  const sumErr = d.total.map((p, i) => Math.abs(p.y - (d.land[i].y + d.ocean[i].y)));
  assert.ok(Math.max(...sumErr) < 2e-3, "land + ocean must reconstruct the total (to rounding)");
});

check("uplift is handled as a negative land term", () => {
  const d = T.decompose(T.deseasonalise(synth({ rate: 1.0, years: 100 })), -0.8, 1900);
  assert.ok(d.land[d.land.length - 1].y < 0);
});

console.log(`\n${pass} checks passed`);
