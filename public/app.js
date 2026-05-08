(function () {
  const kioskConfig = window.KIOSK_CONFIG || {};
  const els = {
    siteName: document.getElementById('siteName'),
    archLogo: document.getElementById('archLogo'),
    statusPill: document.getElementById('statusPill'),
    lastUpdate: document.getElementById('lastUpdate'),
    heroValue: document.getElementById('heroValue'),
    heroEyebrow: document.getElementById('heroEyebrow'),
    siteHeroImage: document.getElementById('siteHeroImage'),
    powerMark: document.getElementById('powerMark'),
    siteCount: document.getElementById('siteCount'),
    healthySiteCount: document.getElementById('healthySiteCount'),
    totalSiteCapacity: document.getElementById('totalSiteCapacity'),
    energyToday: document.getElementById('energyToday'),
    energyMonth: document.getElementById('energyMonth'),
    energyYear: document.getElementById('energyYear'),
    energyLifetime: document.getElementById('energyLifetime'),
    milesDriven: document.getElementById('milesDriven'),
    devicesCharged: document.getElementById('devicesCharged'),
    treesPlanted: document.getElementById('treesPlanted'),
    siteList: document.getElementById('siteList'),
    weatherCard: document.getElementById('weatherCard'),
    weatherTemp: document.getElementById('weatherTemp'),
    weatherDesc: document.getElementById('weatherDesc'),
    weatherMeta: document.getElementById('weatherMeta')
  };

  const state = {
    config: null,
    payload: null,
    connected: false,
    activeSiteIndex: 0
  };
  let siteCycleHandle = null;

  if (els.archLogo && kioskConfig.brandLogoSrc) {
    els.archLogo.src = kioskConfig.brandLogoSrc;
  }

  function isSafeCssValue(value) {
    return typeof value === 'string' && value.trim() && !/[;{}]/.test(value);
  }

  function setCssVar(name, value) {
    if (!isSafeCssValue(value)) return;
    document.documentElement.style.setProperty(name, value.trim());
  }

  function applySunIconConfig() {
    const sun = kioskConfig.sunIcon || {};
    const legacy = kioskConfig.heroSun || {};
    const settings = { ...legacy, ...sun };

    setCssVar('--sky-top', settings.skyColorTop);
    setCssVar('--sky-bottom', settings.skyColorBottom);
    setCssVar('--sky-arc', settings.arcColor);
    setCssVar('--sun-primary', settings.sunColor || settings.primaryColor);
    setCssVar('--sun-edge', settings.sunEdgeColor || settings.edgeColor);
    setCssVar('--sun-glow', settings.sunGlowColor || settings.glowColor);
    setCssVar('--building-body', settings.buildingColor);
    setCssVar('--building-shadow', settings.buildingShadowColor);
    setCssVar('--building-window', settings.buildingWindowColor);
    setCssVar('--ground-color', settings.groundColor);

    const size = Number(settings.sizePx || settings.size);
    if (Number.isFinite(size) && size >= 64 && size <= 260) {
      document.documentElement.style.setProperty('--sun-size', `${Math.round(size)}px`);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function degToRad(value) {
    return value * (Math.PI / 180);
  }

  function radToDeg(value) {
    return value * (180 / Math.PI);
  }

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function getSolarPosition(date, latitude, longitude) {
    const julianDate = (date.getTime() / 86400000) + 2440587.5;
    const n = julianDate - 2451545.0;
    const meanLongitude = normalizeDegrees(280.46 + (0.9856474 * n));
    const meanAnomaly = normalizeDegrees(357.528 + (0.9856003 * n));
    const eclipticLongitude = meanLongitude + (1.915 * Math.sin(degToRad(meanAnomaly))) + (0.02 * Math.sin(2 * degToRad(meanAnomaly)));
    const obliquity = 23.439 - (0.0000004 * n);

    const rightAscension = Math.atan2(
      Math.cos(degToRad(obliquity)) * Math.sin(degToRad(eclipticLongitude)),
      Math.cos(degToRad(eclipticLongitude))
    );
    const declination = Math.asin(
      Math.sin(degToRad(obliquity)) * Math.sin(degToRad(eclipticLongitude))
    );

    const utcHours =
      date.getUTCHours() +
      (date.getUTCMinutes() / 60) +
      (date.getUTCSeconds() / 3600) +
      (date.getUTCMilliseconds() / 3600000);

    const gmst = normalizeDegrees((6.697375 + (0.0657098242 * n) + utcHours) * 15);
    const localSiderealTime = normalizeDegrees(gmst + longitude);
    const hourAngle = normalizeDegrees(localSiderealTime - radToDeg(rightAscension));
    const hourAngleRad = degToRad(hourAngle > 180 ? hourAngle - 360 : hourAngle);
    const latitudeRad = degToRad(latitude);

    const altitude = Math.asin(
      (Math.sin(declination) * Math.sin(latitudeRad)) +
      (Math.cos(declination) * Math.cos(latitudeRad) * Math.cos(hourAngleRad))
    );

    const azimuth = Math.atan2(
      -Math.sin(hourAngleRad),
      (Math.tan(declination) * Math.cos(latitudeRad)) - (Math.sin(latitudeRad) * Math.cos(hourAngleRad))
    );

    return {
      altitude: radToDeg(altitude),
      azimuth: normalizeDegrees(radToDeg(azimuth) + 180)
    };
  }

  function renderSolarTracker() {
    if (!els.powerMark) return;

    const settings = { ...(kioskConfig.heroSun || {}), ...(kioskConfig.sunIcon || {}) };
    const latitude = Number.isFinite(Number(settings.latitude)) ? Number(settings.latitude) : 43.0389;
    const longitude = Number.isFinite(Number(settings.longitude)) ? Number(settings.longitude) : -87.9065;
    const position = getSolarPosition(new Date(), latitude, longitude);
    const progress = clamp((position.azimuth - 90) / 180, 0, 1);
    const clampedAltitude = clamp(position.altitude, -8, 72);
    const x = 12 + (76 * progress);
    const y = 74 - (((clampedAltitude + 8) / 80) * 50);
    const isNight = position.altitude <= -1;

    document.documentElement.style.setProperty('--sun-x', `${x}%`);
    document.documentElement.style.setProperty('--sun-y', `${y}%`);
    document.documentElement.style.setProperty('--sun-opacity', isNight ? '0.18' : '1');
    document.documentElement.style.setProperty('--sun-scale', isNight ? '0.84' : '1');
    els.powerMark.classList.toggle('night', isNight);
  }

  applySunIconConfig();
  renderSolarTracker();
  window.setInterval(renderSolarTracker, 60000);

  function setStatus(text, mode) {
    if (!els.statusPill) return;
    els.statusPill.textContent = text;
    els.statusPill.classList.remove('online', 'offline', 'warning');
    els.statusPill.classList.add(mode || 'warning');
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function compactNumber(value) {
    if (!Number.isFinite(value)) return '--';
    return new Intl.NumberFormat(undefined, {
      notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0
    }).format(value);
  }

  function formatPower(watts) {
    const value = numberOrNull(watts);
    if (value === null) return '--';
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)} MW`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)} kW`;
    return `${Math.round(value)} W`;
  }

  function formatEnergy(wh) {
    const value = numberOrNull(wh);
    if (value === null) return '--';
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)} MWh`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)} kWh`;
    return `${Math.round(value)} Wh`;
  }

  function formatLastUpdate(value) {
    if (!value) return 'Last update --';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return `Last update ${value}`;
    return `Last update ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function titleCase(text) {
    return String(text || '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  function normalizeCapacityToWatts(value, unitHint) {
    const number = numberOrNull(value);
    if (number === null || number <= 0) return null;
    if (unitHint === 'kw') return number * 1000;
    if (unitHint === 'mw') return number * 1000000;
    return number;
  }

  function sumSiteCapacities(sites) {
    if (!Array.isArray(sites) || !sites.length) return null;
    const values = sites
      .map((site) => normalizeCapacityToWatts(site && (site.systemCapacityWatts || site.totalSiteCapacityWatts), 'watts'))
      .filter((value) => Number.isFinite(value));
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  }

  function getTotalCapacityWatts(solar, config) {
    const directCandidates = [
      solar && solar.systemCapacityWatts,
      solar && solar.totalSiteCapacityWatts,
      config && config.systemCapacityWatts,
      config && config.totalSiteCapacityWatts,
      kioskConfig.systemCapacityWatts
    ];

    for (const candidate of directCandidates) {
      const watts = normalizeCapacityToWatts(candidate, 'watts');
      if (watts) return watts;
    }

    const kwCandidates = [
      solar && solar.systemCapacityKw,
      solar && solar.totalSiteCapacityKw,
      config && config.systemCapacityKw,
      config && config.totalSiteCapacityKw,
      kioskConfig.systemCapacityKw
    ];

    for (const candidate of kwCandidates) {
      const watts = normalizeCapacityToWatts(candidate, 'kw');
      if (watts) return watts;
    }

    return sumSiteCapacities(solar && solar.sites) || sumSiteCapacities(config && config.sites);
  }

  function renderWeather(weather, config) {
    const enabled = Boolean(config && config.weatherEnabled);
    if (!enabled) {
      els.weatherCard.classList.add('hidden');
      return;
    }

    els.weatherCard.classList.remove('hidden');
    if (!weather || !weather.main) {
      els.weatherTemp.textContent = '--';
      els.weatherDesc.textContent = 'Weather unavailable';
      els.weatherMeta.textContent = config && config.city ? config.city : '--';
      return;
    }

    els.weatherTemp.textContent = `${Math.round(weather.main.temp)}°F`;
    els.weatherDesc.textContent = titleCase(weather.weather && weather.weather[0] && weather.weather[0].description || '');
    const city = weather.name || (config && config.city) || '--';
    const humidity = Number.isFinite(weather.main.humidity) ? `${weather.main.humidity}% humidity` : '';
    const wind = weather.wind && Number.isFinite(weather.wind.speed) ? `${Math.round(weather.wind.speed)} mph wind` : '';
    els.weatherMeta.textContent = [city, humidity, wind].filter(Boolean).join(' • ');
  }

  function renderImpact(lifetimeWh) {
    const wh = numberOrNull(lifetimeWh);
    if (wh === null) {
      els.milesDriven.textContent = '--';
      els.devicesCharged.textContent = '--';
      els.treesPlanted.textContent = '--';
      return;
    }

    const kwh = wh / 1000;
    const co2LbsAvoided = kwh * 0.855;
    const milesAvoided = co2LbsAvoided / 0.888;
    const devicesCharged = kwh / 0.012;
    const treesPlanted = co2LbsAvoided / 48;

    els.milesDriven.textContent = compactNumber(Math.round(milesAvoided));
    els.devicesCharged.textContent = compactNumber(Math.round(devicesCharged));
    els.treesPlanted.textContent = compactNumber(Math.round(treesPlanted));
  }

  function createSiteRow(site, index) {
    const row = document.createElement('div');
    row.className = `site-row ${site.online ? 'online' : 'offline'}`;

    const main = document.createElement('div');
    main.className = 'site-row-main';

    const name = document.createElement('div');
    name.className = 'site-name';
    name.textContent = site.siteName || `Production Site ${index + 1}`;

    const capacityWatts = normalizeCapacityToWatts(site.systemCapacityWatts || site.totalSiteCapacityWatts, 'watts');
    const siteIsOnline = Boolean(site.online && site.overview && !site.error);
    const powerWatts = siteIsOnline
      ? numberOrNull(site.overview && site.overview.currentPower && site.overview.currentPower.power)
      : 0;
    const powerText = formatPower(powerWatts === null ? 0 : powerWatts);

    row.classList.toggle('online', siteIsOnline);
    row.classList.toggle('offline', !siteIsOnline);

    const meta = document.createElement('div');
    meta.className = 'site-meta';
    meta.textContent = capacityWatts ? `${powerText} / ${formatPower(capacityWatts)} cap.` : powerText;

    main.appendChild(name);
    main.appendChild(meta);

    const pill = document.createElement('div');
    pill.className = 'site-dot';
    pill.setAttribute('aria-label', siteIsOnline ? 'Online' : 'Offline');
    pill.setAttribute('title', siteIsOnline ? 'Online' : 'Offline');

    row.appendChild(main);
    row.appendChild(pill);

    return row;
  }

  function renderSites(solar, config) {
    const sites = mergeSites(solar, config);
    els.siteList.innerHTML = '';
    for (let index = 0; index < sites.length; index += 1) {
      els.siteList.appendChild(createSiteRow(sites[index], index));
    }
  }

  function render(payload) {
    state.payload = payload || {};
    const config = state.config || {};
    const solar = payload && payload.solar ? payload.solar : {};
    const overview = solar.overview || {};
    const lifetimeWh = overview.lifeTimeData && overview.lifeTimeData.energy;
    const totalCapacityWatts = getTotalCapacityWatts(solar, config);

    const mergedSites = mergeSites(solar, config);
    const cycleItems = [null, ...mergedSites];
    const activeItem = cycleItems[state.activeSiteIndex % cycleItems.length];
    const activeSite = activeItem;
    const hasSites = mergedSites.length > 0;
    const activeOverview = activeSite && activeSite.overview ? activeSite.overview : overview;
    const displayName = activeSite ? activeSite.siteName : (solar.siteName || config.siteName || kioskConfig.siteName || 'Solar Portfolio');
    const activeCapacityWatts = activeSite
      ? normalizeCapacityToWatts(activeSite.systemCapacityWatts || activeSite.totalSiteCapacityWatts, 'watts')
      : totalCapacityWatts;

    els.siteName.textContent = displayName;
    els.heroEyebrow.textContent = activeSite
      ? `Site generation • ${state.activeSiteIndex + 1} of ${cycleItems.length}`
      : (hasSites ? 'Portfolio generation • cumulative view' : 'Portfolio generation');
    els.lastUpdate.textContent = formatLastUpdate(overview.lastUpdateTime);
    els.heroValue.textContent = formatPower(activeOverview.currentPower && activeOverview.currentPower.power);
    els.totalSiteCapacity.textContent = formatPower(activeCapacityWatts);
    els.siteCount.textContent = Number.isFinite(solar.siteCount) ? solar.siteCount : (config.siteCount || 0);
    els.healthySiteCount.textContent = Number.isFinite(solar.healthySiteCount) ? solar.healthySiteCount : 0;
    els.energyToday.textContent = formatEnergy(activeOverview.lastDayData && activeOverview.lastDayData.energy);
    els.energyMonth.textContent = formatEnergy(activeOverview.lastMonthData && activeOverview.lastMonthData.energy);
    els.energyYear.textContent = formatEnergy(activeOverview.lastYearData && activeOverview.lastYearData.energy);
    els.energyLifetime.textContent = formatEnergy(activeOverview.lifeTimeData && activeOverview.lifeTimeData.energy);

    renderImpact(activeOverview.lifeTimeData && activeOverview.lifeTimeData.energy);
    renderSites(solar, config);
    renderSiteImage(activeSite);
    renderWeather(payload && payload.weather, config);

    const errors = payload && payload.errors ? payload.errors : {};
    if (state.connected) {
      setStatus(errors.solar ? 'Solar feed delayed' : 'Live', errors.solar ? 'warning' : 'online');
    }
  }

  function mergeSites(solar, config) {
    const configSites = config && Array.isArray(config.sites) ? config.sites : [];
    const solarSites = solar && Array.isArray(solar.sites) ? solar.sites : [];
    const max = Math.max(configSites.length, solarSites.length);
    const customImages = kioskConfig.siteImages || {};

    const merged = [];
    for (let index = 0; index < max; index += 1) {
      const configSite = configSites[index] || {};
      const solarSite = solarSites[index] || {};
      const siteName = solarSite.siteName || configSite.siteName || `Production Site ${index + 1}`;
      const siteId = solarSite.siteId || configSite.siteId || null;
      merged.push({
        siteName,
        siteId,
        systemCapacityWatts: solarSite.systemCapacityWatts || configSite.systemCapacityWatts || null,
        overview: solarSite.overview || null,
        online: typeof solarSite.online === 'boolean' ? solarSite.online : Boolean(solarSite.overview),
        error: solarSite.error || null,
        imageSrc: configSite.imageSrc || customImages[String(siteId)] || customImages[siteName] || null
      });
    }
    return merged;
  }

  function renderSiteImage(activeSite) {
    if (!els.siteHeroImage) return;
    if (!activeSite || !activeSite.imageSrc) {
      els.siteHeroImage.classList.add('hidden');
      els.siteHeroImage.removeAttribute('src');
      return;
    }
    els.siteHeroImage.src = activeSite.imageSrc;
    els.siteHeroImage.alt = `${activeSite.siteName} site image`;
    els.siteHeroImage.classList.remove('hidden');
  }

  function startSiteCycle() {
    if (siteCycleHandle) window.clearInterval(siteCycleHandle);
    const cycleMs = Math.max(Number(kioskConfig.siteCycleMs) || 15000, 5000);
    siteCycleHandle = window.setInterval(function () {
      const sites = mergeSites((state.payload && state.payload.solar) || {}, state.config || {});
      if (!sites.length) return;
      state.activeSiteIndex = (state.activeSiteIndex + 1) % (sites.length + 1);
      render(state.payload || {});
    }, cycleMs);
  }

  async function loadConfig() {
    const response = await fetch('/config', { cache: 'no-store' });
    const data = await response.json();
    state.config = data;
    els.siteName.textContent = data.siteName || kioskConfig.siteName || 'Solar Portfolio';
    render({ solar: data, weather: null, errors: {} });
    startSiteCycle();
  }

  function connectSocket() {
    const socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', function () {
      state.connected = true;
      setStatus('Live', 'online');
    });

    socket.on('disconnect', function () {
      state.connected = false;
      setStatus('Offline', 'offline');
    });

    socket.on('connect_error', function () {
      state.connected = false;
      setStatus('Socket error', 'offline');
    });

    socket.on('data', function (payload) {
      render(payload);
    });
  }

  loadConfig()
    .then(connectSocket)
    .catch(function (error) {
      console.error(error);
      setStatus('Load failed', 'offline');
    });
})();
