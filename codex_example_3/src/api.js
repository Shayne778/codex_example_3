const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_QUALITY_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";
const FRANKFURTER_URL = "https://api.frankfurter.app";
const REST_COUNTRIES_URL = "https://restcountries.com/v3.1/name";
const USGS_EARTHQUAKE_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

async function fetchJson(url, fallbackMessage) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";

    try {
      const errorPayload = await response.json();
      detail = errorPayload.reason || errorPayload.message || "";
    } catch (error) {
      detail = "";
    }

    throw new Error(detail || fallbackMessage);
  }

  return response.json();
}

export async function searchCities(query) {
  const url = new URL(OPEN_METEO_GEOCODE_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url.toString(), "Could not load city matches.");
  return data.results || [];
}

export async function fetchWeatherBundle(latitude, longitude) {
  const weatherUrl = new URL(OPEN_METEO_FORECAST_URL);
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "surface_pressure",
      "uv_index",
      "is_day",
    ].join(","),
  );
  weatherUrl.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
  );
  weatherUrl.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "uv_index_max",
      "precipitation_probability_max",
    ].join(","),
  );
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "3");

  const airQualityUrl = new URL(OPEN_METEO_AIR_QUALITY_URL);
  airQualityUrl.searchParams.set("latitude", String(latitude));
  airQualityUrl.searchParams.set("longitude", String(longitude));
  airQualityUrl.searchParams.set(
    "current",
    [
      "us_aqi",
      "pm10",
      "pm2_5",
      "carbon_monoxide",
      "ozone",
      "nitrogen_dioxide",
      "sulphur_dioxide",
    ].join(","),
  );
  airQualityUrl.searchParams.set("timezone", "auto");

  const [weather, airQuality] = await Promise.all([
    fetchJson(weatherUrl.toString(), "Could not load weather."),
    fetchJson(airQualityUrl.toString(), "Could not load air quality."),
  ]);

  return { weather, airQuality };
}

export async function fetchCurrencies() {
  return fetchJson(
    `${FRANKFURTER_URL}/currencies`,
    "Could not load currency list.",
  );
}

export async function fetchConversion(base, quote, amount) {
  const url = new URL(`${FRANKFURTER_URL}/latest`);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("from", base);
  url.searchParams.set("to", quote);

  return fetchJson(url.toString(), "Could not load conversion.");
}

export async function fetchHistoricalConversion(base, quote, startDate, endDate) {
  const url = `${FRANKFURTER_URL}/${startDate}..${endDate}?from=${base}&to=${quote}`;
  return fetchJson(url, "Could not load historical exchange rates.");
}

export async function fetchCountry(query) {
  const url = `${REST_COUNTRIES_URL}/${encodeURIComponent(query)}`;
  const data = await fetchJson(url, "Could not load country details.");
  return Array.isArray(data) ? data : [];
}

export async function fetchEarthquakes() {
  return fetchJson(USGS_EARTHQUAKE_URL, "Could not load earthquake feed.");
}
