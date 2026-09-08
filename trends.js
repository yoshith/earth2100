// Trend estimation for monthly mean sea level.
//
// A series is { id, startYear, startMonth, values: [mm | null, ...] } — one slot
// per calendar month, null where NOAA returned nothing. Gaps are never filled;
// every routine below works on the months that exist and reports coverage so a
// window with a hole in it can be rejected rather than silently mis-fitted.

"use strict";

const MONTHS_PER_YEAR = 12;

/** Decimal year of slot i, at mid-month. */
function slotTime(series, i) {
  const m = series.startMonth - 1 + i;
  return series.startYear + Math.floor(m / 12) + ((m % 12) + 0.5) / 12;
}

/** [{t, y}] for every non-null slot. */
function points(series) {
  const out = [];
  for (let i = 0; i < series.values.length; i++) {
    const v = series.values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      out.push({ t: slotTime(series, i), y: v, month: (series.startMonth - 1 + i) % 12 });
    }
  }
  return out;
}

/**
 * Remove the mean annual cycle.
 *
 * Monthly MSL carries a large seasonal signal (steric expansion, winds). Left in,
 * it inflates the residual variance and the lag-1 autocorrelation, so short-window
 * trends get noisier and their intervals get less trustworthy. Climatology is
 * computed over the whole record, so it cannot absorb any part of the trend.
 */
function deseasonalise(series) {
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (const p of points(series)) {
    sums[p.month] += p.y;
    counts[p.month] += 1;
  }
  const clim = sums.map((s, m) => (counts[m] > 0 ? s / counts[m] : 0));
  const grand =
    clim.reduce((a, b, m) => a + (counts[m] > 0 ? b : 0), 0) /
    Math.max(1, counts.filter((c) => c > 0).length);
  const values = series.values.map((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const month = (series.startMonth - 1 + i) % 12;
    return counts[month] > 0 ? v - (clim[month] - grand) : null;
  });
  return { ...series, values, deseasonalised: true };
}

/**
 * Ordinary least squares slope, with the standard error widened for AR(1)
 * residual autocorrelation via the effective sample size (Santer et al. 2008):
 *
 *   n_eff = n (1 - phi) / (1 + phi),   se_ar1 = se_ols * sqrt((n-2)/(n_eff-2))
 *
 * Plain OLS intervals on monthly sea level are far too narrow — successive months
 * are not independent draws. Reporting the uncorrected one would overstate how
 * well any short-window rate is pinned down.
 */
function ols(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let st = 0, sy = 0;
  for (const p of pts) { st += p.t; sy += p.y; }
  const tbar = st / n, ybar = sy / n;
  let stt = 0, sty = 0;
  for (const p of pts) {
    const dt = p.t - tbar;
    stt += dt * dt;
    sty += dt * (p.y - ybar);
  }
  if (stt === 0) return null;
  const slope = sty / stt;
  const intercept = ybar - slope * tbar;

  let sse = 0;
  const res = new Array(n);
  for (let i = 0; i < n; i++) {
    res[i] = pts[i].y - (intercept + slope * pts[i].t);
    sse += res[i] * res[i];
  }
  const seOls = Math.sqrt(sse / (n - 2) / stt);

  // lag-1 autocorrelation, using only genuinely adjacent months
  let num = 0, den = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(pts[i].t - pts[i - 1].t - 1 / 12) < 1e-6) {
      num += res[i] * res[i - 1];
      den += res[i - 1] * res[i - 1];
    }
  }
  let phi = den > 0 ? num / den : 0;
  phi = Math.min(0.99, Math.max(0, phi));
  const nEff = Math.max(4, (n * (1 - phi)) / (1 + phi));
  const seAr1 = seOls * Math.sqrt((n - 2) / (nEff - 2));

  return { slope, intercept, n, nEff, phi, seOls, seAr1 };
}

/**
 * Centred rolling trend.
 *
 * windowYears defaults to 19 rather than a round 20: mean sea level is modulated
 * by the 18.61-year lunar nodal cycle, and a window that is not close to a whole
 * multiple of it aliases that modulation into the slope.
 */
function rollingTrend(series, opts = {}) {
  const windowYears = opts.windowYears || 19;
  const minCoverage = opts.minCoverage ?? 0.8;
  const stepMonths = opts.stepMonths || 3;
  // A centred window stops half a window short of the present, so it can never
  // answer "what is the rate now". A trailing window can, at the cost of being
  // labelled at its own end rather than its midpoint. Both are offered.
  const align = opts.align === "trailing" ? "trailing" : "centre";
  const pts = points(series);
  if (!pts.length) return [];

  const half = windowYears / 2;
  const first = pts[0].t, last = pts[pts.length - 1].t;
  const expected = windowYears * MONTHS_PER_YEAR;
  const out = [];

  const cStart = align === "trailing" ? first + windowYears : first + half;
  const cEnd = align === "trailing" ? last : last - half;

  let lo = 0, hi = 0;
  for (let c = cStart; c <= cEnd + 1e-9; c += stepMonths / 12) {
    const a = align === "trailing" ? c - windowYears : c - half;
    const b = align === "trailing" ? c : c + half;
    while (lo < pts.length && pts[lo].t < a) lo++;
    while (hi < pts.length && pts[hi].t <= b) hi++;
    const win = pts.slice(lo, hi);
    const coverage = win.length / expected;
    if (coverage < minCoverage) continue;
    const fit = ols(win);
    if (!fit) continue;
    out.push({
      t: Number(c.toFixed(3)),
      slope: Number(fit.slope.toFixed(4)),
      se: Number(fit.seAr1.toFixed(4)),
      seOls: Number(fit.seOls.toFixed(4)),
      phi: Number(fit.phi.toFixed(3)),
      n: fit.n,
      nEff: Number(fit.nEff.toFixed(1)),
      coverage: Number(coverage.toFixed(3)),
      align,
    });
  }
  return out;
}

