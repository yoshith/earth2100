# Earth2100 — sea level rise analyzer

Interactive analyzer built on NOAA CO-OPS tide-gauge records. Ten US stations,
1854–2024, plus 18 analyzed coastal cities. Nothing is simulated: summary figures
are transcribed from `globalSeaLevelAnalysis.ipynb`, and rate-through-time is
computed from the monthly series retrieved from NOAA's own API.

## Validation

`series.json` holds 13,812 monthly records for ten stations, 1854–2026, and is
committed to this repository. Our own OLS reproduces NOAA's published trend on
every station, which is the check that matters — same data, independent fit:

| Station | ours | NOAA published |
| --- | --- | --- |
| New York City | 2.951 | 2.946 |
| Boston | 2.980 | 2.969 |
| Newport | 2.991 | 2.979 |
| Wilmington | 2.788 | 2.798 |
| Key West | 2.648 | 2.643 |
| Dauphin Island | 4.336 | 4.370 |
| San Francisco | 1.522 | 1.577 |
| San Diego | 2.238 | 2.221 |
| Seattle | 2.102 | 2.091 |
| Honolulu | 1.574 | 1.565 |

All within 0.06 mm/yr. At The Battery, endpoint differencing of 8-year means from
1990 to September 2018 — NPCC4's own method and period — gives **4.45 mm/yr**
against their published 4.6.

## Rate through time

A single full-record trend hides the thing that matters. At The Battery the
full-record rate is 2.95 mm/yr, but the rolling window reaches 4.98 mm/yr over
2007–2026. The inspector shows both, and splits each into its two physical parts.

**It also shows when the difference is not solid.** A 19-year window on a noisy
record has a wide interval: 4.98 ± 2.28 mm/yr reaches down to 2.71, which still
covers the full-record rate. So that one window, on its own, does not establish a
change in rate, and the interface says so in amber rather than letting the
headline number speak unchallenged. The case for acceleration rests on the shape
of the whole rolling curve and on the record-length tests in the paper, not on a
single window.

Open it from any station marker on the map, or from the station menu in the
inspector header.

**Rolling-window trend.** Ordinary least squares over a moving window, plotted
through time with a 95% interval. Windows are 19 years by default, not a round
20: mean sea level is modulated by the 18.61-year lunar nodal cycle, and a window
that is not close to a whole multiple of it folds that modulation into the slope.
NOAA's own National Tidal Datum Epoch is 19 years for the same reason. 10- and
38-year windows are available for comparison.

**Intervals are corrected for autocorrelation.** Monthly sea level residuals are
strongly autocorrelated, so plain OLS standard errors are far too narrow. The
lag-1 coefficient is estimated from the residuals and the interval widened via the
effective sample size, `n_eff = n(1-φ)/(1+φ)` (Santer et al. 2008). At The Battery
a couple of thousand months typically behave like a few dozen independent ones —
the inspector reports both counts.

**Endpoint differencing.** The estimator used in NPCC4: difference two points on
an 8-year running mean and divide by the elapsed time. Reported twice — once
ending September 2018 to match NPCC4's period exactly, and once running to the
end of the current record, which holds several more years than NPCC4 had. At The
Battery those are 4.45 and 5.15 mm/yr. Showing only the updated figure would
quietly move the goalposts; showing only the matched one would waste the newer
data. The window fit and the endpoint method do not agree exactly, and that
disagreement is displayed rather than hidden — it is a methodological choice, not
a bug.

**Centred versus trailing windows.** A centred window stops half a window short of
the present, so it cannot answer "what is the rate now". The chart uses centred
windows; the headline "most recent window" figure uses a trailing one and is
labelled with the years it actually spans.

**The series is deseasonalised first.** The mean annual cycle is removed before
fitting, using a climatology computed over the whole record so it cannot absorb
any part of the trend. Left in, the seasonal signal both inflates the residual
autocorrelation and puts a small bias in the slope.

**Gaps are never filled.** Months NOAA does not return stay null. A window with
less than 80% coverage is dropped rather than fitted across the hole.

