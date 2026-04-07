# codex_example_3

Northstar Atlas is a static, modern dashboard built to be easy to host on GitHub Pages or any static hosting platform. It combines real public data feeds into one interface so the app stays useful without inventing any content.

## What it does

- City weather search powered by Open-Meteo geocoding, forecast, and air-quality APIs
- Current-position weather view using browser geolocation
- Saved city shortcuts stored locally in the browser
- Live currency conversion and recent rate trend powered by Frankfurter
- Country lookup powered by REST Countries
- Recent earthquake monitoring and global spread chart powered by the USGS GeoJSON feed

## Data sources

- Open-Meteo: [https://open-meteo.com/en/docs](https://open-meteo.com/en/docs)
- Frankfurter: [https://www.frankfurter.app/docs](https://www.frankfurter.app/docs)
- REST Countries: [https://restcountries.com/](https://restcountries.com/)
- USGS Earthquake Feed: [https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)

## Project structure

```text
codex_example_3/
  index.html
  README.md
  src/
    api.js
    constants.js
    main.js
    styles.css
```

## Run locally

Because this is a static app, you can serve the folder with any simple local web server.

Example with Python:

```bash
cd codex_example_3
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Hosting

This project is ready for static hosting:

- GitHub Pages
- Netlify
- Vercel static deployment
- Cloudflare Pages

No backend is required.
