# SolarEdge multi-site kiosk patch

Copy these files into the existing `synquix/solaredgekiosk` repo:

- `server.js`
- `public/app.js`
- `public/index.html`
- `public/kiosk-config.js`
- `.env.example` as your starting point for `.env`

## Simple shared-key setup

```env
API_KEY=your_account_or_site_api_key
SITE_IDS=1234567,2345678,3456789
PORTFOLIO_NAME=Arch Solar Portfolio
SITE_NAMES=North Plant,South Plant,Warehouse
SITE_CAPACITY_KW=250,600,180
```

## Advanced per-site-key setup

```env
SOLAREDGE_SITES=[{"id":"1234567","name":"North Plant","apiKey":"key1","capacityKw":250},{"id":"2345678","name":"South Plant","apiKey":"key2","capacityKw":600}]
PORTFOLIO_NAME=Arch Solar Portfolio
```

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Notes

- The backend aggregates current power, today, this month, year, and lifetime energy across the configured sites.
- If every site shares one API key, the backend uses SolarEdge's bulk overview endpoint.
- If a site group fails, the kiosk keeps showing the last good data and marks the feed as partial/offline.
- Keep `.env` out of Git. API keys belong on the server, not in browser JavaScript or public repos.
