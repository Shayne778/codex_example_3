import {
  AQI_LEVELS,
  CURRENCY_PREFERRED_ORDER,
  DEFAULTS,
  STORAGE_KEY,
  WEATHER_CODES,
} from "./constants.js";
import {
  fetchConversion,
  fetchCountry,
  fetchCurrencies,
  fetchEarthquakes,
  fetchHistoricalConversion,
  fetchWeatherBundle,
  searchCities,
} from "./api.js";

const state = {
  selectedCity: null,
  cityMatches: [],
  weatherBundle: null,
  weatherStatus: "idle",
  weatherError: "",
  currencies: {},
  currencyStatus: "idle",
  currencyError: "",
  conversion: null,
  conversionHistory: [],
  selectedCountry: null,
  countryStatus: "idle",
  countryError: "",
  earthquakes: [],
  quakeStatus: "idle",
  quakeError: "",
  savedCities: loadSavedCities(),
  currencyForm: {
    amount: DEFAULTS.amount,
    base: DEFAULTS.baseCurrency,
    quote: DEFAULTS.quoteCurrency,
  },
  quakeFilters: {
    minimumMagnitude: DEFAULTS.quakeMinimumMagnitude,
    sort: DEFAULTS.quakeSort,
  },
};

const refs = {
  heroLocation: document.querySelector("#hero-location"),
  heroTimezone: document.querySelector("#hero-timezone"),
  heroWeather: document.querySelector("#hero-weather"),
  heroFx: document.querySelector("#hero-fx"),
  heroQuakes: document.querySelector("#hero-quakes"),
  heroClock: document.querySelector("#hero-clock"),
  cityForm: document.querySelector("#city-form"),
  cityQuery: document.querySelector("#city-query"),
  cityMatches: document.querySelector("#city-matches"),
  savedCities: document.querySelector("#saved-cities"),
  useLocation: document.querySelector("#use-location"),
  weatherContent: document.querySelector("#weather-content"),
  currencyForm: document.querySelector("#currency-form"),
  amountInput: document.querySelector("#amount-input"),
  baseCurrency: document.querySelector("#base-currency"),
  quoteCurrency: document.querySelector("#quote-currency"),
  swapCurrencies: document.querySelector("#swap-currencies"),
  currencyMeta: document.querySelector("#currency-meta"),
  currencyContent: document.querySelector("#currency-content"),
  countryForm: document.querySelector("#country-form"),
  countryQuery: document.querySelector("#country-query"),
  countryContent: document.querySelector("#country-content"),
  refreshQuakes: document.querySelector("#refresh-quakes"),
  quakeMinimumMagnitude: document.querySelector("#quake-min-mag"),
  quakeSort: document.querySelector("#quake-sort"),
  quakeContent: document.querySelector("#quake-content"),
};

let clockTimer = null;

function loadSavedCities() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistSavedCities() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedCities));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPlaceLabel(place) {
  const pieces = [place.name, place.admin1, place.country].filter(Boolean);
  return pieces.join(", ");
}

function getWeatherCodeMeta(code) {
  return WEATHER_CODES[code] || { label: "Unknown conditions", tone: "cloud" };
}

function getAqiMeta(aqi) {
  return AQI_LEVELS.find((entry) => aqi <= entry.max) || AQI_LEVELS.at(-1);
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

function formatTemperature(value) {
  return `${Math.round(value)} C`;
}

function formatSignedDelta(value) {
  const rounded = Number(value.toFixed(4));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function formatPercentage(value) {
  return `${Math.round(value)}%`;
}

function formatDate(dateString, options) {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(dateString));
}

function formatLocalClock(timezone) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    timeZone: timezone,
  }).format(new Date());
}

function timeAgo(timestamp) {
  const elapsed = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (elapsed < hour) {
    return `${Math.max(1, Math.round(elapsed / minute))} min ago`;
  }

  return `${Math.round(elapsed / hour)} hr ago`;
}

function getHistoricalRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 10);

  const toIsoDate = (date) => date.toISOString().slice(0, 10);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function createLinePath(values, width, height, padding) {
  if (!values.length) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * usableWidth;
      const y = padding + usableHeight - ((value - min) / span) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderSparkline(values, labels, modifier = "") {
  if (!values.length) {
    return `<div class="empty-state">No chart data available yet.</div>`;
  }

  const width = 560;
  const height = 220;
  const padding = 24;
  const path = createLinePath(values, width, height, padding);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y =
        padding + (height - padding * 2) - ((value - min) / span) * (height - padding * 2);

      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(
        2,
      )}" r="4" class="chart-point"></circle>`;
    })
    .join("");

  const tickLabels = labels
    .map((label, index) => {
      const x = padding + (index / Math.max(labels.length - 1, 1)) * (width - padding * 2);
      return `<span style="left:${(x / width) * 100}%">${escapeHtml(label)}</span>`;
    })
    .join("");

  return `
    <div class="chart-shell ${modifier}">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
        <path d="${path}" class="chart-line"></path>
        ${points}
      </svg>
      <div class="chart-ticks">${tickLabels}</div>
    </div>
  `;
}

function renderEarthquakePlot(quakes) {
  if (!quakes.length) {
    return `<div class="empty-state">No earthquakes match the current filters.</div>`;
  }

  const width = 760;
  const height = 260;
  const topQuakes = quakes.slice(0, 60);
  const circles = topQuakes
    .map((quake) => {
      const [longitude, latitude] = quake.geometry.coordinates;
      const x = ((longitude + 180) / 360) * width;
      const y = ((90 - latitude) / 180) * height;
      const size = Math.max(3, quake.properties.mag * 1.5);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(
        1,
      )}" class="quake-dot"></circle>`;
    })
    .join("");

  return `
    <div class="plot-card">
      <div class="plot-head">
        <strong>Global spread</strong>
        <span>Dots are placed from live USGS coordinates.</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="quake-plot" role="img" aria-label="Earthquake spread chart">
        <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" class="plot-grid"></line>
        <line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" class="plot-grid"></line>
        <line x1="${width / 4}" y1="0" x2="${width / 4}" y2="${height}" class="plot-grid faint"></line>
        <line x1="${(width / 4) * 3}" y1="0" x2="${(width / 4) * 3}" y2="${height}" class="plot-grid faint"></line>
        ${circles}
      </svg>
      <div class="plot-axis">
        <span>180W</span>
        <span>0</span>
        <span>180E</span>
      </div>
    </div>
  `;
}

function buildWeatherBrief() {
  if (!state.selectedCity || !state.weatherBundle) {
    return "";
  }

  const { weather, airQuality } = state.weatherBundle;
  const current = weather.current;
  const today = {
    max: weather.daily.temperature_2m_max[0],
    min: weather.daily.temperature_2m_min[0],
    rainChance: weather.daily.precipitation_probability_max[0],
  };
  const nextTwelveHours = weather.hourly.time
    .map((time, index) => ({
      time,
      temp: weather.hourly.temperature_2m[index],
      precipitationProbability: weather.hourly.precipitation_probability[index],
    }))
    .slice(0, 12);

  const outdoorWindow =
    nextTwelveHours
      .filter((entry) => entry.precipitationProbability <= 20)
      .sort((left, right) => right.temp - left.temp)[0] || nextTwelveHours[0];

  const airMeta = getAqiMeta(airQuality.current.us_aqi);
  const weatherMeta = getWeatherCodeMeta(current.weather_code);

  return `
    <div class="brief-card">
      <p class="mini-label">Smart brief</p>
      <p>
        ${escapeHtml(formatPlaceLabel(state.selectedCity))} is currently
        ${escapeHtml(weatherMeta.label.toLowerCase())} at
        <strong>${escapeHtml(formatTemperature(current.temperature_2m))}</strong>.
        The day ranges from ${escapeHtml(formatTemperature(today.min))} to
        ${escapeHtml(formatTemperature(today.max))}, with a top rain chance of
        ${escapeHtml(formatPercentage(today.rainChance))}.
      </p>
      <p>
        Air quality is <strong>${escapeHtml(airMeta.label)}</strong> with a US
        AQI of ${escapeHtml(String(airQuality.current.us_aqi))}. Best outdoor
        window: ${escapeHtml(
          formatDate(outdoorWindow.time, {
            hour: "numeric",
            minute: "2-digit",
          }),
        )}, when the forecast shows ${escapeHtml(
          formatTemperature(outdoorWindow.temp),
        )} and ${escapeHtml(
          formatPercentage(outdoorWindow.precipitationProbability),
        )} rain probability.
      </p>
    </div>
  `;
}

