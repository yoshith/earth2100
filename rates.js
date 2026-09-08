// Rate inspector — the century rate against the recent rate, and what each
// component of the rise is doing.
//
// Two charts, drawn as SVG so they scale and stay legible on a phone:
//   1. rate through time, from centred rolling-window fits
//   2. relative sea level split into land motion and ocean, NPCC4 Fig. 6 style

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";

  let stationId = null;
  let windowYears = 19;
  let rates = null;
  let split = null;

  // ---- small SVG helpers ---------------------------------------------------
  const el = (name, attrs, text) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const scale = (d0, d1, r0, r1) => (v) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
  const pathOf = (pts, x, y) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const extent = (arr, key) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of arr) { if (p[key] < lo) lo = p[key]; if (p[key] > hi) hi = p[key]; }
    return [lo, hi];
  };
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
    return out;
  }

  function frame(svg, x, y, xd, yd, yLabel) {
    const g = el("g", {});
    for (const t of niceTicks(yd[0], yd[1], 4)) {
      const yy = y(t);
      g.appendChild(el("line", { x1: x(xd[0]), x2: x(xd[1]), y1: yy, y2: yy, class: "grid" }));
      g.appendChild(el("text", { x: x(xd[0]) - 6, y: yy + 3.5, class: "ax ax-y" }, String(t)));
    }
    for (const t of niceTicks(xd[0], xd[1], 4)) {
      if (t < xd[0] || t > xd[1]) continue;
      g.appendChild(el("text", { x: x(t), y: y(yd[0]) + 16, class: "ax ax-x" }, String(Math.round(t))));
    }
    g.appendChild(el("text", { x: x(xd[0]) - 6, y: y(yd[1]) - 10, class: "ax ax-unit" }, yLabel));
    svg.appendChild(g);
  }

  // ---- chart 1: rate through time -----------------------------------------
  function drawRates(host, r) {
    host.innerHTML = "";
    const W = host.clientWidth || 320, H = 220;
    const m = { t: 22, r: 12, b: 26, l: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
    svg.appendChild(el("title", {}, `Rolling ${r.windowYears}-year sea level trend at ${r.station.name}`));

    const roll = r.rolling;
    if (!roll.length) {
      host.appendChild(el2("p", "empty", `Record too short for a ${r.windowYears}-year window.`));
      return;
    }

    const band = roll.map((p) => ({ t: p.t, lo: p.slope - 1.96 * p.se, hi: p.slope + 1.96 * p.se }));
    const xd = extent(roll, "t");
    let ylo = Math.min(...band.map((b) => b.lo), r.fullRecord.slope);
    let yhi = Math.max(...band.map((b) => b.hi), r.fullRecord.slope);
    if (r.endpoint) { ylo = Math.min(ylo, r.endpoint.rate); yhi = Math.max(yhi, r.endpoint.rate); }
    const pad = (yhi - ylo) * 0.12 || 1;
    ylo -= pad; yhi += pad;

    const x = scale(xd[0], xd[1], m.l, W - m.r);
    const y = scale(ylo, yhi, H - m.b, m.t);
    frame(svg, x, y, xd, [ylo, yhi], "mm/yr");

    // 95% band, widened for AR(1) residual autocorrelation
    const up = band.map((b) => `${x(b.t).toFixed(1)},${y(b.hi).toFixed(1)}`);
    const down = band.slice().reverse().map((b) => `${x(b.t).toFixed(1)},${y(b.lo).toFixed(1)}`);
    svg.appendChild(el("polygon", { points: up.concat(down).join(" "), class: "band" }));

    // century rate reference
    const cy = y(r.fullRecord.slope);
    svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: cy, y2: cy, class: "ref" }));
    svg.appendChild(el("text", { x: W - m.r, y: cy - 5, class: "reflab", "text-anchor": "end" },
      `full record ${r.fullRecord.slope.toFixed(2)}`));

    // Orton's estimator, drawn across the interval it actually spans
    if (r.endpoint) {
      const ey = y(r.endpoint.rate);
      svg.appendChild(el("line", {
        x1: x(Math.max(xd[0], r.endpoint.from)), x2: x(Math.min(xd[1], r.endpoint.to)),
        y1: ey, y2: ey, class: "endpoint",
      }));
    }

    svg.appendChild(el("path", { d: pathOf(roll.map((p) => ({ t: p.t, y: p.slope })), x, y), class: "line-rate" }));

    const last = roll[roll.length - 1];
    svg.appendChild(el("circle", { cx: x(last.t), cy: y(last.slope), r: 3.5, class: "dot-now" }));

    host.appendChild(svg);
  }

  // ---- chart 2: land / ocean partition ------------------------------------
  function drawSplit(host, d) {
    host.innerHTML = "";
    const W = host.clientWidth || 320, H = 220;
    const m = { t: 22, r: 12, b: 26, l: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
    svg.appendChild(el("title", {}, `Land motion and ocean contributions at ${d.station.name}`));

    const all = d.total.annual.concat(d.total.smooth, d.land, d.ocean);
    const xd = extent(d.total.annual, "t");
    const yd0 = extent(all, "y");
    const pad = (yd0[1] - yd0[0]) * 0.1 || 10;
    const yd = [yd0[0] - pad, yd0[1] + pad];

    const x = scale(xd[0], xd[1], m.l, W - m.r);
    const y = scale(yd[0], yd[1], H - m.b, m.t);
    frame(svg, x, y, xd, yd, "mm");

    svg.appendChild(el("path", { d: pathOf(d.total.annual, x, y), class: "line-annual" }));
    svg.appendChild(el("path", { d: pathOf(d.total.smooth, x, y), class: "line-total" }));
    svg.appendChild(el("path", { d: pathOf(d.land, x, y), class: "line-land" }));
    svg.appendChild(el("path", { d: pathOf(d.ocean, x, y), class: "line-ocean" }));

    host.appendChild(svg);
  }

  function el2(tag, cls, text) {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = text;
    return n;
  }

  // ---- readouts ------------------------------------------------------------
  const mmyr = (v) => (v === null || v === undefined ? "—" : v.toFixed(2));

  function renderNumbers(r) {
    const c = r.fullRecord, n = r.current;
    const ratio = c && n ? n.slope / c.slope : null;
    $("riCentury").textContent = `${mmyr(c.slope)} ± ${mmyr(1.96 * c.se)}`;
    // floor, not round: a record ending mid-2026 must not be labelled 2027
    $("riCenturyRange").textContent = `${Math.floor(c.from)}–${Math.floor(c.to)}`;
    $("riRecent").textContent = n ? `${mmyr(n.slope)} ± ${mmyr(1.96 * n.se)}` : "—";
    $("riRecentRange").textContent = n ? `${Math.floor(n.t - r.windowYears)}–${Math.floor(n.t)}` : "—";
    $("riRatio").textContent = ratio ? `${ratio.toFixed(2)}×` : "—";

    // A short window on a noisy record has a wide interval. If that interval
    // still covers the full-record rate, this one window is not on its own
    // evidence of a change in rate, and saying so is the honest reading.
    const sig = $("riRatioNote");
    if (n && c) {
      const lo = n.slope - 1.96 * n.se;
      sig.textContent =
        lo > c.slope
          ? `faster than the full record even at the low end of the interval (${mmyr(lo)})`
          : `interval reaches down to ${mmyr(lo)}, which still covers the full-record rate — ` +
            `this window alone does not establish a change`;
      sig.className = lo > c.slope ? "ri-sig strong" : "ri-sig weak";
    } else {
      sig.textContent = "";
    }

    $("riEndpoint").textContent = r.endpoint ? mmyr(r.endpoint.rate) : "—";
    $("riEndpointRange").textContent = r.endpoint
      ? `1990–${r.endpoint.to.toFixed(1)}, 8-yr means, as NPCC4` +
        (r.endpointLatest ? ` · to ${r.endpointLatest.to.toFixed(1)}: ${mmyr(r.endpointLatest.rate)}` : "")
      : "not available";

    const s = r.split;
    $("riLand").textContent = mmyr(s.land);
    $("riOceanCentury").textContent = mmyr(s.centuryOcean);
    $("riOceanRecent").textContent = mmyr(s.recentOcean);

    const v = r.vlm;
    const src = $("riVlmSource");
    if (v.status === "cited") {
      src.className = "vlm-src cited";
      src.textContent = `${mmyr(v.rate)}${v.unc ? ` ± ${v.unc}` : ""} mm/yr — ${v.source}`;
    } else {
      src.className = "vlm-src unsourced";
      src.textContent =
        `${mmyr(v.rate)} mm/yr, carried over from the analysis notebook with no published ` +
        `source. The split below is only as good as this number.`;
    }
  }

  // ---- loading -------------------------------------------------------------
  async function load() {
    const body = $("riBody");
    $("riStatus").textContent = "loading";
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/rates/${stationId}?window=${windowYears}`),
        fetch(`/api/decompose/${stationId}`),
      ]);
      if (!a.ok) {
        const err = await a.json().catch(() => ({}));
        throw new Error(err.error || `rates unavailable (${a.status})`);
      }
      rates = await a.json();
      split = b.ok ? await b.json() : null;

      body.classList.remove("failed");
      $("riStatus").textContent = `${rates.station.loc} · from ${rates.station.start}`;
      $("riTitle").textContent = rates.station.name;
      renderNumbers(rates);
      drawRates($("riChartRate"), rates);
      if (split) drawSplit($("riChartSplit"), split);
      const bits = [
        `lag-1 autocorrelation ${rates.fullRecord.phi.toFixed(2)}`,
        `${rates.fullRecord.n.toLocaleString()} months reduce to ${Math.round(rates.fullRecord.nEff)} effective`,
      ];
      // Show NOAA's own published trend beside ours when the source provides it.
      if (typeof rates.noaaPublishedTrend === "number") {
        const gap = Math.abs(rates.noaaPublishedTrend - rates.fullRecord.slope);
        bits.push(
          `NOAA publishes ${rates.noaaPublishedTrend.toFixed(2)} for this record, ` +
          `${gap < 0.1 ? "which we reproduce" : `${gap.toFixed(2)} from ours`}`
        );
      }
      $("riPhi").textContent = bits.join("; ");
    } catch (err) {
      body.classList.add("failed");
      $("riStatus").textContent = "unavailable";
      $("riChartRate").innerHTML = "";
      $("riChartSplit").innerHTML = "";
      $("riChartRate").appendChild(el2("p", "empty", err.message));
      $("riChartRate").appendChild(
        el2("p", "empty", "Run `npm run fetch` to write series.json, then restart.")
      );
    }
  }

  function open(id) {
    stationId = id;
    document.body.classList.add("inspecting");
    $("inspector").hidden = false;
    load();
  }
  function close() {
    document.body.classList.remove("inspecting");
    $("inspector").hidden = true;
  }

  // ---- wiring --------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    $("riClose").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("inspector").hidden) close();
    });

    const sel = $("riStation");
    (window.SLR_DATA?.stations || []).forEach((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => { stationId = sel.value; load(); });

    document.querySelectorAll("#riWindow button").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#riWindow button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        windowYears = Number(b.dataset.window);
        load();
      });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if ($("inspector").hidden) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (rates) drawRates($("riChartRate"), rates);
        if (split) drawSplit($("riChartSplit"), split);
      }, 150);
    });

    // Terminal readout. Lives here rather than in app.js so that a failure of the
    // map library cannot take the rate figure down with it.
    const out = $("rRecent");
    if (out) {
      fetch("/api/rate-summary?window=19")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
        .then((d) => {
          const vals = d.stations.map((s) => s.recent).filter((v) => typeof v === "number");
          if (!vals.length) { out.textContent = "unavailable"; return; }
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          out.textContent = mean.toFixed(2) + " mm/yr";
          out.title = `Mean of the most recent ${d.windowYears}-year window trend across ${vals.length} stations`;
        })
        .catch(() => { out.textContent = "unavailable"; });
    }
  });

  window.RateInspector = {
    open: (id) => {
      const sel = $("riStation");
      if (sel) sel.value = id;
      open(id);
    },
  };
})();
