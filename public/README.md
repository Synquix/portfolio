# SolarEdge Kiosk: Photo Card + Weather Below Production

Copy these files into the `public/` folder of `Synquix/solaredgekiosk`.

## What changed

- The right-side card is now a dedicated photo card.
- The weather card is weather-only.
- The weather card sits below the main project production card.
- `app.js` is untouched, because breaking live data for a layout tweak would be a very human contribution to chaos.

## Files

- `index.html`: replaces `public/index.html`.
- `company-style.css`: portfolio-matched styling with the new layout.
- `photo-card.js`: rotates photos in the dedicated photo card.
- `kiosk-config.example.js`: example config showing `photos` and `photoIntervalMs`.

## Install

1. Put `index.html`, `company-style.css`, and `photo-card.js` in `public/`.
2. Keep the existing `style.css`, `app.js`, image assets, and server files.
3. Add the `photos` array from `kiosk-config.example.js` into your real `public/kiosk-config.js`.
4. Put images in `public/photos/`, or change each `src` path to match your setup.

## Supported photo config

String entries work:

```js
photos: [
  "photos/site-1.jpg",
  "photos/site-2.jpg"
]
```

Object entries add captions and crop control:

```js
photos: [
  {
    src: "photos/site-1.jpg",
    alt: "Solar array exterior view",
    caption: "Pettit National Ice Center solar array",
    position: "center center"
  }
]
```

The script also accepts `sitePhotos` or `weatherPhotos`, so older naming still works.