function saveCurrentCity() {
  if (!state.selectedCity) {
    return;
  }

  const city = {
    name: state.selectedCity.name,
    admin1: state.selectedCity.admin1 || "",
    country: state.selectedCity.country || "",
    latitude: state.selectedCity.latitude,
    longitude: state.selectedCity.longitude,
    timezone: state.selectedCity.timezone || state.weatherBundle?.weather.timezone || "",
  };

  const uniqueCities = [city, ...state.savedCities].filter(
    (entry, index, entries) =>
      entries.findIndex(
        (candidate) =>
          candidate.name === entry.name &&
          candidate.country === entry.country &&
          candidate.latitude === entry.latitude &&
          candidate.longitude === entry.longitude,
      ) === index,
  );

  state.savedCities = uniqueCities.slice(0, 6);
  persistSavedCities();
  renderSavedCities();
}

function renderCityMatches() {
  if (!state.cityMatches.length) {
    refs.cityMatches.innerHTML = `<span class="hint-text">No alternatives yet.</span>`;
    return;
  }

  refs.cityMatches.innerHTML = state.cityMatches
    .map(
      (match, index) => `
        <button
          class="chip ${index === 0 ? "chip-active" : ""}"
          type="button"
          data-city-index="${index}"
        >
          ${escapeHtml(formatPlaceLabel(match))}
        </button>
      `,
    )
    .join("");
}

function renderSavedCities() {
  if (!state.savedCities.length) {
    refs.savedCities.innerHTML = `<span class="hint-text">Save a city to keep it here.</span>`;
    return;
  }

  refs.savedCities.innerHTML = state.savedCities
    .map(
      (city, index) => `
        <button class="chip" type="button" data-saved-city-index="${index}">
          ${escapeHtml(city.name)}
        </button>
      `,
    )
    .join("");
}

function renderHero() {
  refs.heroLocation.textContent = state.selectedCity
    ? formatPlaceLabel(state.selectedCity)
    : "No place selected";

  refs.heroTimezone.textContent = state.weatherBundle?.weather.timezone
    ? `Timezone: ${state.weatherBundle.weather.timezone}`
    : "Timezone unavailable";

  if (state.weatherBundle) {
    const current = state.weatherBundle.weather.current;
    refs.heroWeather.textContent = formatTemperature(current.temperature_2m);
    refs.heroClock.textContent = formatLocalClock(state.weatherBundle.weather.timezone);
  } else {
    refs.heroWeather.textContent = "--";
    refs.heroClock.textContent = "--";
  }

  refs.heroFx.textContent = `${state.currencyForm.base}/${state.currencyForm.quote}`;
  refs.heroQuakes.textContent = state.earthquakes.length
    ? formatNumber(state.earthquakes.length)
    : "--";
}

