import {
  buildLstmRainProbabilities,
  probabilityPctToRainfallMm,
} from "@/lib/rainfallProbability";
import type { PredictPayload } from "@/lib/predictTypes";

export type { PredictPayload } from "@/lib/predictTypes";

type RawBackend = Record<string, unknown>;

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))
    .filter((v): v is number => v !== null);
}

function readProbabilityPct(block: Record<string, unknown>): number | undefined {
  return asNumber(block.probability_pct) ?? asNumber(block["probability_%"]);
}

function parseLstmForecast(
  raw: unknown,
  todayRainPct?: number,
): { days: number[]; probabilities: number[]; error?: string } {
  if (!raw || typeof raw !== "object") return { days: [], probabilities: [] };

  const block = raw as Record<string, unknown>;

  if (typeof block.error === "string") {
    return { days: [], probabilities: [], error: block.error };
  }

  const rainfallDays = parseNumberArray(block.next_3_days_rainfall_mm);
  const probabilityPct = parseNumberArray(block.next_3_days_rain_probability_pct);
  const probabilityPercent = parseNumberArray(block["next_3_days_rain_probability_%"]);
  const probabilities = probabilityPct.length > 0 ? probabilityPct : probabilityPercent;
  const days =
    rainfallDays.length > 0
      ? rainfallDays
      : probabilities.map((pct) => probabilityPctToRainfallMm(pct));

  if (days.length > 0 || probabilities.length > 0) {
    return {
      days,
      probabilities:
        probabilities.length > 0 ? probabilities : buildLstmRainProbabilities(days, todayRainPct),
    };
  }

  const mmValue = block.next_3_days_rainfall_mm;

  if (mmValue && typeof mmValue === "object" && "error" in mmValue) {
    const msg = (mmValue as { error?: unknown }).error;
    return {
      days: [],
      probabilities: [],
      error: typeof msg === "string" ? msg : "LSTM forecast failed.",
    };
  }

  return { days: [], probabilities: [] };
}

function resolveCity(raw: RawBackend): string {
  if (typeof raw.city === "string" && raw.city.trim()) return raw.city.trim();

  const resolved = raw.resolved_location;
  if (resolved && typeof resolved === "object") {
    const loc = resolved as { name?: string; region?: string; country?: string };
    const parts = [loc.name, loc.region, loc.country].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    if (parts.length > 0) return parts.join(", ");
  }

  if (typeof raw.query === "string" && raw.query.trim()) return raw.query.trim();
  return "Unknown location";
}

function normalizeRain(raw: unknown): PredictPayload["rain"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const block = raw as Record<string, unknown>;
  const probability_pct = readProbabilityPct(block);
  const prediction = asNumber(block.prediction);
  if (probability_pct === undefined || prediction === undefined) return undefined;
  return { probability_pct, prediction };
}

function normalizeThunderstorm(raw: unknown): PredictPayload["thunderstorm"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const block = raw as Record<string, unknown>;
  const probability_pct = readProbabilityPct(block);
  if (probability_pct === undefined) return undefined;
  return { probability_pct };
}

function normalizeCurrentWeather(raw: unknown): PredictPayload["current_weather"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const w = raw as Record<string, unknown>;

  const temp = asNumber(w.temperature_C);
  const humidity = asNumber(w.humidity_pct);
  const pressure = asNumber(w.pressure_hPa);
  const cloud = asNumber(w.cloud_cover_pct);

  if (temp === undefined || humidity === undefined || pressure === undefined || cloud === undefined) {
    return undefined;
  }

  const windNested =
    w.wind && typeof w.wind === "object"
      ? (w.wind as { speed_ms?: unknown; direction_deg?: unknown })
      : null;

  const speedMs = asNumber(w.wind_speed_ms) ?? (windNested ? asNumber(windNested.speed_ms) : undefined);
  const directionDeg =
    asNumber(w.wind_direction_deg) ?? (windNested ? asNumber(windNested.direction_deg) : undefined);

  return {
    temperature_C: temp,
    feels_like_C: asNumber(w.feels_like_C),
    humidity_pct: humidity,
    pressure_hPa: pressure,
    cloud_cover_pct: cloud,
    dew_point_C: asNumber(w.dew_point_C),
    visibility_km: asNumber(w.visibility_km),
    uv_index: asNumber(w.uv_index),
    precip_mm: asNumber(w.precip_mm),
    solar_radiation_Wm2: asNumber(w.solar_radiation_Wm2),
    wind_speed_ms: speedMs,
    wind_direction_deg: directionDeg,
    wind:
      speedMs !== undefined || directionDeg !== undefined
        ? { speed_ms: speedMs, direction_deg: directionDeg }
        : undefined,
  };
}

export function normalizePredictResponse(raw: RawBackend): PredictPayload {
  const rain = normalizeRain(raw.rain);
  const todayRainPct = rain?.probability_pct;

  const lstm = parseLstmForecast(raw.lstm_forecast, todayRainPct);

  const location =
    raw.location && typeof raw.location === "object"
      ? {
          lat: asNumber((raw.location as { lat?: unknown }).lat) ?? 0,
          lon: asNumber((raw.location as { lon?: unknown }).lon) ?? 0,
        }
      : undefined;

  const payload: PredictPayload = {
    city: resolveCity(raw),
    location:
      location && Number.isFinite(location.lat) && Number.isFinite(location.lon)
        ? location
        : undefined,
    current_weather: normalizeCurrentWeather(raw.current_weather),
    rain,
    thunderstorm: normalizeThunderstorm(raw.thunderstorm),
    heat_risk: raw.heat_risk as PredictPayload["heat_risk"],
    air_pollution: raw.air_pollution as PredictPayload["air_pollution"],
    air_gases: raw.air_gases as PredictPayload["air_gases"],
  };

  if (lstm.days.length > 0 || lstm.probabilities.length > 0) {
    payload.lstm_forecast = {
      next_3_days_rainfall_mm: lstm.days,
      next_3_days_rain_probability_pct: lstm.probabilities,
    };
  }
  if (lstm.error) {
    payload.lstm_error = lstm.error;
  }

  return payload;
}
