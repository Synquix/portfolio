// Browser-only kiosk display overrides. Do not put SolarEdge API keys here.
window.KIOSK_CONFIG = {
  // Optional title override. Usually better to set PORTFOLIO_NAME in .env.
  siteName: '',

  // Logo path can be relative, root-relative, or absolute.
  // Relative paths work under both / and /portfolio/ Nginx routes.
  brandLogoSrc: 'arch-solar-ci-logo.png',

  // Optional total portfolio capacity override. Backend/env values win for data aggregation.
  systemCapacityWatts: null,
  systemCapacityKw: null,

  // Optional slide-specific call-to-action buttons.
  // These links show inside the hero section and change based on the active slide.
  slideActions: {
    total: {
      label: 'Open portfolio dashboard',
      href: ''
    },
    defaultSite: {
      label: 'Open site dashboard',
      href: ''
    },
    bySiteId: {
      '4606546': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/4606546/' },
      '4570997': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/4570997/' },
      '4539873': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/4539873/' },
      '2087486': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/2087486/' },
      '4856078': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/4856078/' },
      '4601205': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/4601205/' }
    },
    bySiteName: {
      // 'Main Office': { label: 'Open Main Office report', href: 'https://example.com/main-office' }
    },
    byIndex: {
      // '1': { label: 'Open first site link', href: 'https://example.com/site-1' }
    }
  },

  // Optional photos shown on individual site slides.
  // Put image files in public/photos/ and reference them with relative paths.
sitePhotos: {
  total: null,
  bySiteId: {
    '4606546': { src: 'photos/firefly.png', caption: '' },
    '4570997': { src: 'photos/police.png', caption: '' },
    '4539873': { src: 'photos/muellner.png', caption: '' },
    '2087486': { src: 'photos/cityhall.png', caption: '' },
    '4856078': { src: 'photos/fs52.png', caption: '' },
    '4601205': { src: 'photos/potter.png', caption: '', fit: 'cover', position: 'center center' }
  },
  bySiteName: {
    // Optional fallback by exact site name
  },
  byIndex: {
    // Optional fallback by slide order
  }
}
};
