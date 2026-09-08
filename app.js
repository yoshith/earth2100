(function () {
  "use strict";
  const DATA = window.SLR_DATA;
  const M = DATA.meta;
  const BASE = M.baselineYear; // 2024

  let year = BASE;
  let scenario = "ssp245";
  let playing = false, playTimer = null;

  const SCEN_LABEL = { ssp126: "SSP1-2.6 (low)", ssp245: "SSP2-4.5 (intermediate)", ssp585: "SSP5-8.5 (high)" };

  // ---- Projection model (mirrors server) --------------------------------
  function stationLevel(s, y, sc) {
    if (y < s.start) return null; // no record yet
    const t = y - BASE;
    if (t <= 0) return s.rate * t; // observed linear OLS trend
    const scale = s.proj[sc][0] / s.proj.ssp245[0];
    return scale * (s.r245 * t + 0.5 * s.a245 * t * t); // SSP projection
  }
  function stationRate(s, y, sc) {
    if (y < s.start) return null;
    const t = y - BASE;
    if (t <= 0) return s.rate;
    const scale = s.proj[sc][0] / s.proj.ssp245[0];
    return scale * (s.r245 + s.a245 * t);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const meanLevel = (y, sc) => mean(DATA.stations.map((s) => stationLevel(s, y, sc)).filter((x) => x !== null));
  const meanRate = (y, sc) => mean(DATA.stations.map((s) => stationRate(s, y, sc)).filter((x) => x !== null));
  const activeCount = (y) => DATA.stations.filter((s) => y >= s.start).length;

  // Normalised mean SSP2-4.5 curve, used only to place city markers across time.
  const cityShape2100 = mean(DATA.stations.map((s) => s.r245 * 76 + 0.5 * s.a245 * 76 * 76));
  function cityFraction(y, sc) {
    const t = y - BASE;
    if (t <= 0) return (meanLevel(y, "ssp245") / 1000) / (cityShape2100 / 1000); // small negative
    const shape = mean(DATA.stations.map((s) => s.r245 * t + 0.5 * s.a245 * t * t)) / cityShape2100;
    const scen = mean(DATA.stations.map((s) => s.proj[sc][0])) / mean(DATA.stations.map((s) => s.proj.ssp245[0]));
    return shape * scen; // 1.0 at 2100 under SSP2-4.5
  }

  // ---- Formatting --------------------------------------------------------
  const mm = (v) => (v >= 0 ? "+" : "") + Math.round(v) + " mm";
  const RISK_COLOR = { MODERATE: "var(--amber)", HIGH: "var(--orange)", EXTREME: "var(--coral)" };
  // station colour by measured rate: cool (slow) -> warm (fast)
  function rateColor(r) {
    if (r < 1.8) return "#7fd4ff";
    if (r < 2.4) return "#46c7e0";
    if (r < 3.0) return "var(--phosphor)";
    if (r < 3.8) return "var(--amber)";
    return "var(--coral)";
  }

  // ---- Map ---------------------------------------------------------------
  const map = L.map("map", {
    center: [28, -40], zoom: 3, minZoom: 2, maxZoom: 9,
    worldCopyJump: true, zoomControl: false, attributionControl: true,
  });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO · data: NOAA CO-OPS",
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);

  const cityLayer = L.layerGroup().addTo(map);
  const stationLayer = L.layerGroup().addTo(map);

  // Cities (drawn under stations)
  const cityMarkers = DATA.cities.map((c) => {
    const m = L.circleMarker([c.lat, c.lon], {
      radius: 5 + c.slr2100 * 3,
      color: RISK_COLOR[c.risk], weight: c.conf === "LOW" ? 1 : 2,
      dashArray: c.conf === "LOW" ? "3 3" : null,
      fillColor: RISK_COLOR[c.risk], fillOpacity: 0.15,
    }).addTo(cityLayer);
    m.bindPopup(() => cityPopup(c), { closeButton: true });
    m.on("click", () => m.setPopupContent(cityPopup(c)));
    return { c, m };
  });
  function cityPopup(c) {
    const local = c.slr2100 * 1000 * cityFraction(year, scenario);
    return `<div class="pop city-pop">
      <h4>${c.name}</h4>
      <div class="sub">${c.region} · ${c.conf} confidence</div>
      <table>
        <tr><td>SLR by 2100</td><td>${c.slr2100.toFixed(2)} m</td></tr>
        <tr><td>flooded area</td><td>${c.floodFrac.toFixed(1)} %</td></tr>
        <tr><td>pop. at risk</td><td>${c.popRisk.toFixed(2)} M</td></tr>
        <tr><td>risk level</td><td class="risk">${c.risk}</td></tr>
        <tr><td>at ${year}</td><td class="risk">${mm(local)}</td></tr>
      </table>
      <div class="note">RBF interpolation of NOAA stations${c.conf === "LOW" ? " · extrapolated, low confidence" : ""}</div>
    </div>`;
  }

  // Stations (primary layer)
  const stationMarkers = DATA.stations.map((s) => {
    const m = L.circleMarker([s.lat, s.lon], {
      radius: 6, color: rateColor(s.rate), weight: 2,
      fillColor: rateColor(s.rate), fillOpacity: 0.55,
    }).addTo(stationLayer);
    m.bindPopup(() => stationPopup(s), { closeButton: true });
    m.on("click", () => m.setPopupContent(stationPopup(s)));
    return { s, m };
  });
  function stationPopup(s) {
    const raw = stationLevel(s, year, scenario);
    const atYear = raw === null ? "no record yet" : mm(raw);
    const p = s.proj[scenario];
    return `<div class="pop stn-pop">
      <h4>${s.name} <span class="id">#${s.id}</span></h4>
      <div class="sub">${s.loc} · record from ${s.start}</div>
      <table>
        <tr><td>measured rate</td><td>${s.rate.toFixed(2)} ± ${s.stderr.toFixed(2)} mm/yr</td></tr>
        <tr><td>Theil–Sen</td><td>${s.theilsen.toFixed(2)} mm/yr</td></tr>
        <tr><td>acceleration</td><td>${s.accel.toFixed(4)} mm/yr²</td></tr>
        <tr><td>eustatic (corr.)</td><td>${s.corrected.toFixed(2)} mm/yr</td></tr>
        <tr><td>subsidence</td><td>${s.subs.toFixed(1)} mm/yr</td></tr>
        <tr><td>observed rise</td><td>${Math.round(s.totalRise)} mm</td></tr>
        <tr><td>2100 (${scenario.toUpperCase()})</td><td>+${p[0]} mm [${p[1]}, ${p[2]}]</td></tr>
        <tr><td>at ${year}</td><td class="risk">${atYear}</td></tr>
      </table>
      <div class="note">NOAA CO-OPS monthly MSL · OLS + Theil–Sen</div>
      <button class="ratebtn" data-rate="${s.id}">Rate through time</button>
    </div>`;
  }

  // Popups are rebuilt on every open, so the handler is delegated.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rate]");
    if (btn && window.RateInspector) window.RateInspector.open(btn.dataset.rate);
  });

  // ---- Terminal ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  function renderTerminal() {
    const lvl = meanLevel(year, scenario);
    const rate = meanRate(year, scenario);
    const projected = year > BASE;
    $("rYear").textContent = year;
    $("rRise").textContent = mm(lvl);
    $("rRate").textContent = rate.toFixed(2) + " mm/yr";
    $("rScenario").textContent = SCEN_LABEL[scenario];
    $("rTrend").textContent = M.meanObservedRate.toFixed(2) + " mm/yr";
    $("rEustatic").textContent = M.meanCorrectedRate.toFixed(2) + " mm/yr";
    const nActive = activeCount(year);
    $("rState").textContent = projected ? "PROJECTED" : "OBSERVED";
    $("rState").className = "state " + (projected ? "proj" : "obs");
    $("rStateInline").textContent =
      (projected ? `projected · ${scenario.toUpperCase()}` : "observed") + ` · ${nActive}/10 on record`;

    const rows = DATA.stations
      .map((s) => ({ name: s.name, v: stationLevel(s, year, scenario), rate: s.rate }))
      .filter((r) => r.v !== null)
      .sort((a, b) => b.v - a.v);
    $("rStations").innerHTML = rows.map((r) => {
      const w = Math.max(0, Math.min(100, (r.v / 1500) * 100));
      return `<div class="srow"><span class="sn">${r.name}</span>
        <span class="bar"><i style="width:${w}%;background:${rateColor(r.rate)}"></i></span>
        <span class="sv">${mm(r.v)}</span></div>`;
    }).join("");

    $("rFoot").innerHTML = `SOURCE: ${M.source}<br/>
      ${M.coverage} · ${M.records.toLocaleString()} records · ${M.nStations} stations · ${M.nCities} cities<br/>
      <span class="muted">observations ≤ 2024 · projections SSP-scaled to 2100</span>`;
  }

  // ---- Update cycle ------------------------------------------------------
  function update() {
    stationMarkers.forEach(({ s, m }) => {
      const raw = stationLevel(s, year, scenario);
      if (raw === null) { // pre-record: dim and shrink
        m.setRadius(3);
        m.setStyle({ opacity: 0.3, fillOpacity: 0.05 });
      } else {
        m.setRadius(5 + Math.min(12, Math.max(0, raw) / 90));
        m.setStyle({ opacity: 1, fillOpacity: 0.55 });
      }
      if (m.isPopupOpen()) m.setPopupContent(stationPopup(s));
    });
    cityMarkers.forEach(({ c, m }) => {
      const f = Math.max(0, cityFraction(year, scenario));
      m.setStyle({ fillOpacity: 0.1 + Math.min(0.6, (c.floodFrac / 100) * f) });
      if (m.isPopupOpen()) m.setPopupContent(cityPopup(c));
    });
    renderTerminal();
  }

  // tooltips bound after creation
  stationMarkers.forEach(({ s, m }) => m.bindTooltip(`${s.name} · ${s.rate.toFixed(2)} mm/yr`, { direction: "top" }));
  cityMarkers.forEach(({ c, m }) => m.bindTooltip(`${c.name} · ${c.risk}`, { direction: "top" }));

  // ---- Controls ----------------------------------------------------------
  const slider = $("yearSlider");
  slider.addEventListener("input", () => { year = Number(slider.value); update(); });

  document.querySelectorAll(".scenario button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".scenario button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      scenario = btn.dataset.scenario;
      update();
    });
  });

  const playBtn = $("playBtn");
  function stopPlay() { playing = false; clearInterval(playTimer); playBtn.textContent = "▶ Play"; }
  playBtn.addEventListener("click", () => {
    if (playing) return stopPlay();
    playing = true; playBtn.textContent = "❚❚ Pause";
    if (year >= M.maxYear) { year = 1900; slider.value = year; }
    playTimer = setInterval(() => {
      year += 1;
      if (year >= M.maxYear) { year = M.maxYear; stopPlay(); }
      slider.value = year; update();
    }, 55);
  });

  update();

})();
