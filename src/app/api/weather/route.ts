import { NextResponse } from "next/server";

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type OpenMeteoCurrent = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
};

type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
};

type OpenMeteoForecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
};

function asNonEmptyString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getTopGeocode(name: string, signal: AbortSignal): Promise<GeocodingResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    signal,
    headers: { "user-agent": "hyperlocal-weather-nextjs/1.0" },
    next: { revalidate: 60 },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { results?: GeocodingResult[] };
  const top = data.results?.[0];
  return top ?? null;
}

async function getForecast(lat: number, lon: number, signal: AbortSignal): Promise<OpenMeteoForecast | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"].join(","),
  );
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal, next: { revalidate: 60 } });
  if (!res.ok) return null;
  return (await res.json()) as OpenMeteoForecast;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = asNonEmptyString(searchParams.get("query"));

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: query" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const location = await getTopGeocode(query, controller.signal);
    if (!location) {
      return NextResponse.json(
        { error: "Location not found. Try a different city name." },
        { status: 404 },
      );
    }

    const forecast = await getForecast(location.latitude, location.longitude, controller.signal);
    if (!forecast?.current || !forecast?.daily) {
      return NextResponse.json({ error: "Weather provider returned incomplete data." }, { status: 502 });
    }

    return NextResponse.json({
      location: {
        name: location.name,
        admin1: location.admin1 ?? null,
        country: location.country ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone ?? forecast.timezone ?? null,
      },
      current: forecast.current,
      daily: forecast.daily,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const isAbort = err instanceof Error && err.name === "AbortError";

    return NextResponse.json(
      { error: isAbort ? "Weather request timed out. Please try again." : message },
      { status: isAbort ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

