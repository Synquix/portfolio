// Browser-only kiosk display overrides. Do not put SolarEdge API keys here.
window.KIOSK_CONFIG = {
  // Optional title override. Usually better to set PORTFOLIO_NAME in .env.
  siteName: 'Pettit National Ice Center',

  // Optional logo override. Defaults to the bundled Arch Solar C&I vector lockup.
  brandLogoSrc: '/arch-solar-ci-logo.png',

  // Building + sun tracker customization for the hero mark.
  // Default coordinates point to Milwaukee, WI.
  sunIcon: {
    sizePx: 140,
    latitude: 43.0389,
    longitude: -87.9065,
    skyColorTop: 'rgba(247, 175, 27, 0.12)',
    skyColorBottom: 'rgba(31, 51, 84, 0.02)',
    arcColor: 'rgba(247, 175, 27, 0.28)',
    sunColor: '#F7AF1B',
    sunGlowColor: 'rgba(247, 175, 27, 0.42)',
    sunEdgeColor: 'rgba(227, 87, 0, 0.42)',
    buildingColor: '#DBDBDB',
    buildingShadowColor: 'rgba(31, 51, 84, 0.32)',
    buildingWindowColor: 'rgba(31, 51, 84, 0.72)',
    groundColor: 'rgba(219, 219, 219, 0.12)'
  },

  // Optional total portfolio capacity override. Backend/env values win for data aggregation.
  systemCapacityWatts: null,
  systemCapacityKw: null
};
