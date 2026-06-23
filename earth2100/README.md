# Earth2100 — Sea Level Rise Analyzer

Drag a timeline from 1854 to 2100 and watch a network of real NOAA tide-gauge
stations and 18 analyzed coastal cities respond, while a live monitoring
terminal reports mean rise, rate of rise, and per-station readings.

**Every number comes from `globalSeaLevelAnalysis.ipynb`** — real NOAA CO-OPS
monthly mean sea level (MSL), 1854–2024, 13,544 records across 10 stations.
Nothing is simulated.

Deploys as **one Node + Express service** with `package.json` at the repo root,
so there are no subfolder / root-directory issues on Render.

## What the data is

- **10 NOAA CO-OPS stations** (NYC, Boston, Newport, Wilmington, Key West,
  Dauphin Island, San Francisco, San Diego, Seattle, Honolulu) with measured
  OLS + Theil–Sen trends, quadratic acceleration, subsidence-corrected
  (eustatic) rates, total observed rise, and SSP projections to 2100.
- **18 coastal cities** with sea-level-rise to 2100, flooded-area fraction,
  population at risk, and risk level — from the notebook's RBF spatial
  interpolation of the stations (high confidence near US gauges, low confidence
  for distant cities like Tokyo/Sydney, which is shown as a dashed marker).

### How the timeline is reconstructed
The notebook publishes discrete values (trends, acceleration, 2050/2075/2100
projections). To draw a continuous curve at any year:
- **1854–2024:** each station's observed linear OLS trend (`rate × years`).
- **2024–2100:** a quadratic fit to the notebook's own SSP2-4.5 2050/2075/2100
  points, scaled to the chosen scenario's 2100 endpoint.

A station only contributes once its record begins, so the early timeline
honestly shows fewer gauges. The visible kink at 2024 is the projected
acceleration of future rise relative to the historical trend.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:10000

## API (all backed by the notebook data)

```
GET /api/meta
GET /api/stations
GET /api/cities
GET /api/station/:id?year=&scenario=
GET /api/level/:year?scenario=ssp126|ssp245|ssp585
GET /api/health
```

## Deploy on Render

### Blueprint (easiest)
Push to GitHub → Render → **New → Blueprint** → pick the repo. `render.yaml`
sets build/start/health automatically.

### Manual web service
**New → Web Service**, connect repo:

| Setting           | Value            |
| ----------------- | ---------------- |
| Root Directory    | *(leave blank)*  |
| Runtime           | Node             |
| Build Command     | `npm install`    |
| Start Command     | `node server.js` |
| Health Check Path | `/api/health`    |

Render injects `PORT` automatically; the server reads `process.env.PORT`.
Leave **Root Directory blank** — `package.json` is at the repo root.

## Push to GitHub

```bash
git init
git add .
git commit -m "Earth2100 sea level analyzer (real NOAA data)"
git branch -M main
git remote add origin https://github.com/<you>/earth2100.git
git push -u origin main
```

## Limitations (inherited from the notebook)
- US tide-gauge basis; non-US city values are extrapolated (low confidence).
- No coastal defenses, storm surge, or pixel-level DEM flooding.
- Projections stop at 2100 — the horizon the notebook computed.

## Regenerating the data
`data.json` and `public/data.js` are transcribed from the notebook outputs.
To refresh from a re-run notebook, update those two files (same schema).
