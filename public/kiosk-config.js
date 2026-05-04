// Browser-only kiosk display overrides. Do not put SolarEdge API keys here.
window.KIOSK_CONFIG = {
  // Optional title override. Usually better to set PORTFOLIO_NAME in .env.
  siteName: '',

  // Optional total portfolio capacity override. Backend/env values win for data aggregation.
  systemCapacityWatts: null,
  systemCapacityKw: null
};