function renderWeather() {
  if (state.weatherStatus === "loading") {
    refs.weatherContent.innerHTML = `<div class="loading-card">Loading live weather and air quality...</div>`;
    return;
  }

  if (state.weatherStatus === "error") {
    refs.weatherContent.innerHTML = `<div class="error-card">${escapeHtml(
      state.weatherError,
    )}</div>`;
    return;
  }

  if (!state.weatherBundle || !state.selectedCity) {
    refs.weatherContent.innerHTML = `<div class="empty-state">Search for a city to load real weather data.</div>`;
    return;
  }

  const { weather, airQuality } = state.weatherBundle;
  const current = weather.current;
  const dailyCards = weather.daily.time
    .map((date, index) => {
      const meta = getWeatherCodeMeta(weather.daily.weather_code[index]);
      return `
        <article class="forecast-card">
          <span>${escapeHtml(
            formatDate(date, { weekday: "short", month: "short", day: "numeric" }),
          )}</span>
          <strong>${escapeHtml(meta.label)}</strong>
          <p>${escapeHtml(formatTemperature(weather.daily.temperature_2m_max[index]))} high</p>
          <p>${escapeHtml(formatTemperature(weather.daily.temperature_2m_min[index]))} low</p>
          <p>${escapeHtml(
            formatPercentage(weather.daily.precipitation_probability_max[index]),
          )} rain chance</p>
        </article>
      `;
    })
    .join("");

  const hourlyValues = weather.hourly.temperature_2m.slice(0, 12);
  const hourlyLabels = weather.hourly.time
    .slice(0, 12)
    .map((time) => formatDate(time, { hour: "numeric" }));

  const weatherMeta = getWeatherCodeMeta(current.weather_code);
  const aqiMeta = getAqiMeta(airQuality.current.us_aqi);

  refs.weatherContent.innerHTML = `
    <div class="overview-grid">
      <div class="current-card current-${escapeHtml(weatherMeta.tone)}">
        <div class="current-top">
          <div>
            <p class="mini-label">Now</p>
            <h3>${escapeHtml(formatPlaceLabel(state.selectedCity))}</h3>
          </div>
          <button id="save-city" class="ghost-button" type="button">Save city</button>
        </div>
        <div class="temperature-line">
          <strong>${escapeHtml(formatTemperature(current.temperature_2m))}</strong>
          <span>${escapeHtml(weatherMeta.label)}</span>
        </div>
        <p class="meta-copy">
          Updated ${escapeHtml(
            formatDate(current.time, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            }),
          )}
        </p>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <span>Feels like</span>
          <strong>${escapeHtml(formatTemperature(current.apparent_temperature))}</strong>
        </div>
        <div class="metric-card">
          <span>Humidity</span>
          <strong>${escapeHtml(formatPercentage(current.relative_humidity_2m))}</strong>
        </div>
        <div class="metric-card">
          <span>Wind</span>
          <strong>${escapeHtml(formatNumber(current.wind_speed_10m))} km/h</strong>
        </div>
        <div class="metric-card">
          <span>UV index</span>
          <strong>${escapeHtml(formatNumber(current.uv_index, { maximumFractionDigits: 1 }))}</strong>
        </div>
        <div class="metric-card">
          <span>US AQI</span>
          <strong>${escapeHtml(String(airQuality.current.us_aqi))} (${escapeHtml(aqiMeta.label)})</strong>
        </div>
        <div class="metric-card">
          <span>Sunset</span>
          <strong>${escapeHtml(
            formatDate(weather.daily.sunset[0], {
              hour: "numeric",
              minute: "2-digit",
            }),
          )}</strong>
        </div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="chart-card">
        <div class="section-inline-head">
          <strong>Next 12 hours</strong>
          <span>Temperature trend</span>
        </div>
        ${renderSparkline(hourlyValues, hourlyLabels)}
      </div>

      <div class="forecast-list">
        <div class="section-inline-head">
          <strong>3 day outlook</strong>
          <span>Forecast highs, lows, and rain chance</span>
        </div>
        <div class="forecast-row">${dailyCards}</div>
      </div>
    </div>

    ${buildWeatherBrief()}
  `;
}

function renderCurrencySelectors() {
  const orderedCurrencies = Object.entries(state.currencies).sort(([leftCode], [rightCode]) => {
    const leftPriority = CURRENCY_PREFERRED_ORDER.indexOf(leftCode);
    const rightPriority = CURRENCY_PREFERRED_ORDER.indexOf(rightCode);

    if (leftPriority === -1 && rightPriority === -1) {
      return leftCode.localeCompare(rightCode);
    }

    if (leftPriority === -1) {
      return 1;
    }

    if (rightPriority === -1) {
      return -1;
    }

    return leftPriority - rightPriority;
  });

  const options = orderedCurrencies
    .map(
      ([code, label]) => `
        <option value="${escapeHtml(code)}">${escapeHtml(code)} - ${escapeHtml(label)}</option>
      `,
    )
    .join("");

  refs.baseCurrency.innerHTML = options;
  refs.quoteCurrency.innerHTML = options;
  refs.baseCurrency.value = state.currencyForm.base;
  refs.quoteCurrency.value = state.currencyForm.quote;
}

