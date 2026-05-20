(function () {
  const kioskConfig = window.KIOSK_CONFIG || {};
  const els = {
    siteName: document.getElementById('siteName'),
    slideSubtitle: document.getElementById('slideSubtitle'),
    slideEyebrow: document.getElementById('slideEyebrow'),
    archLogo: document.getElementById('archLogo'),
    statusPill: document.getElementById('statusPill'),
    lastUpdate: document.getElementById('lastUpdate'),
    heroValue: document.getElementById('heroValue'),
    heroUnit: document.getElementById('heroUnit'),
    siteCount: document.getElementById('siteCount'),
    siteCountLabel: document.getElementById('siteCountLabel'),
    healthySiteCount: document.getElementById('healthySiteCount'),
    healthySiteLabel: document.getElementById('healthySiteLabel'),
    totalSiteCapacity: document.getElementById('totalSiteCapacity'),
    capacityLabel: document.getElementById('capacityLabel'),
    slideAction: document.getElementById('slideAction'),
    productionCard: document.getElementById('productionCard'),
    productionRing: document.getElementById('productionRing'),
    productionPercent: document.getElementById('productionPercent'),
    productionActual: document.getElementById('productionActual'),
    productionCapacity: document.getElementById('productionCapacity'),
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
    weatherMeta: document.getElementById('weatherMeta'),
    sitePhotoCard: document.getElementById('sitePhotoCard'),
    sitePhotoFrame: document.getElementById('sitePhotoFrame'),
    sitePhotoImage: document.getElementById('sitePhotoImage'),
    sitePhotoPlaceholder: document.getElementById('sitePhotoPlaceholder'),
    sitePhotoCaption: document.getElementById('sitePhotoCaption')
  };

  const state = {
    config: null,
    payload: null,
    connected: false,
    slideTimer: null
  };

  function getBasePath() {
    const scripts = Array.from(document.scripts || []);
    const current = scripts.find((script) => script.src && /\/app\.js(\?|$)/.test(script.src));
    if (!current) return '';
    const url = new URL(current.src, window.location.href);
    const path = url.pathname.replace(/\/app\.js$/, '').replace(/\/$/, '');
    return path === '/' ? '' : path;
  }

  const basePath = getBasePath();
  const withBasePath = (path) => `${basePath}${path}`;

  function resolveAssetUrl(src) {
    if (!src) return '';
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
    if (src.startsWith('/')) return `${basePath}${src}`;
    return src;
  }

  if (els.archLogo && kioskConfig.brandLogoSrc) {
    els.archLogo.src = resolveAssetUrl(kioskConfig.brandLogoSrc);
  }

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

  function buildSites(solar, config) {
    const configSites = config && Array.isArray(config.sites) ? config.sites : [];
    const solarSites = solar && Array.isArray(solar.sites) ? solar.sites : [];
    const max = Math.max(configSites.length, solarSites.length);
    const sites = [];

    for (let index = 0; index < max; index += 1) {
      const configSite = configSites[index] || {};
      const solarSite = solarSites[index] || {};
      sites.push({
        ...configSite,
        ...solarSite,
        index,
        siteName: solarSite.siteName || configSite.siteName || `Production Site ${index + 1}`,
        siteId: solarSite.siteId || configSite.siteId || null,
        systemCapacityWatts: solarSite.systemCapacityWatts || configSite.systemCapacityWatts || null,
        overview: solarSite.overview || null,
        online: typeof solarSite.online === 'boolean' ? solarSite.online : Boolean(solarSite.overview),
        error: solarSite.error || null
      });
    }

    return sites;
  }

  function getSiteSlug(site, index) {
    const id = site && site.siteId ? String(site.siteId) : String(index + 1);
    return `site-${encodeURIComponent(id)}`;
  }

  function getCurrentSlide(sites) {
    const hash = decodeURIComponent((window.location.hash || '').replace(/^#/, '')).trim();
    if (!hash || hash === 'total' || hash === 'home' || hash === 'portfolio') {
      return { type: 'total', site: null, index: -1 };
    }

    const siteToken = hash.replace(/^site-/, '');
    const match = sites.find((site, index) => {
      const siteId = site.siteId ? String(site.siteId) : '';
      return hash === getSiteSlug(site, index) || siteToken === siteId || siteToken === String(index + 1);
    });

    if (!match) return { type: 'total', site: null, index: -1 };
    return { type: 'site', site: match, index: match.index };
  }


  function getCurrentSlideHash() {
    return decodeURIComponent((window.location.hash || '').replace(/^#/, '')).trim();
  }

  function getSlideSequence(sites) {
    const sequence = ['total'];
    (sites || []).forEach((site, index) => {
      sequence.push(getSiteSlug(site, index));
    });
    return sequence;
  }

  function getSlideKeyFromHash(sites) {
    const hash = getCurrentSlideHash();
    if (!hash || hash === 'home' || hash === 'portfolio') return 'total';
    const sequence = getSlideSequence(sites);
    return sequence.includes(hash) ? hash : 'total';
  }

  function getAutoplaySettings() {
    const autoplay = kioskConfig.slideAutoplay || {};
    const enabled = autoplay.enabled !== false;
    const seconds = numberOrNull(autoplay.seconds || autoplay.intervalSeconds || autoplay.delaySeconds) || 12;
    return {
      enabled,
      delayMs: Math.max(4, seconds) * 1000
    };
  }

  function advanceSlide() {
    if (document.hidden) return;
    const payload = state.payload || {};
    const config = state.config || {};
    const solar = payload && payload.solar ? payload.solar : payload;
    const sites = buildSites(solar || {}, config || {});
    const sequence = getSlideSequence(sites);
    if (sequence.length <= 1) return;

    const current = getSlideKeyFromHash(sites);
    const currentIndex = Math.max(0, sequence.indexOf(current));
    const next = sequence[(currentIndex + 1) % sequence.length];
    if (`#${next}` !== window.location.hash) {
      window.location.hash = next;
    }
  }

  function startSlideAutoplay() {
    const autoplay = getAutoplaySettings();
    if (state.slideTimer) {
      clearInterval(state.slideTimer);
      state.slideTimer = null;
    }
    if (!autoplay.enabled) return;
    state.slideTimer = setInterval(advanceSlide, autoplay.delayMs);
  }

  function renderWeather(weather, config, visible) {
    const enabled = visible && Boolean(config && config.weatherEnabled);
    if (!els.weatherCard) return;
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
    els.weatherDesc.textContent = titleCase((weather.weather && weather.weather[0] && weather.weather[0].description) || '');
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

  function getPowerWattsForSite(site) {
    const siteIsOnline = Boolean(site && site.online && site.overview && !site.error);
    if (!siteIsOnline) return 0;
    return numberOrNull(site.overview && site.overview.currentPower && site.overview.currentPower.power) || 0;
  }

  function getCapacityWattsForSite(site) {
    return normalizeCapacityToWatts(site && (site.systemCapacityWatts || site.totalSiteCapacityWatts), 'watts');
  }

  function renderProductionDisplay(actualWatts, capacityWatts) {
    const actual = numberOrNull(actualWatts) || 0;
    const capacity = numberOrNull(capacityWatts) || 0;
    const ratio = capacity > 0 ? Math.max(0, Math.min(actual / capacity, 1.25)) : 0;
    const percent = capacity > 0 ? Math.round((actual / capacity) * 100) : null;
    const ringPercent = Math.round(Math.min(ratio, 1) * 100);

    if (els.productionRing) {
      els.productionRing.style.setProperty('--production-percent', `${ringPercent}%`);
    }
    if (els.productionPercent) els.productionPercent.textContent = percent === null ? '--' : `${percent}%`;
    if (els.productionActual) els.productionActual.textContent = formatPower(actual);
    if (els.productionCapacity) els.productionCapacity.textContent = capacity > 0 ? formatPower(capacity) : '--';
  }

  function getActionForSlide(slide) {
    const actions = kioskConfig.slideActions || {};
    if (slide.type === 'total') return actions.total || null;

    const site = slide.site || {};
    const siteId = site.siteId ? String(site.siteId) : '';
    const siteName = site.siteName || '';
    return (
      (actions.bySiteId && siteId && actions.bySiteId[siteId]) ||
      (actions.bySiteName && siteName && actions.bySiteName[siteName]) ||
      (actions.byIndex && actions.byIndex[String(slide.index + 1)]) ||
      (site.actionHref ? { href: site.actionHref, label: site.actionLabel } : null) ||
      actions.defaultSite ||
      null
    );
  }

  function renderSlideAction(slide) {
    if (!els.slideAction) return;
    const action = getActionForSlide(slide);
    if (!action || !action.href) {
      els.slideAction.classList.add('hidden');
      return;
    }

    els.slideAction.textContent = action.label || (slide.type === 'total' ? 'Open portfolio link' : 'Open site link');
    els.slideAction.href = action.href;
    els.slideAction.target = action.target || '_blank';
    els.slideAction.classList.remove('hidden');
  }

  function getPhotoForSlide(slide) {
    const photos = kioskConfig.sitePhotos || {};
    if (slide.type === 'total') return photos.total || null;

    const site = slide.site || {};
    const siteId = site.siteId ? String(site.siteId) : '';
    const siteName = site.siteName || '';
    const fromSite = site.photoSrc || site.photo || site.imageSrc || site.image
      ? { src: site.photoSrc || site.photo || site.imageSrc || site.image, caption: site.photoCaption || site.caption || siteName }
      : null;

    return (
      (photos.bySiteId && siteId && photos.bySiteId[siteId]) ||
      (photos.bySiteName && siteName && photos.bySiteName[siteName]) ||
      (photos.byIndex && photos.byIndex[String(slide.index + 1)]) ||
      fromSite ||
      null
    );
  }

  function renderSitePhoto(slide) {
    if (!els.sitePhotoCard) return;
    if (slide.type !== 'site') {
      els.sitePhotoCard.classList.add('hidden');
      if (els.sitePhotoImage) els.sitePhotoImage.removeAttribute('src');
      return;
    }

    const photo = getPhotoForSlide(slide);
    els.sitePhotoCard.classList.remove('hidden');
    els.sitePhotoCaption.textContent = (photo && photo.caption) || (slide.site && slide.site.siteName) || 'Site photo';

    if (els.sitePhotoFrame) {
      const fit = (photo && photo.fit) || kioskConfig.sitePhotoFit || 'cover';
      const position = (photo && photo.position) || kioskConfig.sitePhotoPosition || 'center center';
      els.sitePhotoFrame.style.setProperty('--site-photo-fit', fit);
      els.sitePhotoFrame.style.setProperty('--site-photo-position', position);
    }

    if (photo && photo.src) {
      els.sitePhotoImage.src = resolveAssetUrl(photo.src);
      els.sitePhotoImage.alt = photo.alt || `${slide.site.siteName || 'Site'} photo`;
      els.sitePhotoImage.classList.remove('hidden');
      els.sitePhotoPlaceholder.classList.add('hidden');
    } else {
      els.sitePhotoImage.removeAttribute('src');
      els.sitePhotoImage.classList.add('hidden');
      els.sitePhotoPlaceholder.classList.remove('hidden');
    }
  }

  function createNavigationCard(options) {
    const row = document.createElement('a');
    row.className = `site-row nav-card ${options.className || ''}`.trim();
    row.href = options.href;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', options.ariaLabel || options.name);

    const main = document.createElement('div');
    main.className = 'site-row-main';

    const name = document.createElement('div');
    name.className = 'site-name';
    name.textContent = options.name;

    const meta = document.createElement('div');
    meta.className = 'site-meta';
    meta.textContent = options.meta;

    main.appendChild(name);
    main.appendChild(meta);

    const pill = document.createElement('div');
    pill.className = options.dotClass || 'site-dot';
    pill.setAttribute('aria-hidden', 'true');

    row.appendChild(main);
    row.appendChild(pill);
    return row;
  }

  function renderSites(sites, solar, slide, totalCapacityWatts) {
    if (!els.siteList) return;
    els.siteList.innerHTML = '';

    const totalPower = numberOrNull(solar && solar.overview && solar.overview.currentPower && solar.overview.currentPower.power) || 0;
    const totalCard = createNavigationCard({
      name: 'Total Portfolio',
      meta: `${formatPower(totalPower)} / ${formatPower(totalCapacityWatts)} cap.`,
      href: '#total',
      className: `total-card ${slide.type === 'total' ? 'active' : 'online'}`,
      dotClass: 'site-dot total-dot',
      ariaLabel: 'Show total portfolio slide'
    });
    els.siteList.appendChild(totalCard);

    sites.forEach((site, index) => {
      const capacityWatts = getCapacityWattsForSite(site);
      const siteIsOnline = Boolean(site.online && site.overview && !site.error);
      const powerWatts = getPowerWattsForSite(site);
      const active = slide.type === 'site' && slide.index === index;
      const card = createNavigationCard({
        name: site.siteName || `Production Site ${index + 1}`,
        meta: capacityWatts ? `${formatPower(powerWatts)} / ${formatPower(capacityWatts)} cap.` : formatPower(powerWatts),
        href: `#${getSiteSlug(site, index)}`,
        className: `${siteIsOnline ? 'online' : 'offline'} ${active ? 'active' : ''}`,
        ariaLabel: `Show ${site.siteName || `Production Site ${index + 1}`} slide`
      });
      els.siteList.appendChild(card);
    });
  }

  function render(payload) {
    state.payload = payload || {};
    const config = state.config || {};
    const solar = payload && payload.solar ? payload.solar : {};
    const sites = buildSites(solar, config);
    const slide = getCurrentSlide(sites);
    const isTotal = slide.type === 'total';
    const selectedSite = slide.site;
    const overview = isTotal ? (solar.overview || {}) : ((selectedSite && selectedSite.overview) || {});
    const lifetimeWh = overview.lifeTimeData && overview.lifeTimeData.energy;
    const totalCapacityWatts = getTotalCapacityWatts(solar, config);
    const selectedCapacityWatts = isTotal ? totalCapacityWatts : getCapacityWattsForSite(selectedSite);
    const selectedPowerWatts = isTotal
      ? (numberOrNull(overview.currentPower && overview.currentPower.power) || 0)
      : getPowerWattsForSite(selectedSite);

    const title = isTotal
      ? (solar.siteName || config.siteName || kioskConfig.siteName || 'Solar Portfolio')
      : (selectedSite && selectedSite.siteName) || 'Production Site';

    els.siteName.textContent = title;
    els.slideSubtitle.textContent = isTotal ? 'Combined production across configured sites' : 'Individual site production slide';
    els.slideEyebrow.textContent = isTotal ? 'Portfolio generation' : 'Site generation';
    els.heroUnit.textContent = isTotal ? 'Current portfolio production' : 'Current site production';
    els.lastUpdate.textContent = formatLastUpdate(overview.lastUpdateTime);
    els.heroValue.textContent = formatPower(selectedPowerWatts);
    els.totalSiteCapacity.textContent = formatPower(selectedCapacityWatts);
    els.capacityLabel.textContent = isTotal ? 'total site capacity' : 'site capacity';
    els.siteCount.textContent = isTotal ? (Number.isFinite(solar.siteCount) ? solar.siteCount : (config.siteCount || sites.length)) : 1;
    els.siteCountLabel.textContent = isTotal ? 'sites' : 'site';
    els.healthySiteCount.textContent = isTotal
      ? (Number.isFinite(solar.healthySiteCount) ? solar.healthySiteCount : sites.filter((site) => site.online && !site.error).length)
      : (selectedSite && selectedSite.online && !selectedSite.error ? 1 : 0);
    els.healthySiteLabel.textContent = 'reporting';
    els.energyToday.textContent = formatEnergy(overview.lastDayData && overview.lastDayData.energy);
    els.energyMonth.textContent = formatEnergy(overview.lastMonthData && overview.lastMonthData.energy);
    els.energyYear.textContent = formatEnergy(overview.lastYearData && overview.lastYearData.energy);
    els.energyLifetime.textContent = formatEnergy(lifetimeWh);

    renderProductionDisplay(selectedPowerWatts, selectedCapacityWatts);
    renderImpact(lifetimeWh);
    renderSites(sites, solar, slide, totalCapacityWatts);
    renderSlideAction(slide);
    renderSitePhoto(slide);
    renderWeather(payload && payload.weather, config, isTotal);

    const errors = payload && payload.errors ? payload.errors : {};
    if (state.connected) {
      setStatus(errors.solar ? 'Solar feed delayed' : 'Live', errors.solar ? 'warning' : 'online');
    }
  }

  async function loadConfig() {
    const response = await fetch(withBasePath('/config'), { cache: 'no-store' });
    const data = await response.json();
    state.config = data;
    els.siteName.textContent = data.siteName || kioskConfig.siteName || 'Solar Portfolio';
    render({ solar: data, weather: null, errors: {} });
    startSlideAutoplay();
  }

  function connectSocket() {
    const socket = io({ path: withBasePath('/socket.io'), transports: ['websocket', 'polling'] });

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

  window.addEventListener('hashchange', function () {
    if (state.payload) render(state.payload);
  });

  loadConfig()
    .then(connectSocket)
    .catch(function (error) {
      console.error(error);
      setStatus('Load failed', 'offline');
    });
})();
