require('dotenv').config();

const express = require('express');
const http = require('http');
const axios = require('axios');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = Number(process.env.PORT || 8081);
const SOLAREDGE_BASE_URL = 'https://monitoringapi.solaredge.com';
const API_KEY = clean(process.env.API_KEY || process.env.SOLAREDGE_API_KEY);
const SITE_IDS = splitCsv(process.env.SITE_IDS || process.env.SITE_ID);
const SITE_NAMES = splitCsv(process.env.SITE_NAMES);
const SITE_CAPACITY_KW = splitCsv(process.env.SITE_CAPACITY_KW || process.env.SITE_CAPACITIES_KW).map(numberOrNull);
const SITE_CAPACITY_WATTS = splitCsv(process.env.SITE_CAPACITY_WATTS || process.env.SITE_CAPACITIES_WATTS).map(numberOrNull);
const PORTFOLIO_CAPACITY_WATTS = getConfiguredPortfolioCapacityWatts();
const PORTFOLIO_NAME = clean(process.env.PORTFOLIO_NAME || process.env.SITE_NAME) || 'Solar Portfolio';
const CITY = clean(process.env.CITY || process.env.WEATHER_CITY);
const WEATHER_KEY = clean(process.env.WEATHER_KEY || process.env.OPENWEATHER_API_KEY);
const REFRESH_MS = Number(process.env.REFRESH_MS || 60000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

const lastDetailsBySiteId = new Map();
let lastDetailsRefreshAt = 0;
const DETAILS_REFRESH_MS = 6 * 60 * 60 * 1000;

let lastPayload = {
  solar: getEmptySolar(),
  weather: null,
  errors: {
    solar: 'Waiting for first SolarEdge update'
  }
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitCsv(value) {
  return clean(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumNumbers(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) : null;
}

function parseDateTime(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function normalizeCapacityToWatts(value, unitHint) {
  const number = numberOrNull(value);
  if (number === null || number <= 0) return null;
  if (unitHint === 'kw') return number * 1000;
  if (unitHint === 'mw') return number * 1000000;
  return number;
}

function getConfiguredPortfolioCapacityWatts() {
  const wattValue = clean(
    process.env.PORTFOLIO_CAPACITY_WATTS ||
      process.env.SYSTEM_CAPACITY_WATTS ||
      process.env.TOTAL_SITE_CAPACITY_WATTS
  );
  const kwValue = clean(
    process.env.PORTFOLIO_CAPACITY_KW ||
      process.env.SYSTEM_CAPACITY_KW ||
      process.env.TOTAL_SITE_CAPACITY_KW
  );

  return normalizeCapacityToWatts(wattValue, 'watts') || normalizeCapacityToWatts(kwValue, 'kw');
}

function getConfiguredSiteCapacityWatts(index) {
  const watts = normalizeCapacityToWatts(SITE_CAPACITY_WATTS[index], 'watts');
  if (watts) return watts;

  return normalizeCapacityToWatts(SITE_CAPACITY_KW[index], 'kw');
}

function getDetailsCapacityWatts(siteId) {
  const details = lastDetailsBySiteId.get(String(siteId));
  if (!details) return null;

  const wattCandidates = [
    details.systemCapacityWatts,
    details.totalSiteCapacityWatts
  ];

  for (const candidate of wattCandidates) {
    const watts = normalizeCapacityToWatts(candidate, 'watts');
    if (watts) return watts;
  }

  const kwCandidates = [
    details.systemCapacityKw,
    details.totalSiteCapacityKw,
    details.systemCapacity,
    details.systemSize,
    details.peakPower,
    details.nameplateCapacity
  ];

  for (const candidate of kwCandidates) {
    const watts = normalizeCapacityToWatts(candidate, 'kw');
    if (watts) return watts;
  }

  return null;
}

function getSiteCapacityWatts(siteId, index) {
  return getConfiguredSiteCapacityWatts(index) || getDetailsCapacityWatts(siteId);
}

function getPortfolioCapacityWatts() {
  if (PORTFOLIO_CAPACITY_WATTS) return PORTFOLIO_CAPACITY_WATTS;

  const siteCapacities = SITE_IDS
    .map((siteId, index) => getSiteCapacityWatts(siteId, index))
    .filter((value) => Number.isFinite(value));

  return siteCapacities.length ? sumNumbers(siteCapacities) : null;
}

function getErrorMessage(error) {
  if (error && error.response && error.response.data) {
    if (typeof error.response.data === 'string') return error.response.data;
    try {
      return JSON.stringify(error.response.data);
    } catch (_err) {
      return error.message || String(error);
    }
  }
  return error && error.message ? error.message : String(error);
}

function getConfiguredSiteName(siteId, index) {
  return SITE_NAMES[index] || null;
}

function getFallbackSiteName(index) {
  return `Production Site ${index + 1}`;
}

function getBestSiteName(siteId, index) {
  const configured = getConfiguredSiteName(siteId, index);
  if (configured) return configured;

  const details = lastDetailsBySiteId.get(String(siteId));
  const detailName = clean(details && details.name);
  if (detailName) return detailName;

  const publicName = clean(details && details.publicSettings && details.publicSettings.name);
  if (publicName) return publicName;

  return getFallbackSiteName(index);
}

function getPortfolioIdentity() {
  return {
    siteId: null,
    siteName: PORTFOLIO_NAME,
    siteCount: SITE_IDS.length,
    systemCapacityWatts: getPortfolioCapacityWatts(),
    source: 'solaredge-multi-site',
    sites: SITE_IDS.map((siteId, index) => ({
      siteId,
      siteName: getBestSiteName(siteId, index),
      systemCapacityWatts: getSiteCapacityWatts(siteId, index)
    }))
  };
}

function getEmptySolar() {
  return {
    ...getPortfolioIdentity(),
    healthySiteCount: 0,
    overview: {
      lastUpdateTime: null,
      currentPower: { power: null },
      lastDayData: { energy: null },
      lastMonthData: { energy: null },
      lastYearData: { energy: null },
      lifeTimeData: { energy: null }
    },
    sites: SITE_IDS.map((siteId, index) => ({
      siteId,
      siteName: getBestSiteName(siteId, index),
      systemCapacityWatts: getSiteCapacityWatts(siteId, index),
      overview: null,
      online: false,
      error: 'Waiting for data'
    }))
  };
}

function buildAggregateOverview(overviews) {
  const latest = overviews
    .map((overview) => overview && overview.lastUpdateTime)
    .filter(Boolean)
    .map((value) => ({ raw: value, time: parseDateTime(value) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time)[0];

  return {
    lastUpdateTime: latest ? latest.raw : null,
    currentPower: {
      power: sumNumbers(overviews.map((overview) => overview && overview.currentPower && overview.currentPower.power))
    },
    lastDayData: {
      energy: sumNumbers(overviews.map((overview) => overview && overview.lastDayData && overview.lastDayData.energy))
    },
    lastMonthData: {
      energy: sumNumbers(overviews.map((overview) => overview && overview.lastMonthData && overview.lastMonthData.energy))
    },
    lastYearData: {
      energy: sumNumbers(overviews.map((overview) => overview && overview.lastYearData && overview.lastYearData.energy))
    },
    lifeTimeData: {
      energy: sumNumbers(overviews.map((overview) => overview && overview.lifeTimeData && overview.lifeTimeData.energy))
    }
  };
}

async function fetchSiteOverview(siteId) {
  const response = await axios.get(`${SOLAREDGE_BASE_URL}/site/${siteId}/overview.json`, {
    params: { api_key: API_KEY },
    timeout: REQUEST_TIMEOUT_MS
  });

  const overview = response.data && response.data.overview;
  if (!overview) {
    throw new Error(`No overview object returned for site ${siteId}`);
  }
  return overview;
}

async function fetchSiteDetails(siteId) {
  const response = await axios.get(`${SOLAREDGE_BASE_URL}/site/${siteId}/details.json`, {
    params: { api_key: API_KEY },
    timeout: REQUEST_TIMEOUT_MS
  });

  return response.data && response.data.details ? response.data.details : null;
}

async function refreshSiteDetailsIfNeeded() {
  if (!API_KEY || !SITE_IDS.length) return;
  const shouldRefresh = Date.now() - lastDetailsRefreshAt > DETAILS_REFRESH_MS || !lastDetailsBySiteId.size;
  if (!shouldRefresh) return;

  for (let index = 0; index < SITE_IDS.length; index += 1) {
    const siteId = SITE_IDS[index];
    try {
      const details = await fetchSiteDetails(siteId);
      if (details) {
        lastDetailsBySiteId.set(String(siteId), details);
      }
    } catch (error) {
      console.warn(`[details] ${siteId}: ${getErrorMessage(error)}`);
    }
  }

  lastDetailsRefreshAt = Date.now();
}

async function fetchWeather() {
  if (!CITY || !WEATHER_KEY) return null;
  const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: {
      q: CITY,
      appid: WEATHER_KEY,
      units: 'imperial'
    },
    timeout: REQUEST_TIMEOUT_MS
  });
  return response.data || null;
}

async function fetchSolar() {
  if (!API_KEY) {
    throw new Error('Missing API_KEY or SOLAREDGE_API_KEY in .env');
  }

  if (!SITE_IDS.length) {
    throw new Error('Missing SITE_IDS or SITE_ID in .env');
  }

  await refreshSiteDetailsIfNeeded();

  const sites = [];
  for (let index = 0; index < SITE_IDS.length; index += 1) {
    const siteId = SITE_IDS[index];
    try {
      const overview = await fetchSiteOverview(siteId);
      sites.push({
        siteId,
        siteName: getBestSiteName(siteId, index),
        systemCapacityWatts: getSiteCapacityWatts(siteId, index),
        overview,
        online: true,
        error: null
      });
    } catch (error) {
      sites.push({
        siteId,
        siteName: getBestSiteName(siteId, index),
        systemCapacityWatts: getSiteCapacityWatts(siteId, index),
        overview: null,
        online: false,
        error: getErrorMessage(error)
      });
    }
  }

  const validOverviews = sites.map((site) => site.overview).filter(Boolean);
  if (!validOverviews.length) {
    throw new Error(sites.map((site) => `${site.siteId}: ${site.error}`).join(' | '));
  }

  return {
    ...getPortfolioIdentity(),
    healthySiteCount: validOverviews.length,
    overview: buildAggregateOverview(validOverviews),
    sites
  };
}

async function refreshData() {
  const errors = {};
  let solar = lastPayload.solar || getEmptySolar();
  let weather = lastPayload.weather || null;

  const [solarResult, weatherResult] = await Promise.allSettled([fetchSolar(), fetchWeather()]);

  if (solarResult.status === 'fulfilled') {
    solar = solarResult.value;
  } else {
    errors.solar = getErrorMessage(solarResult.reason) || 'Solar feed delayed';
    solar = {
      ...getEmptySolar(),
      ...solar,
      systemCapacityWatts: getPortfolioCapacityWatts() || solar.systemCapacityWatts || null,
      sites: getEmptySolar().sites.map((emptySite, index) => {
        const existing = solar && solar.sites && solar.sites[index] ? solar.sites[index] : {};
        return {
          ...emptySite,
          ...existing,
          siteName: getBestSiteName(emptySite.siteId, index),
          systemCapacityWatts: getSiteCapacityWatts(emptySite.siteId, index) || existing.systemCapacityWatts || null
        };
      })
    };
  }

  if (weatherResult.status === 'fulfilled') {
    weather = weatherResult.value;
  } else if (CITY && WEATHER_KEY) {
    errors.weather = getErrorMessage(weatherResult.reason) || 'Weather feed delayed';
  }

  lastPayload = { solar, weather, errors };
  io.emit('data', lastPayload);
}

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: 'portfolio',
    port: PORT,
    hasApiKey: Boolean(API_KEY),
    siteCount: SITE_IDS.length,
    systemCapacityWatts: getPortfolioCapacityWatts(),
    weatherEnabled: Boolean(CITY && WEATHER_KEY),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/config', (req, res) => {
  res.json({
    ...getPortfolioIdentity(),
    weatherEnabled: Boolean(CITY && WEATHER_KEY),
    city: CITY || null,
    installedBy: 'Arch Solar C&I'
  });
});

app.get('/api/solar', async (req, res) => {
  try {
    const solar = await fetchSolar();
    res.json({ ok: true, solar });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: getErrorMessage(error),
      status: error.response && error.response.status,
      response: error.response && error.response.data
    });
  }
});