function renderCurrency() {
  if (state.currencyStatus === "loading" && !state.conversion) {
    refs.currencyContent.innerHTML = `<div class="loading-card">Loading live exchange rates...</div>`;
    return;
  }

  if (state.currencyStatus === "error") {
    refs.currencyContent.innerHTML = `<div class="error-card">${escapeHtml(
      state.currencyError,
    )}</div>`;
    refs.currencyMeta.textContent = "Rate unavailable";
    return;
  }

  if (!state.conversion) {
    refs.currencyContent.innerHTML = `<div class="empty-state">Currency conversion will appear here.</div>`;
    return;
  }

  const quoteValue = Object.values(state.conversion.rates)[0];
  const latestDate = state.conversion.date;
  const baseRateHistory = state.conversionHistory.map((entry) => entry.rate);
  const historyLabels = state.conversionHistory.map((entry) =>
    formatDate(entry.date, { month: "short", day: "numeric" }),
  );
  const firstRate = baseRateHistory[0] || quoteValue;
  const delta = quoteValue / state.conversion.amount - firstRate;

  refs.currencyMeta.textContent = `Latest provider date: ${latestDate}`;
  refs.currencyContent.innerHTML = `
    <div class="currency-highlight">
      <div>
        <p class="mini-label">Converted amount</p>
        <h3>${escapeHtml(formatNumber(state.conversion.amount, { maximumFractionDigits: 2 }))} ${escapeHtml(
          state.conversion.base,
        )}</h3>
      </div>
      <div class="currency-result">
        <strong>${escapeHtml(formatNumber(quoteValue, { maximumFractionDigits: 2 }))}</strong>
        <span>${escapeHtml(state.currencyForm.quote)}</span>
      </div>
    </div>

    <div class="metric-grid metric-grid-tight">
      <div class="metric-card">
        <span>1 ${escapeHtml(state.currencyForm.base)}</span>
        <strong>${escapeHtml(
          formatNumber(quoteValue / state.conversion.amount, {
            maximumFractionDigits: 4,
          }),
        )} ${escapeHtml(state.currencyForm.quote)}</strong>
      </div>
      <div class="metric-card">
        <span>10 day move</span>
        <strong>${escapeHtml(formatSignedDelta(delta))}</strong>
      </div>
      <div class="metric-card">
        <span>Tracked points</span>
        <strong>${escapeHtml(String(state.conversionHistory.length))}</strong>
      </div>
    </div>

    <div class="chart-card">
      <div class="section-inline-head">
        <strong>${escapeHtml(state.currencyForm.base)}/${escapeHtml(
          state.currencyForm.quote,
        )} trend</strong>
        <span>Historical daily close from Frankfurter</span>
      </div>
      ${renderSparkline(baseRateHistory, historyLabels, "chart-shell-compact")}
    </div>
  `;
}

function pickBestCountry(countries, query) {
  const loweredQuery = query.trim().toLowerCase();
  return (
    countries.find(
      (country) =>
        country.name?.common?.toLowerCase() === loweredQuery ||
        country.name?.official?.toLowerCase() === loweredQuery,
    ) || countries[0]
  );
}

