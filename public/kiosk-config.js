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



  // Automatic slide rotation. Set enabled false if the kiosk should stay on the clicked page.
  slideAutoplay: {
    enabled: true,
    seconds: 12
  },

  // Default site photo behavior. Use 'cover' to fill the card, or 'contain' to show the whole image.
  sitePhotoFit: 'cover',
  sitePhotoPosition: 'center center',

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
      // '1234567': { label: 'Open SolarEdge site', href: 'https://monitoring.solaredge.com/solaredge-web/p/site/1234567/' }
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
      // '1234567': { src: 'photos/main-office.jpg', caption: 'Main Office array', fit: 'cover', position: 'center center' }
    },
    bySiteName: {
      // 'Main Office': { src: 'photos/main-office.jpg', caption: 'Main Office rooftop array', fit: 'cover', position: 'center center' }
    },
    byIndex: {
      // '1': { src: 'photos/site-1.jpg', caption: 'Production Site 1', fit: 'cover', position: 'center center' }
    }
  }
};
