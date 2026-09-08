// REAL data from globalSeaLevelAnalysis.ipynb (NOAA CO-OPS, 1854-2024).
// Trends/acceleration: OLS+Theil-Sen on monthly MSL. Projections: SSP-scaled to 2100.
// Curve params r245,a245 fit to the notebook's own SSP2-4.5 2050/2075/2100 points.
// Nothing here is simulated; all figures are transcribed from notebook outputs.
window.SLR_DATA = {
 "meta": {
  "source": "NOAA CO-OPS Monthly Mean Sea Level (MSL)",
  "coverage": "1854-2024",
  "records": 13544,
  "nStations": 10,
  "meanObservedRate": 2.614,
  "meanCorrectedRate": 1.654,
  "meanAccel": 0.034751,
  "acceleratingStations": "10/10",
  "nCities": 18,
  "totalPop": 128.8,
  "totalAtRisk": 8.7,
  "baselineYear": 2024,
  "minYear": 1854,
  "maxYear": 2100,
  "scenarios": {
   "ssp126": "SSP1-2.6 (low)",
   "ssp245": "SSP2-4.5 (intermediate)",
   "ssp585": "SSP5-8.5 (high)"
  }
 },
 "stations": [
  {
   "id": "8518750",
   "name": "New York City",
   "loc": "The Battery, NY",
   "lat": 40.7,
   "lon": -74.0142,
   "region": "North Atlantic",
   "start": 1856,
   "subs": 1.5,
   "rate": 2.949,
   "stderr": 0.041,
   "theilsen": 2.961,
   "accel": 0.012058,
   "early": 2.725,
   "late": 4.096,
   "corrected": 1.449,
   "totalRise": 355.0,
   "r245": 8.9607,
   "a245": 0.0332,
   "proj": {
    "ssp126": [
     594,
     365,
     824
    ],
    "ssp245": [
     777,
     479,
     1075
    ],
    "ssp585": [
     1109,
     686,
     1531
    ]
   }
  },
  {
   "id": "8443970",
   "name": "Boston",
   "loc": "Boston, MA",
   "lat": 42.354,
   "lon": -71.0534,
   "region": "North Atlantic",
   "start": 1921,
   "subs": 1.2,
   "rate": 2.972,
   "stderr": 0.054,
   "theilsen": 2.971,
   "accel": 0.010976,
   "early": 3.441,
   "late": 3.651,
   "corrected": 1.772,
   "totalRise": 201.0,
   "r245": 8.6717,
   "a245": 0.03295,
   "proj": {
    "ssp126": [
     572,
     332,
     811
    ],
    "ssp245": [
     754,
     446,
     1062
    ],
    "ssp585": [
     1086,
     653,
     1519
    ]
   }
  },
  {
   "id": "8452660",
   "name": "Newport",
   "loc": "Newport, RI",
   "lat": 41.5053,
   "lon": -71.3261,
   "region": "North Atlantic",
   "start": 1930,
   "subs": 1.0,
   "rate": 2.974,
   "stderr": 0.068,
   "theilsen": 3.0,
   "accel": 0.028179,
   "early": 2.885,
   "late": 3.65,
   "corrected": 1.974,
   "totalRise": 160.0,
   "r245": 8.4739,
   "a245": 0.03722,
   "proj": {
    "ssp126": [
     569,
     336,
     802
    ],
    "ssp245": [
     751,
     450,
     1053
    ],
    "ssp585": [
     1083,
     657,
     1510
    ]
   }
  },
  {
   "id": "8658120",
   "name": "Wilmington",
   "loc": "Wilmington, NC",
   "lat": 34.2275,
   "lon": -77.9533,
   "region": "North Atlantic",
   "start": 1935,
   "subs": 2.0,
   "rate": 2.773,
   "stderr": 0.107,
   "theilsen": 2.798,
   "accel": 0.066818,
   "early": 1.1,
   "late": 3.599,
   "corrected": 0.773,
   "totalRise": 212.0,
   "r245": 9.3707,
   "a245": 0.04693,
   "proj": {
    "ssp126": [
     665,
     404,
     927
    ],
    "ssp245": [
     848,
     518,
     1178
    ],
    "ssp585": [
     1180,
     725,
     1634
    ]
   }
  },
  {
   "id": "8724580",
   "name": "Key West",
   "loc": "Key West, FL",
   "lat": 24.5511,
   "lon": -81.8081,
   "region": "Gulf of Mexico",
   "start": 1913,
   "subs": 0.8,
   "rate": 2.647,
   "stderr": 0.069,
   "theilsen": 2.609,
   "accel": 0.027012,
   "early": 2.207,
   "late": 3.664,
   "corrected": 1.847,
   "totalRise": 351.0,
   "r245": 9.4041,
   "a245": 0.02957,
   "proj": {
    "ssp126": [
     599,
     333,
     866
    ],
    "ssp245": [
     800,
     458,
     1142
    ],
    "ssp585": [
     1165,
     686,
     1644
    ]
   }
  },
  {
   "id": "8735180",
   "name": "Dauphin Island",
   "loc": "Dauphin Island, AL",
   "lat": 30.25,
   "lon": -88.075,
   "region": "Gulf of Mexico",
   "start": 1966,
   "subs": 3.5,
   "rate": 4.513,
   "stderr": 0.227,
   "theilsen": 4.546,
   "accel": 0.158479,
   "early": null,
   "late": null,
   "corrected": 1.013,
   "totalRise": 140.0,
   "r245": 11.7427,
   "a245": 0.06979,
   "proj": {
    "ssp126": [
     912,
     551,
     1272
    ],
    "ssp245": [
     1094,
     665,
     1523
    ],
    "ssp585": [
     1426,
     872,
     1980
    ]
   }
  },
  {
   "id": "9414290",
   "name": "San Francisco",
   "loc": "San Francisco, CA",
   "lat": 37.8067,
   "lon": -122.465,
   "region": "Northeast Pacific",
   "start": 1854,
   "subs": -0.3,
   "rate": 1.506,
   "stderr": 0.031,
   "theilsen": 1.5,
   "accel": 0.013996,
   "early": 1.125,
   "late": 2.016,
   "corrected": 1.806,
   "totalRise": 221.0,
   "r245": 6.4393,
   "a245": 0.03366,
   "proj": {
    "ssp126": [
     404,
     233,
     575
    ],
    "ssp245": [
     587,
     347,
     826
    ],
    "ssp585": [
     919,
     554,
     1283
    ]
   }
  },
  {
   "id": "9410170",
   "name": "San Diego",
   "loc": "San Diego, CA",
   "lat": 32.7142,
   "lon": -117.1733,
   "region": "Northeast Pacific",
   "start": 1906,
   "subs": 0.2,
   "rate": 2.228,
   "stderr": 0.051,
   "theilsen": 2.214,
   "accel": 0.010639,
   "early": 2.056,
   "late": 2.733,
   "corrected": 2.028,
   "totalRise": 210.0,
   "r245": 7.2996,
   "a245": 0.03287,
   "proj": {
    "ssp126": [
     467,
     284,
     650
    ],
    "ssp245": [
     650,
     398,
     901
    ],
    "ssp585": [
     982,
     605,
     1358
    ]
   }
  },
  {
   "id": "9447130",
   "name": "Seattle",
   "loc": "Seattle, WA",
   "lat": 47.6062,
   "lon": -122.339,
   "region": "Northeast Pacific",
   "start": 1899,
   "subs": -0.8,
   "rate": 2.089,
   "stderr": 0.061,
   "theilsen": 2.062,
   "accel": 0.010264,
   "early": 1.88,
   "late": 2.221,
   "corrected": 2.889,
   "totalRise": 324.0,
   "r245": 6.2327,
   "a245": 0.03269,
   "proj": {
    "ssp126": [
     386,
     162,
     609
    ],
    "ssp245": [
     568,
     276,
     860
    ],
    "ssp585": [
     900,
     483,
     1317
    ]
   }
  },
  {
   "id": "1612340",
   "name": "Honolulu",
   "loc": "Honolulu, HI",
   "lat": 21.3069,
   "lon": -157.867,
   "region": "Central Pacific",
   "start": 1905,
   "subs": 0.5,
   "rate": 1.488,
   "stderr": 0.048,
   "theilsen": 1.469,
   "accel": 0.009093,
   "early": 1.5,
   "late": 2.028,
   "corrected": 0.988,
   "totalRise": 381.0,
   "r245": 8.4478,
   "a245": 0.02502,
   "proj": {
    "ssp126": [
     514,
     281,
     747
    ],
    "ssp245": [
     714,
     406,
     1023
    ],
    "ssp585": [
     1079,
     634,
     1525
    ]
   }
  }
 ],
 "cities": [
  {
   "name": "New Orleans",
   "lat": 29.95,
   "lon": -90.07,
   "region": "NA - Gulf Coast",
   "slr2100": 1.07,
   "floodFrac": 100.0,
   "popRisk": 0.4,
   "risk": "EXTREME",
   "conf": "HIGH"
  },
  {
   "name": "Charleston",
   "lat": 32.78,
   "lon": -79.93,
   "region": "NA - East Coast",
   "slr2100": 0.95,
   "floodFrac": 3.0,
   "popRisk": 0.0,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Miami",
   "lat": 25.77,
   "lon": -80.19,
   "region": "NA - East Coast",
   "slr2100": 0.93,
   "floodFrac": 13.5,
   "popRisk": 0.07,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "New York City",
   "lat": 40.71,
   "lon": -74.01,
   "region": "NA - East Coast",
   "slr2100": 0.86,
   "floodFrac": 1.5,
   "popRisk": 0.12,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Boston",
   "lat": 42.36,
   "lon": -71.06,
   "region": "NA - East Coast",
   "slr2100": 0.84,
   "floodFrac": 2.0,
   "popRisk": 0.01,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Honolulu",
   "lat": 21.31,
   "lon": -157.86,
   "region": "Pacific Islands",
   "slr2100": 0.79,
   "floodFrac": 2.5,
   "popRisk": 0.01,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "San Diego",
   "lat": 32.72,
   "lon": -117.16,
   "region": "NA - West Coast",
   "slr2100": 0.74,
   "floodFrac": 1.0,
   "popRisk": 0.01,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Los Angeles",
   "lat": 34.05,
   "lon": -118.24,
   "region": "NA - West Coast",
   "slr2100": 0.72,
   "floodFrac": 0.8,
   "popRisk": 0.03,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "San Francisco",
   "lat": 37.77,
   "lon": -122.42,
   "region": "NA - West Coast",
   "slr2100": 0.67,
   "floodFrac": 1.2,
   "popRisk": 0.01,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Seattle",
   "lat": 47.61,
   "lon": -122.33,
   "region": "NA - West Coast",
   "slr2100": 0.66,
   "floodFrac": 0.8,
   "popRisk": 0.01,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "Portland",
   "lat": 45.52,
   "lon": -122.68,
   "region": "NA - West Coast",
   "slr2100": 0.65,
   "floodFrac": 0.5,
   "popRisk": 0.0,
   "risk": "MODERATE",
   "conf": "HIGH"
  },
  {
   "name": "London",
   "lat": 51.51,
   "lon": -0.13,
   "region": "Europe",
   "slr2100": 1.35,
   "floodFrac": 0.8,
   "popRisk": 0.07,
   "risk": "HIGH",
   "conf": "LOW"
  },
  {
   "name": "Amsterdam",
   "lat": 52.37,
   "lon": 4.9,
   "region": "Europe",
   "slr2100": 1.4,
   "floodFrac": 100.0,
   "popRisk": 0.9,
   "risk": "EXTREME",
   "conf": "LOW"
  },
  {
   "name": "Mumbai",
   "lat": 19.08,
   "lon": 72.88,
   "region": "Asia",
   "slr2100": 2.15,
   "floodFrac": 2.2,
   "popRisk": 0.45,
   "risk": "EXTREME",
   "conf": "LOW"
  },
  {
   "name": "Jakarta",
   "lat": -6.21,
   "lon": 106.85,
   "region": "Asia",
   "slr2100": 2.56,
   "floodFrac": 5.0,
   "popRisk": 0.53,
   "risk": "EXTREME",
   "conf": "LOW"
  },
  {
   "name": "Shanghai",
   "lat": 31.23,
   "lon": 121.47,
   "region": "Asia",
   "slr2100": 2.68,
   "floodFrac": 17.5,
   "popRisk": 4.74,
   "risk": "EXTREME",
   "conf": "LOW"
  },
  {
   "name": "Tokyo",
   "lat": 35.68,
   "lon": 139.69,
   "region": "Asia",
   "slr2100": 2.88,
   "floodFrac": 1.8,
   "popRisk": 0.67,
   "risk": "EXTREME",
   "conf": "LOW"
  },
  {
   "name": "Sydney",
   "lat": -33.87,
   "lon": 151.21,
   "region": "Oceania",
   "slr2100": 3.12,
   "floodFrac": 12.0,
   "popRisk": 0.64,
   "risk": "EXTREME",
   "conf": "LOW"
  }
 ]
};