## Land and ocean

Relative sea level is split into vertical land motion and an ocean residual, in
the style of NPCC4 Figure 6 (Braneon et al. 2024, *Ann. N.Y. Acad. Sci.* 1539).
Land motion is treated as a constant rate, so its line is straight and every bend
in the total belongs to the ocean term. Positive means subsidence; Seattle and
San Francisco are negative, and their land line falls.

**Read the VLM provenance before quoting the split.** Only The Battery carries a
published estimate (−1.5 ± 0.2 mm/yr, NPCC4). The other nine values are constants
inherited from the analysis notebook with no source attached; the interface says
so in amber on those stations. The split is only as good as that number, and
replacing the unsourced ones — with per-site VLM from the IPCC AR6 projection
dataset (Garner et al. 2021), or GNSS-derived rates — is the outstanding task.

## Data

Two official NOAA sources, either of which fills `series.json`:

```bash
npm run fetch                  # sltrends product (default)
npm run fetch -- --source api  # CO-OPS datagetter, as the notebook uses
```

**sltrends** (`tidesandcurrents.noaa.gov/sltrends/data/<id>_meantrend.txt`) is
NOAA's published sea level trends product: monthly MSL in metres relative to the
most recent MSL datum, with NOAA's average seasonal cycle already removed, plus
NOAA's own fitted trend line. It runs later than the API export and gives a
published trend to check our arithmetic against — the inspector prints both.

**api** (`api.tidesandcurrents.noaa.gov/api/prod/datagetter`, `product=monthly_mean`,
`datum=MSL`) is the exact call `globalSeaLevelAnalysis.ipynb` makes. Use it when
consistency with the notebook matters more than currency.

The server knows which it has and only deseasonalises the API series; removing
the seasonal cycle from the sltrends product a second time would be wrong.

If `series.json` is absent the server fetches on boot and caches to a temporary
file. If NOAA is unreachable the rate endpoints return 503 and the interface says
the series is unavailable; it does not fall back to invented numbers.

## Run

```bash
npm install
npm start          # http://localhost:10000
npm test           # trend maths and the NOAA file parser
```

`series.json` is committed, so the app runs offline with no fetch step. Refresh it
with `npm run fetch`, or rebuild from files you have already downloaded with
`npm run fetch -- --from-dir ./raw` (matches by station ID, or by station name
when the exporter left the ID out).

## Deploy (Render)

`render.yaml` sets build, start and health check. `package.json` must be at the
repository root, or the Root Directory field must name the folder that contains
it.

| Setting           | Value            |
| ----------------- | ---------------- |
| Runtime           | Node             |
| Build Command     | `npm install`    |
| Start Command     | `node server.js` |
| Health Check Path | `/api/health`    |

`/api/health` reports whether the monthly series loaded.

## API

| Endpoint | Returns |
| --- | --- |
| `/api/rates/:id?window=19` | rolling trend, full-record trend, endpoint estimate, split |
| `/api/decompose/:id` | land and ocean curves, NPCC4 Figure 6 style |
| `/api/rate-summary?window=19` | century vs recent rate for every station |
| `/api/series/:id` | the raw monthly series, so the arithmetic can be checked |
| `/api/level/:year?scenario=` | mean rise and per-station rise at a year |
| `/api/station/:id` | station metadata and notebook figures |

## Limitations

- US tide gauges only; non-US city values are extrapolated and marked low confidence.
- Projections to 2100 are scaled from the notebook's SSP endpoints; they are
  illustrative bounds, not a calibrated forecast.
- No coastal defenses, storm surge, or pixel-level DEM flooding.
- VLM is a constant per station, and unsourced at nine of the ten.
- A 19-year window cannot reach the last 9.5 years of the record when centred;
  the headline recent figure uses a trailing window and is labelled accordingly.
- Wilmington's recent window (9.88 ± 3.36 mm/yr) is far above its full-record
  rate. The interval is wide and the value is real, not a parsing error, but it
  should not be quoted without that context.