/** Centred running mean over `years`, one output per month with enough coverage. */
function runningMean(series, years, minCoverage = 0.8) {
  const pts = points(series);
  const half = years / 2;
  const expected = years * MONTHS_PER_YEAR;
  const out = [];
  let lo = 0, hi = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i].t, a = c - half, b = c + half;
    while (lo < pts.length && pts[lo].t < a) lo++;
    while (hi < pts.length && pts[hi].t <= b) hi++;
    const win = pts.slice(lo, hi);
    if (win.length / expected < minCoverage) continue;
    const mean = win.reduce((s, p) => s + p.y, 0) / win.length;
    out.push({ t: Number(c.toFixed(3)), y: Number(mean.toFixed(3)) });
  }
  return out;
}

/** Value of a running-mean curve at the sample nearest `t` (within `tol` years). */
function nearest(curve, t, tol = 0.5) {
  let best = null, bestD = Infinity;
  for (const p of curve) {
    const d = Math.abs(p.t - t);
    if (d < bestD) { bestD = d; best = p; }
  }
  return bestD <= tol ? best : null;
}

/**
 * Orton's method: difference two points on an N-year running mean and divide by
 * the elapsed time. NPCC4 uses an 8-year mean, September 2018 minus 1990, giving
 * 4.6 mm/yr at the Battery. Simpler than a window fit, and gives a number
 * directly comparable to the published one — which is why both are reported.
 */
function endpointRate(series, opts = {}) {
  const meanYears = opts.meanYears || 8;
  const t1 = opts.t1, t2 = opts.t2;
  const curve = runningMean(series, meanYears, opts.minCoverage ?? 0.8);
  const a = nearest(curve, t1), b = nearest(curve, t2);
  if (!a || !b || b.t === a.t) return null;
  return {
    meanYears,
    from: a.t,
    to: b.t,
    rate: Number(((b.y - a.y) / (b.t - a.t)).toFixed(3)),
    note: "endpoint difference of running means; no uncertainty is defined for this estimator",
  };
}

/**
 * Partition relative sea level into land and ocean, NPCC4 Figure 6 style.
 *
 * Vertical land motion is treated as a constant rate, so the land term is a
 * straight line and every departure from straight — all of the acceleration —
 * lands in the ocean term. `vlmRate` is positive for subsidence (land sinking,
 * which raises relative sea level) and negative for uplift.
 */
function decompose(series, vlmRate, refYear) {
  const pts = points(series);
  if (!pts.length) return null;
  const t0 = refYear ?? pts[0].t;
  const anchor = pts[0].y;
  return {
    vlmRate,
    refYear: t0,
    land: pts.map((p) => ({ t: Number(p.t.toFixed(3)), y: Number((vlmRate * (p.t - t0)).toFixed(3)) })),
    ocean: pts.map((p) => ({
      t: Number(p.t.toFixed(3)),
      y: Number((p.y - anchor - vlmRate * (p.t - t0)).toFixed(3)),
    })),
    total: pts.map((p) => ({ t: Number(p.t.toFixed(3)), y: Number((p.y - anchor).toFixed(3)) })),
  };
}

/** Calendar-year means, for the 1-year curve in the NPCC4 Figure 6 style. */
function annualMean(series, minMonths = 10) {
  const buckets = new Map();
  for (const p of points(series)) {
    const y = Math.floor(p.t);
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(p.y);
  }
  const out = [];
  for (const [y, vals] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (vals.length < minMonths) continue;
    out.push({ t: y + 0.5, y: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) });
  }
  return out;
}

/** Full-record trend, for the century-scale figure shown alongside the rolling one. */
function fullRecordTrend(series) {
  const fit = ols(points(series));
  if (!fit) return null;
  const p = points(series);
  return {
    slope: Number(fit.slope.toFixed(3)),
    se: Number(fit.seAr1.toFixed(3)),
    seOls: Number(fit.seOls.toFixed(3)),
    phi: Number(fit.phi.toFixed(3)),
    n: fit.n,
    nEff: Number(fit.nEff.toFixed(1)),
    from: Number(p[0].t.toFixed(2)),
    to: Number(p[p.length - 1].t.toFixed(2)),
  };
}

module.exports = {
  slotTime, points, deseasonalise, ols,
  rollingTrend, runningMean, annualMean, endpointRate, decompose, fullRecordTrend, nearest,
};