app.get('/debug', (req, res) => {
  res.json({
    ok: !Object.keys(lastPayload.errors || {}).length,
    generatedAt: new Date().toISOString(),
    config: {
      port: PORT,
      siteIds: SITE_IDS,
      siteNames: SITE_NAMES,
      siteCapacityKw: SITE_CAPACITY_KW,
      siteCapacityWatts: SITE_CAPACITY_WATTS,
      portfolioCapacityWatts: getPortfolioCapacityWatts(),
      portfolioName: PORTFOLIO_NAME,
      city: CITY,
      weatherEnabled: Boolean(CITY && WEATHER_KEY)
    },
    payload: lastPayload
  });
});

io.on('connection', (socket) => {
  socket.emit('data', lastPayload);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SolarEdge portfolio kiosk listening on port ${PORT}`);
  console.log(`Portfolio: ${PORTFOLIO_NAME}`);
  console.log(`Configured SolarEdge sites: ${SITE_IDS.join(', ') || 'none'}`);
  if (SITE_NAMES.length) {
    console.log(`Configured site names: ${SITE_NAMES.join(', ')}`);
  }
  const capacityWatts = getPortfolioCapacityWatts();
  if (capacityWatts) {
    console.log(`Configured total site capacity: ${(capacityWatts / 1000).toFixed(1)} kW`);
  }
  if (CITY && WEATHER_KEY) {
    console.log(`Weather enabled for ${CITY}`);
  } else {
    console.log('Weather disabled');
  }
  refreshData();
  setInterval(refreshData, REFRESH_MS);
});
