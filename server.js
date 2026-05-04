require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 8081;
const SOLAREDGE_BASE_URL = 'https://monitoringapi.solaredge.com';
const DEFAULT_API_KEY = clean(process.env.SOLAREDGE_API_KEY || process.env.API_KEY);
const WEATHER_KEY = clean(process.env.WEATHER_KEY);
const CITY = clean(process.env.CITY);
const PORTFOLIO_NAME = clean(
  process.env.PORTFOLIO_NAME ||
  process.env.SITE_NAME ||
  process.env.KIOSK_SITE_NAME ||
  process.env.DISPLAY_SITE_NAME
) || 'Solar Portfolio';
const REFRESH_MS = parsePositiveInteger(process.env.REFRESH_MS) || 60000;
const DETAILS_REFRESH_MS = parsePositiveInteger(process.env.DETAILS_REFRESH_MS) || 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = parsePositiveInteger(process.env.REQUEST_TIMEOUT_MS) || 10000;
const MAX_BULK_SITE_IDS = 100;

let configuredSites = parseSitesFromEnv();
let lastSolar = null;
let lastWeather = null;
let lastDetailsRefreshAt = 0;
const lastDetailsBySiteId = new Map();

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitCsv(value) {
  return clean(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeCapacityToWatts(value) {
  const number = parsePositiveNumber(value);
  if (!number) return null;
  return number < 1000 ? number * 1000 : number;
}

function sumNumbers(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) : null;
}

function getErrorMessage(error) {
  if (error?.response?.data) {
    return typeof error.response.data === 'string'
      ? error.response.data
      : JSON.stringify(error.response.data);
  }
  return error?.message || String(error);
}

function parseSitesFromEnv() {
  const jsonConfig = clean(process.env.SOLAREDGE_SITES);
  if (jsonConfig) {
    let parsed;
    try {
      parsed = JSON.parse(jsonConfig);
    } catch (error) {
      throw new Error(`SOLAREDGE_SITES is not valid JSON: ${error.message}`);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('SOLAREDGE_SITES must be a non-empty JSON array.');
    }

    return parsed.map((site, index) => normalizeSiteConfig(site, index));
  }

  const ids = splitCsv(process.env.SITE_IDS || process.env.SITE_ID);
  const names = splitCsv(process.env.SITE_NAMES);
  const capacityWatts = splitCsv(process.env.SITE_CAPACITY_WATTS || process.env.SYSTEM_CAPACITY_WATTS);
  const capacityKw = splitCsv(process.env.SITE_CAPACITY_KW || process.env.SYSTEM_CAPACITY_KW);

  return ids.map((id, index) => normalizeSiteConfig({
    id,
    name: names[index],
    apiKey: DEFAULT_API_KEY,
    capacityWatts: capacityWatts[index],
    capacityKw: capacityKw[index]
  }, index));
}

function normalizeSiteConfig(site, index) {
  const id = clean(String(site.id || site.siteId || ''));
  const apiKey = clean(site.apiKey || site.api_key || site.key || DEFAULT_API_KEY);
  const name = clean(site.name || site.siteName || '');
  const capacityWatts = normalizeCapacityToWatts(site.capacityWatts)
    || normalizeCapacityToWatts(site.systemCapacityWatts)
    || normalizeCapacityToWatts(site.capacityKw)
    || normalizeCapacityToWatts(site.systemCapacityKw);

  if (!id) throw new Error(`SolarEdge site at index ${index} is missing id/siteId.`);
  if (!apiKey) throw new Error(`SolarEdge site ${id} is missing apiKey and no API_KEY/SOLAREDGE_API_KEY fallback is set.`);

  return { id, apiKey, name, capacityWatts };
}

function requireSolarConfig() {
  if (!configuredSites.length) {
    throw new Error('Missing SolarEdge site config. Set SITE_IDS or SOLAREDGE_SITES.');
  }
}

function groupSitesByApiKey(sites) {
  const groups = new Map();
  for (const site of sites) {
    if (!groups.has(site.apiKey)) groups.set(site.apiKey, []);
    groups.get(site.apiKey).push(site);
  }
  return [...groups.entries()].map(([apiKey, groupSites]) => ({ apiKey, sites: groupSites }));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchOverviewGroup(apiKey, sites) {
  const ids = sites.map((site) => site.id);
  const path = ids.length === 1
    ? `/site/${ids[0]}/overview.json`
    : `/sites/${ids.join(',')}/overview.json`;

  const response = await axios.get(`${SOLAREDGE_BASE_URL}${path}`, {
    params: { api_key: apiKey },
    timeout: REQUEST_TIMEOUT_MS
  });

  const overview = response.data?.overview;
  if (!overview) return [];

  if (ids.length === 1) {
    return [{ id: ids[0], overview }];
  }

  return (overview.list || []).map((entry) => ({
    id: String(entry.id),
    overview: entry
  }));
}

async function fetchSiteDetails(site) {
  const response = await axios.get(`${SOLAREDGE_BASE_URL}/site/${site.id}/details.json`, {
    params: { api_key: site.apiKey },
    timeout: REQUEST_TIMEOUT_MS
  });
  return response.data?.details || null;
}

async function refreshSiteDetailsIfNeeded() {
  const shouldRefresh = Date.now() - lastDetailsRefreshAt > DETAILS_REFRESH_MS;
  if (!shouldRefresh && lastDetailsBySiteId.size) return;

  for (const site of configuredSites) {
    try {
      const details = await fetchSiteDetails(site);
      if (details) lastDetailsBySiteId.set(site.id, details);
    } catch (error) {
      console.warn(`SolarEdge details fetch failed for site ${site.id}:`, getErrorMessage(error));
    }
  }

  lastDetailsRefreshAt = Date.now();
}

function getBestSiteName(site, details) {
  return clean(site.name)
    || clean(details?.name)
    || clean(details?.publicSettings?.name)
    || clean(details?.location?.address)
    || clean(details?.location?.city)
    || `SolarEdge Site ${site.id}`;
}

function getSiteCapacityWatts(site, details) {
  return normalizeCapacityToWatts(site.capacityWatts)
    || normalizeCapacityToWatts(details?.peakPower)
    || normalizeCapacityToWatts(details?.nameplateCapacity)
    || normalizeCapacityToWatts(details?.dcCapacity)
    || null;
}

function getPortfolioIdentity() {
  const siteSummaries = configuredSites.map((site) => {
    const details = lastDetailsBySiteId.get(site.id);
    return {
      siteId: site.id,
      siteName: getBestSiteName(site, details),
      systemCapacityWatts: getSiteCapacityWatts(site, details)
    };
  });

  const capacity = sumNumbers(siteSummaries.map((site) => site.systemCapacityWatts))
    || normalizeCapacityToWatts(process.env.PORTFOLIO_CAPACITY_WATTS)
    || normalizeCapacityToWatts(process.env.PORTFOLIO_CAPACITY_KW)
    || null;

  return {
    siteId: null,
    siteName: PORTFOLIO_NAME,
    siteCount: configuredSites.length,
    city: CITY || null,
    systemCapacityWatts: capacity,
    sites: siteSummaries,
    source: 'solaredge-multi-site'
  };
}

function pickLatestUpdateTime(overviews) {
  const dated = overviews
    .map((overview) => overview?.lastUpdateTime)
    .filter(Boolean)
    .map((value) => ({
      raw: value,
      time: Date.parse(String(value).replace(' ', 'T'))
    }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);

  return dated[0]?.raw || overviews.find((overview) => overview?.lastUpdateTime)?.lastUpdateTime || null;
}

function buildAggregateOverview(overviews) {
  return {
    lastUpdateTime: pickLatestUpdateTime(overviews),
    currentPower: {
      power: sumNumbers(overviews.map((overview) => overview?.currentPower?.power))
    },
    lastDayData: {
      energy: sumNumbers(overviews.map((overview) => overview?.lastDayData?.energy))
    },
    lastMonthData: {
      energy: sumNumbers(overviews.map((overview) => overview?.lastMonthData?.energy))
    },
    lastYearData: {
      energy: sumNumbers(overviews.map((overview) => overview?.lastYearData?.energy))
    },
    lifeTimeData: {
      energy: sumNumbers(overviews.map((overview) => overview?.lifeTimeData?.energy))
    }
  };
}

async function fetchSolar() {
  requireSolarConfig();
  await refreshSiteDetailsIfNeeded();

  const overviewBySiteId = new Map();
  const groupErrors = [];
  const requests = [];

  for (const group of groupSitesByApiKey(configuredSites)) {
    for (const chunk of chunkArray(group.sites, MAX_BULK_SITE_IDS)) {
      requests.push(
        fetchOverviewGroup(group.apiKey, chunk)
          .then((entries) => ({ status: 'fulfilled', entries }))
          .catch((error) => ({ status: 'rejected', error, sites: chunk }))
      );
    }
  }

  const results = await Promise.all(requests);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const entry of result.entries) {
        overviewBySiteId.set(String(entry.id), entry.overview);
      }
    } else {
      groupErrors.push(`${result.sites.map((site) => site.id).join(', ')}: ${getErrorMessage(result.error)}`);
    }
  }

  const sites = configuredSites.map((site) => {
    const details = lastDetailsBySiteId.get(site.id);
    const overview = overviewBySiteId.get(site.id) || null;
    return {
      siteId: site.id,
      siteName: getBestSiteName(site, details),
      systemCapacityWatts: getSiteCapacityWatts(site, details),
      overview,
      details,
      online: Boolean(overview),
      error: overview ? null : 'No overview data returned for this site.'
    };
  });

  const validOverviews = sites.map((site) => site.overview).filter(Boolean);
  if (!validOverviews.length) {
    throw new Error(groupErrors.length ? groupErrors.join(' | ') : 'No SolarEdge overview data returned.');
  }

  const identity = getPortfolioIdentity();
  const aggregateCapacity = sumNumbers(sites.map((site) => site.systemCapacityWatts)) || identity.systemCapacityWatts;
  const aggregateOverview = buildAggregateOverview(validOverviews);

  return {
    ...identity,
    systemCapacityWatts: aggregateCapacity,
    healthySiteCount: validOverviews.length,
    overview: aggregateOverview,
    sites,
    errors: groupErrors
  };
}