function renderCountry() {
  if (state.countryStatus === "loading") {
    refs.countryContent.innerHTML = `<div class="loading-card">Loading country profile...</div>`;
    return;
  }

  if (state.countryStatus === "error") {
    refs.countryContent.innerHTML = `<div class="error-card">${escapeHtml(
      state.countryError,
    )}</div>`;
    return;
  }

  if (!state.selectedCountry) {
    refs.countryContent.innerHTML = `<div class="empty-state">Search for a country to view verified details.</div>`;
    return;
  }

  const country = state.selectedCountry;
  const currencies = Object.entries(country.currencies || {})
    .map(([code, details]) => `${code} (${details.name})`)
    .join(", ");
  const languages = Object.values(country.languages || {}).join(", ");
  const timezones = (country.timezones || []).join(", ");
  const continents = (country.continents || []).join(", ");
  const capital = (country.capital || []).join(", ");

  refs.countryContent.innerHTML = `
    <div class="country-banner">
      <div>
        <p class="mini-label">Officially assigned country</p>
        <h3>${escapeHtml(country.name.common)}</h3>
        <p class="meta-copy">${escapeHtml(country.name.official || country.name.common)}</p>
      </div>
      ${
        country.flags?.svg
          ? `<img class="flag-image" src="${escapeHtml(country.flags.svg)}" alt="${escapeHtml(
              country.flags.alt || `Flag of ${country.name.common}`,
            )}" />`
          : ""
      }
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <span>Capital</span>
        <strong>${escapeHtml(capital || "Unavailable")}</strong>
      </div>
      <div class="metric-card">
        <span>Population</span>
        <strong>${escapeHtml(formatNumber(country.population || 0))}</strong>
      </div>
      <div class="metric-card">
        <span>Area</span>
        <strong>${escapeHtml(formatNumber(country.area || 0))} sq km</strong>
      </div>
      <div class="metric-card">
        <span>Region</span>
        <strong>${escapeHtml([country.region, country.subregion].filter(Boolean).join(", "))}</strong>
      </div>
      <div class="metric-card">
        <span>Currencies</span>
        <strong>${escapeHtml(currencies || "Unavailable")}</strong>
      </div>
      <div class="metric-card">
        <span>Languages</span>
        <strong>${escapeHtml(languages || "Unavailable")}</strong>
      </div>
      <div class="metric-card">
        <span>Timezones</span>
        <strong>${escapeHtml(timezones || "Unavailable")}</strong>
      </div>
      <div class="metric-card">
        <span>Driving side</span>
        <strong>${escapeHtml(country.car?.side || "Unavailable")}</strong>
      </div>
    </div>

    <div class="country-links">
      <span>${escapeHtml(continents || "Unknown continent")}</span>
      ${
        country.maps?.googleMaps
          ? `<a href="${escapeHtml(country.maps.googleMaps)}" target="_blank" rel="noreferrer">Open Google Maps</a>`
          : ""
      }
      ${
        country.maps?.openStreetMaps
          ? `<a href="${escapeHtml(country.maps.openStreetMaps)}" target="_blank" rel="noreferrer">OpenStreetMap</a>`
          : ""
      }
    </div>
  `;
}

function getFilteredEarthquakes() {
  const minimumMagnitude = Number(state.quakeFilters.minimumMagnitude);
  const filtered = state.earthquakes.filter(
    (quake) => (quake.properties.mag || 0) >= minimumMagnitude,
  );

  if (state.quakeFilters.sort === "magnitude") {
    filtered.sort((left, right) => (right.properties.mag || 0) - (left.properties.mag || 0));
  } else if (state.quakeFilters.sort === "depth") {
    filtered.sort(
      (left, right) => right.geometry.coordinates[2] - left.geometry.coordinates[2],
    );
  } else {
    filtered.sort((left, right) => right.properties.time - left.properties.time);
  }

  return filtered;
}

function renderEarthquakes() {
  if (state.quakeStatus === "loading" && !state.earthquakes.length) {
    refs.quakeContent.innerHTML = `<div class="loading-card">Loading the latest USGS earthquake feed...</div>`;
    return;
  }

  if (state.quakeStatus === "error") {
    refs.quakeContent.innerHTML = `<div class="error-card">${escapeHtml(
      state.quakeError,
    )}</div>`;
    return;
  }

  const filtered = getFilteredEarthquakes();

  if (!filtered.length) {
    refs.quakeContent.innerHTML = `<div class="empty-state">No earthquakes in the past day match the current filters.</div>`;
    return;
  }

  const strongest = filtered.reduce((best, quake) =>
    (quake.properties.mag || 0) > (best.properties.mag || 0) ? quake : best,
  );
  const deepest = filtered.reduce((best, quake) =>
    quake.geometry.coordinates[2] > best.geometry.coordinates[2] ? quake : best,
  );
  const quakeList = filtered
    .slice(0, 8)
    .map((quake) => {
      const depth = quake.geometry.coordinates[2];
      return `
        <a class="quake-row" href="${escapeHtml(
          quake.properties.url,
        )}" target="_blank" rel="noreferrer">
          <div>
            <strong>M ${escapeHtml(formatNumber(quake.properties.mag || 0, { maximumFractionDigits: 1 }))}</strong>
            <p>${escapeHtml(quake.properties.place || "Unknown place")}</p>
          </div>
          <div class="quake-row-meta">
            <span>${escapeHtml(formatNumber(depth, { maximumFractionDigits: 1 }))} km deep</span>
            <span>${escapeHtml(timeAgo(quake.properties.time))}</span>
          </div>
        </a>
      `;
    })
    .join("");

  refs.quakeContent.innerHTML = `
    <div class="metric-grid">
      <div class="metric-card">
        <span>Matching events</span>
        <strong>${escapeHtml(formatNumber(filtered.length))}</strong>
      </div>
      <div class="metric-card">
        <span>Strongest</span>
        <strong>M ${escapeHtml(
          formatNumber(strongest.properties.mag || 0, { maximumFractionDigits: 1 }),
        )}</strong>
      </div>
      <div class="metric-card">
        <span>Deepest</span>
        <strong>${escapeHtml(
          formatNumber(deepest.geometry.coordinates[2], { maximumFractionDigits: 1 }),
        )} km</strong>
      </div>
      <div class="metric-card">
        <span>Strongest place</span>
        <strong>${escapeHtml(strongest.properties.place || "Unknown place")}</strong>
      </div>
    </div>

    <div class="detail-grid detail-grid-earthquake">
      ${renderEarthquakePlot(filtered)}
      <div class="quake-list-card">
        <div class="section-inline-head">
          <strong>Recent notable events</strong>
          <span>Linked directly to USGS event pages</span>
        </div>
        <div class="quake-list">${quakeList}</div>
      </div>
    </div>
  `;
}

function rerenderAll() {
  renderHero();
  renderCityMatches();
  renderSavedCities();
  renderWeather();
  renderCurrency();
  renderCountry();
  renderEarthquakes();
}

async function loadCityWeather(place) {
  state.selectedCity = place;
  state.weatherBundle = null;
  state.weatherStatus = "loading";
  state.weatherError = "";
  renderHero();
  renderWeather();

  try {
    const bundle = await fetchWeatherBundle(place.latitude, place.longitude);
    state.weatherBundle = bundle;
    state.weatherStatus = "success";

    if (place.country) {
      refs.countryQuery.value = place.country;
      await loadCountry(place.country);
    }
  } catch (error) {
    state.weatherStatus = "error";
    state.weatherError = error.message || "Could not load city weather.";
  }

  renderHero();
  renderWeather();
}

async function searchAndLoadCity(query) {
  state.weatherStatus = "loading";
  state.weatherError = "";
  renderWeather();

  try {
    const matches = await searchCities(query);
    state.cityMatches = matches;

    if (!matches.length) {
      throw new Error("No city matches found. Try a broader search.");
    }

    renderCityMatches();
    await loadCityWeather(matches[0]);
  } catch (error) {
    state.weatherStatus = "error";
    state.weatherError = error.message || "Could not find that city.";
    renderWeather();
  }
}

async function loadCurrentLocationWeather(position) {
  state.selectedCity = {
    name: "Current position",
    admin1: `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`,
    country: "",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timezone: "",
  };

  state.cityMatches = [];
  state.weatherBundle = null;
  state.weatherStatus = "loading";
  state.weatherError = "";
  renderHero();
  renderCityMatches();
  renderWeather();

  try {
    state.weatherBundle = await fetchWeatherBundle(
      position.coords.latitude,
      position.coords.longitude,
    );
    state.weatherStatus = "success";
  } catch (error) {
    state.weatherStatus = "error";
    state.weatherError = error.message || "Could not load weather for your position.";
  }

  renderHero();
  renderWeather();
}

async function loadCurrencyData() {
  state.currencyStatus = "loading";
  state.currencyError = "";
  renderCurrency();

  try {
    if (!Object.keys(state.currencies).length) {
      state.currencies = await fetchCurrencies();
      renderCurrencySelectors();
    }

    const { startDate, endDate } = getHistoricalRange();
    const [conversion, history] = await Promise.all([
      fetchConversion(
        state.currencyForm.base,
        state.currencyForm.quote,
        state.currencyForm.amount,
      ),
      fetchHistoricalConversion(
        state.currencyForm.base,
        state.currencyForm.quote,
        startDate,
        endDate,
      ),
    ]);

    state.conversion = conversion;
    state.conversionHistory = Object.entries(history.rates || {})
      .map(([date, value]) => ({
        date,
        rate: value[state.currencyForm.quote],
      }))
      .filter((entry) => typeof entry.rate === "number");
    state.currencyStatus = "success";
  } catch (error) {
    state.currencyStatus = "error";
    state.currencyError = error.message || "Could not load exchange rates.";
  }

  renderHero();
  renderCurrency();
}

async function loadCountry(query) {
  state.countryStatus = "loading";
  state.countryError = "";
  renderCountry();

  try {
    const countries = await fetchCountry(query);
    if (!countries.length) {
      throw new Error("No matching country was returned.");
    }

    state.selectedCountry = pickBestCountry(countries, query);
    state.countryStatus = "success";
  } catch (error) {
    state.countryStatus = "error";
    state.countryError = error.message || "Could not load country details.";
  }

  renderCountry();
}

async function loadEarthquakeFeed() {
  state.quakeStatus = "loading";
  state.quakeError = "";
  renderEarthquakes();

  try {
    const data = await fetchEarthquakes();
    state.earthquakes = data.features || [];
    state.quakeStatus = "success";
  } catch (error) {
    state.quakeStatus = "error";
    state.quakeError = error.message || "Could not load earthquake feed.";
  }

  renderHero();
  renderEarthquakes();
}

function bindEvents() {
  refs.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = refs.cityQuery.value.trim();

    if (query) {
      searchAndLoadCity(query);
    }
  });

  refs.cityMatches.addEventListener("click", (event) => {
    const button = event.target.closest("[data-city-index]");
    if (!button) {
      return;
    }

    const index = Number(button.dataset.cityIndex);
    const place = state.cityMatches[index];
    if (place) {
      loadCityWeather(place);
    }
  });

  refs.savedCities.addEventListener("click", (event) => {
    const button = event.target.closest("[data-saved-city-index]");
    if (!button) {
      return;
    }

    const city = state.savedCities[Number(button.dataset.savedCityIndex)];
    if (city) {
      loadCityWeather(city);
    }
  });

  refs.weatherContent.addEventListener("click", (event) => {
    const saveButton = event.target.closest("#save-city");
    if (saveButton) {
      saveCurrentCity();
    }
  });

  refs.useLocation.addEventListener("click", () => {
    if (!navigator.geolocation) {
      state.weatherStatus = "error";
      state.weatherError = "Geolocation is not supported in this browser.";
      renderWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(loadCurrentLocationWeather, () => {
      state.weatherStatus = "error";
      state.weatherError =
        "Location access was denied, so the current-position view could not load.";
      renderWeather();
    });
  });

  refs.currencyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.currencyForm.amount = Number(refs.amountInput.value) || DEFAULTS.amount;
    state.currencyForm.base = refs.baseCurrency.value;
    state.currencyForm.quote = refs.quoteCurrency.value;
    loadCurrencyData();
  });

  refs.swapCurrencies.addEventListener("click", () => {
    const previousBase = refs.baseCurrency.value;
    refs.baseCurrency.value = refs.quoteCurrency.value;
    refs.quoteCurrency.value = previousBase;
    state.currencyForm.base = refs.baseCurrency.value;
    state.currencyForm.quote = refs.quoteCurrency.value;
    loadCurrencyData();
  });

  refs.countryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = refs.countryQuery.value.trim();
    if (query) {
      loadCountry(query);
    }
  });

  refs.refreshQuakes.addEventListener("click", () => {
    loadEarthquakeFeed();
  });

  refs.quakeMinimumMagnitude.addEventListener("change", () => {
    state.quakeFilters.minimumMagnitude = Number(refs.quakeMinimumMagnitude.value);
    renderEarthquakes();
  });

  refs.quakeSort.addEventListener("change", () => {
    state.quakeFilters.sort = refs.quakeSort.value;
    renderEarthquakes();
  });
}

function startHeroClock() {
  window.clearInterval(clockTimer);
  clockTimer = window.setInterval(() => {
    if (state.weatherBundle?.weather?.timezone) {
      refs.heroClock.textContent = formatLocalClock(state.weatherBundle.weather.timezone);
    }
  }, 60 * 1000);
}

async function initializeApp() {
  bindEvents();
  rerenderAll();
  refs.countryQuery.value = DEFAULTS.country;
  refs.cityQuery.value = DEFAULTS.city;
  refs.amountInput.value = String(DEFAULTS.amount);
  refs.quakeMinimumMagnitude.value = String(DEFAULTS.quakeMinimumMagnitude);
  refs.quakeSort.value = DEFAULTS.quakeSort;

  await Promise.allSettled([
    searchAndLoadCity(DEFAULTS.city),
    loadCurrencyData(),
    loadEarthquakeFeed(),
  ]);

  startHeroClock();
}

initializeApp();
