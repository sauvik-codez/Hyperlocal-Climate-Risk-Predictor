import { NextResponse } from "next/server";
import { normalizePredictResponse } from "@/lib/predictNormalize";

type BackendPredictResponse = {
  city: string;
  current_weather?: {
    temperature_C: number;
    humidity_pct: number;
    pressure_hPa: number;
    cloud_cover_pct: number;
    wind_speed_ms?: number;
    wind_direction_deg?: number;
    dew_point_C?: number;
    solar_radiation_Wm2?: number;
  };
  rain?: {
    "probability_%": number;
    prediction: number;
  };
  thunderstorm?: {
    "probability_%": number;
  };
  heat_risk?: {
    level: string;
  };
  air_pollution?: {
    category: string;
  };
  air_gases?: {
    co: number;
    no2: number;
    o3: number;
    so2: number;
    pm2_5: number;
    pm10: number;
  };
  aqi_prediction?: { aqi: number; category: string };
  error?: string;
};

function asNonEmptyString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = asNonEmptyString(searchParams.get("city"));
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  let query: string | null = null;

  if (latParam !== null && lonParam !== null) {
    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Invalid latitude or longitude." }, { status: 400 });
    }

    query = `${lat},${lon}`;
  } else if (city) {
    query = city;
  }

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: city or lat/lon." },
      { status: 400 },
    );
  }

  const baseUrl = process.env.CLIMATE_BACKEND_URL ?? "https://weather-backend-2rfr.onrender.com";
  const endpoint = new URL(`/predict/${encodeURIComponent(query)}`, baseUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });

    const json = (await res.json()) as BackendPredictResponse;

    if (!res.ok) {
      return NextResponse.json(
        { error: json?.error ?? `Backend request failed (${res.status}).` },
        { status: res.status },
      );
    }

    // Normalize the response to ensure consistent property names
    const normalized = normalizePredictResponse(json as Record<string, unknown>);
    return NextResponse.json(normalized);
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "Backend request timed out. Please try again." : "Unexpected error." },
      { status: isAbort ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}