async function fetchWeather() {
  if (!WEATHER_KEY || !CITY) return null;
  const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: { q: CITY, appid: WEATHER_KEY, units: 'imperial' },
    timeout: REQUEST_TIMEOUT_MS
  });
  return response.data;
}

app.get('/config', (req, res) => {
  res.json(getPortfolioIdentity());
});

async function broadcastData() {
  const errors = {};
  let solar = lastSolar || getPortfolioIdentity();
  let weather = lastWeather;

  const [solarResult, weatherResult] = await Promise.allSettled([fetchSolar(), fetchWeather()]);

  if (solarResult.status === 'fulfilled') {
    solar = solarResult.value;
    lastSolar = solar;
    if (solar.errors?.length) {
      errors.solar = `${solar.errors.length} SolarEdge site group issue${solar.errors.length === 1 ? '' : 's'}`;
    }
  } else {
    errors.solar = solarResult.reason?.message || 'Solar feed delayed';
    solar = { ...(lastSolar || {}), ...getPortfolioIdentity() };
  }

  if (weatherResult.status === 'fulfilled') {
    weather = weatherResult.value;
    lastWeather = weather;
  } else {
    errors.weather = weatherResult.reason?.message || 'Weather feed delayed';
  }

  io.emit('data', { solar, weather, errors });
}

io.on('connection', (socket) => {
  socket.emit('data', {
    solar: lastSolar || getPortfolioIdentity(),
    weather: lastWeather,
    errors: {}
  });
});

broadcastData();
setInterval(broadcastData, REFRESH_MS);

server.listen(PORT, () => {
  console.log(`SolarEdge multi-site kiosk listening on port ${PORT}`);
  console.log(`Portfolio: ${PORTFOLIO_NAME}`);
  console.log(`Configured SolarEdge sites: ${configuredSites.map((site) => site.id).join(', ') || 'none'}`);
});
