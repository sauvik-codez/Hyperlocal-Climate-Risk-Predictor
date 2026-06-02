"use client";

import { WeatherIcon } from "@/components/WeatherIcon";
import { formatHumidityPct, formatTemperatureC } from "@/lib/format";
import type { PredictPayload } from "@/lib/predictNormalize";
import { isRainLikely } from "@/lib/rainfallProbability";
import { getWeatherCodeInfo } from "@/lib/weatherCodes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-sky-200/95 backdrop-blur supports-backdrop-filter:bg-sky-200/70 dark:border-white/10 dark:bg-sky-900/30">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-black/90 dark:text-white/90">
              Hyperlocal Climate
            </span>
            <span className="text-xs text-black/50 dark:text-white/50">Weather + risk signals</span>
          </div>
          <a
            className="text-xs font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            href="https://weather-backend-wk9f.onrender.com/"
            target="_blank"
            rel="noreferrer"
          >
            API: Climate backend
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <WeatherApp />
      </main>

      <footer className="border-t border-black/5 py-6 text-center text-xs text-black/50 dark:border-white/10 dark:text-white/50">
        <div>Built with Next.js. Powered by your climate prediction API.</div>
        <div className="mt-1">Developed by Arnab, Sujoy, Sauvik & Subhajit</div>
      </footer>
    </div>
  );
}

type PredictResponse = PredictPayload;

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type RiskSeverity = "low" | "med" | "high" | "unknown";

function normalizeSeverity(input: string): RiskSeverity {
  const s = input.trim().toLowerCase();
  if (s.startsWith("low")) return "low";
  if (s.startsWith("med")) return "med";
  if (s.startsWith("moderate")) return "med";
  if (s.startsWith("high")) return "high";
  if (s.startsWith("severe")) return "high";
  return "unknown";
}

function severityFromPercent(pct: number): RiskSeverity {
  if (pct >= 70) return "high";
  if (pct >= 35) return "med";
  return "low";
}

function severityFromAirCategory(category: string): RiskSeverity {
  const c = category.trim().toLowerCase();
  if (c === "good") return "low";
  if (c === "moderate") return "med";
  if (c.includes("unhealthy") || c.includes("hazardous") || c.includes("very")) return "high";
  return "unknown";
}

function isWithinWestBengal(location?: { lat?: number; lon?: number }, resolvedLocation?: { region?: string; country?: string }) {
  const region = resolvedLocation?.region?.trim().toLowerCase() ?? "";
  const country = resolvedLocation?.country?.trim().toLowerCase() ?? "";

  if (country === "india" && region.includes("west bengal")) {
    return true;
  }

  if (location?.lat != null && location?.lon != null) {
    return location.lat >= 21.4 && location.lat <= 27.1 && location.lon >= 85.5 && location.lon <= 89.9;
  }

  return false;
}

function severityClasses(sev: RiskSeverity): { border: string; bg: string; text: string; badge: string } {
  switch (sev) {
    case "low":
      return {
        border: "border-emerald-600/30 dark:border-emerald-500/25",
        bg: "bg-emerald-600/20 dark:bg-emerald-400/20",
        text: "text-emerald-950 dark:text-emerald-100",
        badge: "bg-emerald-600/20 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-100",
      };
    case "med":
      return {
        border: "border-amber-600/30 dark:border-amber-500/25",
        bg: "bg-amber-600/20 dark:bg-amber-400/20",
        text: "text-amber-950 dark:text-amber-100",
        badge: "bg-amber-600/20 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100",
      };
    case "high":
      return {
        border: "border-rose-600/30 dark:border-rose-500/25",
        bg: "bg-rose-600/20 dark:bg-rose-400/20",
        text: "text-rose-950 dark:text-rose-100",
        badge: "bg-rose-600/20 text-rose-950 dark:bg-rose-400/20 dark:text-rose-100",
      };
    default:
      return {
        border: "border-black/5 dark:border-white/10",
        bg: "bg-white/60 dark:bg-white/5",
        text: "text-black/80 dark:text-white/85",
        badge: "bg-sky-1000/10 text-sky-900/70 dark:bg-white/10 dark:text-white/80",
      };
  }
}

type SearchRequest =
  | { type: "city"; city: string }
  | { type: "location"; lat: number; lon: number };

function WeatherApp() {
  const [query, setQuery] = useState("Kolkata");
  const [data, setData] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [showOutsideWarning, setShowOutsideWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const lastSearchRef = useRef<SearchRequest>({ type: "city", city: "Kolkata" });

  const currentInfo = useMemo(() => {
    // Backend response doesn't include a weather code, so we show a neutral label.
    return data ? getWeatherCodeInfo(2) : null;
  }, [data]);

  const runSearch = useCallback(async (search: SearchRequest) => {
    setError(null);
    setLocationError(null);
    setShowOutsideWarning(false);
    setIsLoading(true);

    lastSearchRef.current = search;
    if (search.type === "location") {
      setUserLocation({ lat: search.lat, lon: search.lon });
    }

    const params = new URLSearchParams();
    if (search.type === "city") {
      params.set("city", search.city);
    } else {
      params.set("lat", String(search.lat));
      params.set("lon", String(search.lon));
    }

    try {
      const res = await fetch(`/api/predict?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as PredictResponse | { error?: string };

      if (!res.ok) {
        setData(null);
        const message =
          "error" in json && typeof json.error === "string" ? json.error : "Request failed.";
        setError(message);
        return;
      }

      setData(json as PredictResponse);
      setShowOutsideWarning(!isWithinWestBengal((json as PredictResponse).location, (json as PredictResponse).resolved_location));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
      if (search.type === "location") {
        setIsRequestingLocation(false);
      }
    }
  }, []);

  useEffect(() => {
    lastSearchRef.current = { type: "city", city: query };
  }, [query]);

  useEffect(() => {
    if (data) {
      console.log("Weather data:", {
        rain: data.rain,
        thunderstorm: data.thunderstorm,
        heat_risk: data.heat_risk,
        air_pollution: data.air_pollution,
      });
    }
  }, [data]);

  useEffect(() => {
    void runSearch(lastSearchRef.current);
    const interval = setInterval(() => {
      void runSearch(lastSearchRef.current);
    }, 60_000);

    return () => clearInterval(interval);
  }, [runSearch]);

  async function handleUseMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationError(null);
    setIsRequestingLocation(true);

    let position: GeolocationPosition | null = null;

    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
    } catch (err) {
      setIsRequestingLocation(false);
      if (err instanceof Error) {
        setLocationError(err.message || "Unable to fetch your location.");
      } else {
        setLocationError("Unable to fetch your location.");
      }
      return;
    }

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    await runSearch({ type: "location", lat, lon });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runSearch({ type: "city", city: query });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-sky-200/90 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-black/5 dark:border-white/15 dark:bg-sky-900/30 dark:ring-white/10 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -top-24 -right-28 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        </div>

        <div className="relative">
          <h1 className="text-balance text-xl font-semibold tracking-tight text-black/90 dark:text-white/90 sm:text-2xl">
            Check today’s conditions and climate risk signals
          </h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Powered by your prediction API. Start with Kolkata, search any city, or use My location.
          </p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">City</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Kolkata, London, Tokyo"
                className="w-full rounded-2xl border border-black/10 bg-sky-200/95 px-4 py-3 text-sm text-black shadow-sm outline-none transition focus:border-black/20 focus:ring-4 focus:ring-black/10 dark:border-white/15 dark:bg-sky-900/40 dark:text-white dark:focus:border-white/25 dark:focus:ring-white/15"
                required
                minLength={2}
                inputMode="search"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.20)] transition hover:bg-black/90 hover:shadow-[0_14px_34px_rgba(0,0,0,0.22)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:shadow-[0_10px_28px_rgba(255,255,255,0.08)] dark:hover:bg-white/90"
            >
              <span>{isLoading ? "Searching…" : "Search"}</span>
              <span className="text-white/70 transition group-hover:translate-x-0.5 dark:text-black/60">→</span>
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Kolkata", "Delhi", "Mumbai", "Chennai", "Bengaluru"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setQuery(c);
                  void runSearch({ type: "city", city: c });
                }}
                className="rounded-full border border-black/10 bg-sky-200/80 px-3 py-1.5 text-xs font-medium text-black/80 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-200/95 hover:text-black dark:border-white/15 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/14 dark:hover:text-white"
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isRequestingLocation}
              className="rounded-full border border-black/10 bg-sky-900/10 px-3 py-1.5 text-xs font-medium text-black/80 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-900/15 hover:text-black disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15"
            >
              {isRequestingLocation ? "Locating…" : "My location"}
            </button>
          </div>

          {showOutsideWarning ? (
            <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
              <p className="font-semibold">West Bengal only</p>
              <p className="mt-1 text-sm leading-6">
                Predictions are optimized for West Bengal. Results for locations outside West Bengal may be inefficient or less accurate.
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-3xl border border-black/10 bg-white/80 p-4 text-sm text-black/80 shadow-sm dark:border-white/15 dark:bg-sky-900/20 dark:text-white/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                  My current location
                </p>
                <p className="mt-1 text-sm text-black/75 dark:text-white/75">
                  {userLocation
                    ? "Searching using your device location." 
                    : "Tap My location to search nearby using your device coordinates."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={isRequestingLocation}
                className="rounded-2xl border border-black/10 bg-sky-200/90 px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-sky-200/95 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-sky-900/30 dark:text-white/80 dark:hover:bg-sky-900/40"
              >
                {userLocation ? "Refresh location" : "Use location"}
              </button>
            </div>
            <p className="mt-3 text-xs text-black/55 dark:text-white/55">
              {locationError
                ? locationError
                : "Use your device location for more accurate hyperlocal predictions."}
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {data ? (
        <>
          {/* Risk Map Section */}
          <RiskMapDisplay data={data} />

          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-sky-200/90 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-black/5 dark:border-white/15 dark:bg-sky-900/30 dark:ring-white/10 sm:p-6">
                <WeatherScene
                  cloudCoverPct={data.current_weather?.cloud_cover_pct ?? null}
                  showHeatEffect={data.heat_risk?.level ? normalizeSeverity(data.heat_risk.level) === "high" : false}
                  showPollutionEffect={data.air_pollution?.category ? severityFromAirCategory(data.air_pollution.category) === "high" : false}
                  showThunderEffect={data.thunderstorm != null && (safeNumber(data.thunderstorm.probability_pct) ?? 0) > 0}
                  showRainEffect={data.rain != null && (safeNumber(data.rain.probability_pct) ?? 0) > 0}
                />
                <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                    Current conditions
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold text-black/90 dark:text-white/90 sm:text-xl">
                    {data.city}
                  </div>
                  <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                    {currentInfo?.label}
                  </div>
                  {data.location ? (
                    <div className="mt-1 text-xs text-black/50 dark:text-white/50">
                      {`Lat ${data.location.lat.toFixed(2)}, Lon ${data.location.lon.toFixed(2)}`}
                    </div>
                  ) : null}
                </div>

                  <div className="rounded-2xl border border-black/10 bg-sky-200/95 p-3 shadow-sm dark:border-white/10 dark:bg-sky-900/10">
                  <WeatherIcon code={2} className="h-9 w-9 text-black/70 dark:text-white/80" />
                </div>
              </div>

              <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Temperature"
                  value={
                    safeNumber(data.current_weather?.temperature_C) === null
                      ? "—"
                      : formatTemperatureC(data.current_weather!.temperature_C)
                  }
                />
                <Metric
                  label="Humidity"
                  value={
                    safeNumber(data.current_weather?.humidity_pct) === null
                      ? "—"
                      : formatHumidityPct(data.current_weather!.humidity_pct)
                  }
                />
                <Metric
                  label="Pressure"
                  value={
                    safeNumber(data.current_weather?.pressure_hPa) === null
                      ? "—"
                      : `${Math.round(data.current_weather!.pressure_hPa)} hPa`
                  }
                />
                <Metric
                  label="Cloud cover"
                  value={
                    safeNumber(data.current_weather?.cloud_cover_pct) === null
                      ? "—"
                      : `${Math.round(data.current_weather!.cloud_cover_pct)}%`
                  }
                />
                <WindMetric
                  windSpeedMs={
                    safeNumber(data.current_weather?.wind?.speed_ms) ??
                    safeNumber(data.current_weather?.wind_speed_ms)
                  }
                  windDirectionDeg={
                    safeNumber(data.current_weather?.wind?.direction_deg) ??
                    safeNumber(data.current_weather?.wind_direction_deg)
                  }
                />
                <Metric
                  label="Dew point"
                  value={
                    safeNumber(data.current_weather?.dew_point_C) === null
                      ? "—"
                      : formatTemperatureC(data.current_weather!.dew_point_C!)
                  }
                />
                <Metric
                  label="Feels like"
                  value={
                    safeNumber(data.current_weather?.feels_like_C) === null
                      ? "—"
                      : formatTemperatureC(data.current_weather!.feels_like_C!)
                  }
                />
                <Metric
                  label="Visibility"
                  value={
                    safeNumber(data.current_weather?.visibility_km) === null
                      ? "—"
                      : `${data.current_weather!.visibility_km!.toFixed(1)} km`
                  }
                />
                <Metric
                  label="UV index"
                  value={
                    safeNumber(data.current_weather?.uv_index) === null
                      ? "—"
                      : data.current_weather!.uv_index!.toFixed(1)
                  }
                />
                <Metric
                  label="Precipitation"
                  value={
                    safeNumber(data.current_weather?.precip_mm) === null
                      ? "—"
                      : `${data.current_weather!.precip_mm!.toFixed(1)} mm`
                  }
                />
                <Metric
                  label="Solar radiation"
                  value={
                    safeNumber(data.current_weather?.solar_radiation_Wm2) === null
                      ? "—"
                      : `${data.current_weather!.solar_radiation_Wm2!.toFixed(0)} W/m²`
                  }
                />
              </div>

              <LstmForecastSection
                days={data.lstm_forecast?.next_3_days_rainfall_mm ?? []}
                probabilities={data.lstm_forecast?.next_3_days_rain_probability_pct ?? []}
                error={data.lstm_error}
                isLoading={isLoading}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-black/10 bg-white/40 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-black/5 dark:border-white/15 dark:bg-sky-900/30 dark:ring-white/10 sm:p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                Predicted risk
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <RiskRow
                  label="Rain"
                  severity={
                    safeNumber(data.rain?.probability_pct) === null
                      ? "unknown"
                      : severityFromPercent(data.rain!.probability_pct)
                  }
                  value={
                    safeNumber(data.rain?.probability_pct) === null
                      ? "—"
                      : `${data.rain!.probability_pct.toFixed(2)}% · ${data.rain?.prediction === 1 ? "Likely" : "Unlikely"}`
                  }
                />
                <RiskRow
                  label="Thunderstorm"
                  severity={
                    safeNumber(data.thunderstorm?.probability_pct) === null
                      ? "unknown"
                      : severityFromPercent(data.thunderstorm!.probability_pct)
                  }
                  value={
                    safeNumber(data.thunderstorm?.probability_pct) === null
                      ? "—"
                      : `${data.thunderstorm!.probability_pct.toFixed(2)}%`
                  }
                />
                <RiskRow
                  label="Heat risk"
                  severity={data.heat_risk?.level ? normalizeSeverity(data.heat_risk.level) : "unknown"}
                  value={
                    safeNumber(data.heat_risk?.score) === null
                      ? "—"
                      : `${data.heat_risk!.level} (score: ${data.heat_risk!.score})`
                  }
                />
                <RiskRow
                  label="Air pollution"
                  severity={data.air_pollution?.category ? severityFromAirCategory(data.air_pollution.category) : "unknown"}
                  value={
                    safeNumber(data.air_pollution?.score) === null
                      ? "—"
                      : `${data.air_pollution!.category} (score: ${data.air_pollution!.score})`
                  }
                />
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-sky-200/90 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-black/10 dark:border-white/15 dark:bg-sky-900/30 dark:ring-white/10 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                    Gas limits
                  </div>
                  <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                    Live pollutant readings with simple thresholds.
                  </div>
                </div>
                <Legend />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <GasRow name="CO" unit="µg/m³" value={safeNumber(data.air_gases?.co)} thresholds={{ greenMax: 4400, yellowMax: 9400 }} />
                <GasRow name="NO₂" unit="µg/m³" value={safeNumber(data.air_gases?.no2)} thresholds={{ greenMax: 53, yellowMax: 100 }} />
                <GasRow name="O₃" unit="µg/m³" value={safeNumber(data.air_gases?.o3)} thresholds={{ greenMax: 100, yellowMax: 160 }} />
                <GasRow name="SO₂" unit="µg/m³" value={safeNumber(data.air_gases?.so2)} thresholds={{ greenMax: 35, yellowMax: 75 }} />
                <GasRow name="PM2.5" unit="µg/m³" value={safeNumber(data.air_gases?.pm2_5)} thresholds={{ greenMax: 12, yellowMax: 35.4 }} />
                <GasRow name="PM10" unit="µg/m³" value={safeNumber(data.air_gases?.pm10)} thresholds={{ greenMax: 54, yellowMax: 154 }} />
              </div>

              {data.aqi_prediction ? (
                <div className="mt-5 rounded-[2rem] border border-black/10 bg-sky-200/90 p-6 shadow-[0_14px_60px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_68px_rgba(0,0,0,0.14)] dark:border-white/15 dark:bg-sky-900/30 motion-safe:animate-pulse">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50 dark:text-white/50">AQI model</div>
                  <div className="mt-2">
                    {(() => {
                      const aqiVal = safeNumber(data.aqi_prediction!.aqi);
                      const aqiCat = data.aqi_prediction!.category ?? "Unknown";
                      const sev = severityFromAirCategory(aqiCat);
                      const styles = severityClasses(sev);
                      return (
                        <div className={["flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 shadow-sm transition", styles.border, styles.bg].join(" ")}>
                          <div>
                            <div className="text-sm font-semibold text-black/80 dark:text-white/85">{aqiCat}</div>
                            <div className="mt-1 text-xs text-black/60 dark:text-white/60">AQI: {aqiVal === null ? "—" : Math.round(aqiVal)}</div>
                          </div>
                          <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", styles.badge].join(" ")}>
                            {sev === "unknown" ? "—" : sev}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-black/10 bg-sky-200/90 p-10 text-center text-sm text-black/60 shadow-sm backdrop-blur dark:border-white/15 dark:bg-sky-900/15 dark:text-white/50">
          <div className="mx-auto max-w-md">
            <div className="text-sm font-medium text-black/70 dark:text-white/70">Ready when you are.</div>
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              Try “Kolkata” or click a quick city chip above.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-sky-200/95 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-black/15 hover:bg-sky-200/95 hover:shadow-md dark:border-white/15 dark:bg-sky-900/25 dark:hover:border-white/25 dark:hover:bg-sky-900/35">
      <div className="text-[11px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-black/80 dark:text-white/85">{value}</div>
    </div>
  );
}

function directionCompassLabel(deg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(deg / 45) % 8];
}

function WindMetric({
  windSpeedMs,
  windDirectionDeg,
}: {
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
}) {
  const speed = windSpeedMs === null ? null : Math.max(0, windSpeedMs);
  const kmh = speed === null ? null : speed * 3.6;
  const dir = windDirectionDeg === null ? null : ((windDirectionDeg % 360) + 360) % 360;
  const label = dir === null ? "—" : directionCompassLabel(dir);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-sky-200/95 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-black/15 hover:bg-sky-300/95 hover:shadow-md dark:border-white/15 dark:bg-sky-900/25 dark:hover:border-white/25 dark:hover:bg-sky-900/35">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">Wind</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-black/80 dark:text-white/85">
            {kmh === null ? "—" : `${kmh.toFixed(1)} km/h`}
          </div>
          <div className="text-xs text-black/45 dark:text-white/45">
            {dir === null ? "No data" : `${label} • ${Math.round(dir)}°`}
          </div>
        </div>

        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-sky-200/80 text-sky-900/70 shadow-sm dark:border-white/15 dark:bg-sky-900/10 dark:text-white/70">
          <span className="absolute top-2 text-[10px] text-black/50 dark:text-white/50">N</span>
          <span className="absolute right-2 text-[10px] text-black/50 dark:text-white/50">E</span>
          <span className="absolute bottom-2 text-[10px] text-black/50 dark:text-white/50">S</span>
          <span className="absolute left-2 text-[10px] text-black/50 dark:text-white/50">W</span>

          <span
            className="ws-wind-sway inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600/15 text-xl text-sky-900 dark:bg-white/10 dark:text-white/80"
            style={dir === null ? undefined : ({ ["--wind-deg" as never]: `${dir}deg` } as React.CSSProperties)}
            aria-hidden="true"
          >
            ▲
          </span>
        </div>
      </div>
    </div>
  );
}

function RiskRow({ label, value, severity }: { label: string; value: string; severity: RiskSeverity }) {
  const c = severityClasses(severity);
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        c.border,
        c.bg,
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div className={["text-xs font-medium uppercase tracking-wide", c.text].join(" ")}>{label}</div>
        <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", c.badge].join(" ")}>
          {severity === "unknown" ? "—" : severity}
        </span>
      </div>
      <div className={["text-sm font-semibold tabular-nums", c.text].join(" ")}>{value}</div>
    </div>
  );
}

type SceneVariant = "sunrise" | "noon" | "sunset" | "cloudy" | "night";

function pickSceneVariant(cloudCoverPct: number | null): SceneVariant {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 20;
  if (isNight) return "night";

  const isSunrise = hour >= 6 && hour < 9;
  const isNoon = hour >= 11 && hour < 15;
  const isSunset = hour >= 17 && hour < 20;

  if (cloudCoverPct !== null && cloudCoverPct >= 60) return "cloudy";
  if (isSunrise) return "sunrise";
  if (isSunset) return "sunset";
  if (isNoon) return "noon";
  return "noon";
}

function WeatherScene({
  cloudCoverPct,
  showHeatEffect,
  showPollutionEffect,
  showThunderEffect,
  showRainEffect,
}: {
  cloudCoverPct: number | null;
  showHeatEffect?: boolean;
  showPollutionEffect?: boolean;
  showThunderEffect?: boolean;
  showRainEffect?: boolean;
}) {
  const variant = pickSceneVariant(cloudCoverPct);

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* soft overlay so content stays readable */}
      <div className="absolute inset-0 bg-linear-to-b from-white/55 via-white/20 to-transparent dark:from-black/40 dark:via-black/10" />

      {variant === "sunrise" ? (
        <>
          <div className="absolute inset-0 bg-linear-to-r from-orange-400/12 via-rose-400/10 to-sky-400/10 dark:from-orange-300/10 dark:via-fuchsia-300/8 dark:to-sky-300/8" />
          <div className="ws-float absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-orange-300/25 blur-3xl dark:bg-orange-300/14" />
          <div className="absolute bottom-12 left-10 flex h-28 w-28 items-center justify-center rounded-full bg-orange-300/20 shadow-[0_0_80px_rgba(251,146,60,0.25)] dark:bg-orange-300/12">
            <div className="ws-sun-halo absolute inset-0 rounded-full bg-white/10" />
            <div className="ws-sun-pulse relative h-16 w-16 rounded-full bg-orange-300 shadow-[0_0_50px_rgba(251,146,60,0.35)]" />
          </div>
          <div className="absolute bottom-6 left-12 h-40 w-40 animate-sun-ray-slow rounded-full border border-orange-300/20 dark:border-orange-200/10" />
          <div className="absolute bottom-8 left-14 h-36 w-36 animate-sun-ray rounded-full border border-orange-300/25 dark:border-orange-200/15" />
        </>
      ) : null}

      {variant === "noon" ? (
        <>
          <div className="absolute inset-0 bg-linear-to-r from-sky-400/10 via-blue-400/8 to-fuchsia-400/8 dark:from-sky-300/10 dark:via-blue-300/8 dark:to-fuchsia-300/8" />
          <div className="ws-float absolute -top-12 -right-12 h-44 w-44 rounded-full bg-amber-300/22 blur-3xl dark:bg-amber-300/14" />
          <div className="absolute top-8 right-12 flex h-24 w-24 items-center justify-center rounded-full bg-amber-300/30 shadow-[0_0_90px_rgba(251,191,36,0.30)] dark:bg-amber-200/15">
            <div className="ws-sun-halo absolute inset-0 rounded-full bg-white/10" />
            <div className="ws-sun-pulse relative h-14 w-14 rounded-full bg-amber-300 shadow-[0_0_70px_rgba(251,191,36,0.45)]" />
          </div>
          <div className="absolute top-4 right-10 h-40 w-40 animate-sun-ray-slow rounded-full border border-amber-300/20 dark:border-amber-200/10" />
          <div className="absolute top-6 right-10 h-32 w-32 animate-sun-ray rounded-full border border-amber-300/20 dark:border-amber-200/15" />
        </>
      ) : null}

      {variant === "sunset" ? (
        <>
          <div className="absolute inset-0 bg-linear-to-l from-fuchsia-500/10 via-rose-500/10 to-amber-400/12 dark:from-fuchsia-300/10 dark:via-rose-300/10 dark:to-amber-300/10" />
          <div className="ws-float absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-rose-400/18 blur-3xl dark:bg-rose-300/12" />
          <div className="absolute bottom-12 right-10 flex h-20 w-20 items-center justify-center rounded-full bg-rose-300/20 shadow-[0_0_75px_rgba(244,63,94,0.22)] dark:bg-rose-300/12">
            <div className="ws-sun-halo absolute inset-0 rounded-full bg-white/10" />
            <div className="ws-sun-pulse relative h-12 w-12 rounded-full bg-amber-300 shadow-[0_0_55px_rgba(244,63,94,0.25)]" />
          </div>
          <div className="absolute bottom-6 right-8 h-34 w-34 animate-sun-ray-slow rounded-full border border-rose-300/20 dark:border-rose-200/10" />
          <div className="absolute bottom-8 right-8 h-28 w-28 animate-sun-ray rounded-full border border-rose-300/20 dark:border-rose-200/15" />
        </>
      ) : null}

      {variant === "cloudy" ? (
        <>
          <Cloud className="ws-cloud-drift-1 absolute top-10 -left-40 opacity-70" />
          <Cloud className="ws-cloud-drift-2 absolute top-20 -left-64 opacity-55" />
          <Cloud className="ws-cloud-drift-3 absolute top-2 -left-80 opacity-35 scale-75" />
          <div className="absolute inset-0 bg-linear-to-b from-slate-100/10 via-slate-200/5 to-transparent dark:from-slate-900/30 dark:via-slate-900/10 dark:to-transparent" />
        </>
      ) : null}

      {variant === "night" ? (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-indigo-950/30 via-transparent to-transparent dark:from-indigo-950/35" />
          <Star className="ws-twinkle absolute top-10 left-10 opacity-70" />
          <Star className="ws-twinkle absolute top-16 left-1/2 opacity-50 [animation-delay:700ms]" />
          <Star className="ws-twinkle absolute top-6 right-24 opacity-60 [animation-delay:1200ms]" />
          <Star className="ws-twinkle absolute top-28 right-10 opacity-40 [animation-delay:1600ms]" />
          <Star className="ws-twinkle absolute top-36 left-24 opacity-45 [animation-delay:2000ms]" />
          <div className="ws-float absolute -top-16 -right-12 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

          {/* falling stars (meteors) */}
          <div className="absolute inset-0 opacity-80 mix-blend-screen">
            <Meteor className="ws-meteor absolute top-8 right-10 [animation-delay:900ms]" />
            <Meteor className="ws-meteor absolute top-20 right-24 opacity-70 [animation-delay:2600ms]" />
            <Meteor className="ws-meteor absolute top-2 right-36 opacity-60 [animation-delay:4200ms]" />
            <Meteor className="ws-meteor absolute top-28 right-2 opacity-55 [animation-delay:6100ms]" />
          </div>
        </>
      ) : null}

      {showHeatEffect ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="ws-heat-wave absolute left-10 top-10 h-52 w-52 rounded-full border border-amber-300/30 shadow-[0_0_40px_rgba(251,191,36,0.18)]" />
          <div className="absolute left-14 top-16 h-1.5 w-32 rounded-full bg-amber-200/30 blur-xl" />
        </div>
      ) : null}

      {showPollutionEffect ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="ws-dust-flow absolute top-16 left-[4%] h-2 w-28 rounded-full bg-amber-200/40 blur-sm" />
          <div className="ws-dust-flow absolute top-24 left-[18%] h-2 w-32 rounded-full bg-amber-200/35 blur-sm [animation-delay:1.4s]" />
          <div className="ws-dust-flow absolute top-10 left-[34%] h-2 w-24 rounded-full bg-amber-200/30 blur-sm [animation-delay:0.8s]" />
          <div className="absolute top-8 left-[18%] h-14 w-14 rounded-full bg-amber-200/12 blur-3xl" />
          <div className="absolute top-22 left-[42%] h-12 w-24 rounded-full bg-amber-200/10 blur-3xl" />
        </div>
      ) : null}

      {showThunderEffect ? (
        <div className="pointer-events-none absolute inset-0">
          <Cloud className="ws-cloud-drift-fast absolute top-8 left-4 opacity-85 scale-95" />
          <Cloud className="ws-cloud-drift-fast absolute top-20 left-24 opacity-80 scale-90" />
          <svg className="ws-lightning absolute left-[54%] top-14 h-24 w-12 opacity-90" viewBox="0 0 24 40" fill="none" stroke="rgba(30,144,255,1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 0 L16 14 L12 14 L18 40" />
          </svg>
        </div>
      ) : null}

      {showRainEffect ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <RainDrop className="absolute left-[10%] top-[-10%]" style={{ animationDelay: "0s" }} />
          <RainDrop className="absolute left-[22%] top-[-20%]" style={{ animationDelay: "0.2s" }} />
          <RainDrop className="absolute left-[34%] top-[-5%]" style={{ animationDelay: "0.4s" }} />
          <RainDrop className="absolute left-[46%] top-[-15%]" style={{ animationDelay: "0.6s" }} />
          <RainDrop className="absolute left-[58%] top-[-8%]" style={{ animationDelay: "0.9s" }} />
          <RainDrop className="absolute left-[70%] top-[-18%]" style={{ animationDelay: "1.1s" }} />
        </div>
      ) : null}
    </div>
  );
}

function Cloud({ className }: { className?: string }) {
  return (
    <div className={["h-16 w-44", className ?? ""].join(" ")}>
      <div className="relative h-full w-full">
        <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-white/50 blur-[0.5px] dark:bg-white/15" />
        <div className="absolute left-14 top-2 h-12 w-12 rounded-full bg-white/55 blur-[0.5px] dark:bg-white/18" />
        <div className="absolute left-26 top-7 h-9 w-9 rounded-full bg-white/45 blur-[0.5px] dark:bg-white/14" />
        <div className="absolute left-10 top-8 h-10 w-28 rounded-full bg-white/55 blur-[0.5px] dark:bg-white/18" />
      </div>
    </div>
  );
}

function Star({ className }: { className?: string }) {
  return <div className={["h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.35)]", className ?? ""].join(" ")} />;
}

function Meteor({ className }: { className?: string }) {
  return (
    <div className={['h-0.5 w-28 origin-top-right rotate-[-20deg] blur-[0.2px]', className ?? ''].join(' ')}>
      <div className="h-full w-full rounded-full bg-linear-to-l from-white/0 via-white/60 to-white/95 shadow-[0_0_22px_rgba(255,255,255,0.22)]" />
    </div>
  );
}

function RainDrop({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={['ws-rain-drop h-14 w-0.5 rounded-full bg-blue-400/70 dark:bg-blue-200/60 blur-sm', className ?? ''].join(' ')} style={style} />;
}

type GasThresholds = { greenMax: number; yellowMax: number };
type GasBand = "green" | "yellow" | "red" | "unknown";

function gasBand(value: number | null, thresholds: GasThresholds): GasBand {
  if (value === null) return "unknown";
  if (value <= thresholds.greenMax) return "green";
  if (value <= thresholds.yellowMax) return "yellow";
  return "red";
}

function bandStyles(band: GasBand) {
  switch (band) {
    case "green":
      return {
        dot: "bg-emerald-700",
        pill: "bg-emerald-700/25 text-emerald-950 dark:bg-emerald-400/25 dark:text-emerald-100",
        row: "border-emerald-700/30 dark:border-emerald-400/30",
      };
    case "yellow":
      return {
        dot: "bg-amber-700",
        pill: "bg-amber-700/25 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100",
        row: "border-amber-700/30 dark:border-amber-400/30",
      };
    case "red":
      return {
        dot: "bg-rose-700",
        pill: "bg-rose-700/25 text-rose-950 dark:bg-rose-400/25 dark:text-rose-100",
        row: "border-rose-700/30 dark:border-rose-400/30",
      };
    default:
      return {
        dot: "bg-sky-1000/30 dark:bg-white/25",
        pill: "bg-sky-1000/10 text-sky-900/70 dark:bg-white/10 dark:text-white/70",
        row: "border-black/5 dark:border-white/10",
      };
  }
}

function GasRow({
  name,
  value,
  unit,
  thresholds,
}: {
  name: string;
  value: number | null;
  unit: string;
  thresholds: GasThresholds;
}) {
  const band = gasBand(value, thresholds);
  const s = bandStyles(band);

  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-sky-200/95 px-3 py-2 shadow-sm dark:bg-sky-900/20",
        s.row,
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={["h-2.5 w-2.5 shrink-0 rounded-full", s.dot].join(" ")} aria-hidden="true" />
        <div className="min-w-0 text-xs font-semibold tracking-wide text-black/75 dark:text-white/80">{name}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s.pill].join(" ")}>
          {band === "unknown" ? "—" : band}
        </span>
        <div className="text-sm font-semibold tabular-nums text-black/80 dark:text-white/85">
          {value === null ? "—" : value.toFixed(2)}{" "}
          <span className="text-xs font-medium text-black/45 dark:text-white/45">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-black/70 dark:text-white/70">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-700" aria-hidden="true" />
        Green
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-700" aria-hidden="true" />
        Yellow
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-rose-700" aria-hidden="true" />
        Red
      </span>
    </div>
  );
}

type MapRiskState = {
  label: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  animation: string;
  markerColor: string;
};

function getRiskMapStates(data: PredictResponse): MapRiskState[] {
  const heatSeverity = data.heat_risk?.level ? normalizeSeverity(data.heat_risk.level) : "unknown";
  const pollutionSeverity = data.air_pollution?.category ? severityFromAirCategory(data.air_pollution.category) : "unknown";
  const thunderPct = safeNumber(data.thunderstorm?.probability_pct) ?? 0;
  const thunderstormAlert = thunderPct > 60;

  const states: MapRiskState[] = [];

  if (heatSeverity === "high") {
    states.push({
      label: "Extreme red",
      title: "High heat risk",
      description: "Heat danger is highest. Take cooling and hydration precautions.",
      accent: "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100",
      icon: "🔥",
      animation: "risk-map-red",
      markerColor: "#ef4444",
    });
  } else if (heatSeverity === "med") {
    states.push({
      label: "Orange",
      title: "Moderate heat",
      description: "Heat risk is elevated. Limit strenuous outdoor activity.",
      accent: "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-100",
      icon: "☀️",
      animation: "risk-map-orange",
      markerColor: "#ea580c",
    });
  }

  if (thunderstormAlert) {
    states.push({
      label: "Thunderstorm",
      title: "Thunderstorm likely",
      description: "Storm probability is above 60%. Expect strong clouds and lightning.",
      accent: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
      icon: "⚡",
      animation: "risk-map-blue",
      markerColor: "#3fc3f4",
    });
  }

  if (pollutionSeverity === "high") {
    states.push({
      label: "Yellow",
      title: "High pollution",
      description: "Air quality is poor. Wear a mask and avoid long outdoor exposure.",
      accent: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      icon: "🌫️",
      animation: "risk-map-yellow",
      markerColor: "#eab308",
    });
  } else if (pollutionSeverity === "med") {
    states.push({
      label: "Brown",
      title: "Moderate pollution",
      description: "Air pollution is moderate. Sensitive groups should take care.",
      accent: "border-amber-700/30 bg-amber-700/10 text-amber-950 dark:text-amber-100",
      icon: "🟤",
      animation: "risk-map-brown",
      markerColor: "#b45309",
    });
  }

  if (states.length === 0) {
    return [
      {
        label: "Green",
        title: "No major risks",
        description: "Current conditions are stable with no major threats detected.",
        accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        icon: "✅",
        animation: "risk-map-green",
        markerColor: "#10b981",
      },
    ];
  }

  return states;
}

function RiskMap({ lat, lon, riskStates }: { lat: number; lon: number; riskStates: MapRiskState[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{
    remove: () => void;
  } | null>(null);

  useEffect(() => {
    if (!mapRef.current || !lat || !lon) return;

    // Dynamically import leaflet only in the browser
    import("leaflet").then((L) => {
      // Clean up existing map if it exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Clear the container to remove any previous leaflet elements
      if (mapRef.current) {
        mapRef.current.innerHTML = "";
      }

      // Reset CSS if needed
      const leafletCSS = document.getElementById("leaflet-css");
      if (!leafletCSS) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
        document.head.appendChild(link);
      }

      if (!mapRef.current) return;

      try {
        const map = L.map(mapRef.current).setView([lat, lon], 12);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const positionOffsets: [number, number][] = [
          [0, 0],
          [0.018, 0.018],
          [0.018, -0.018],
          [-0.018, 0.018],
          [-0.018, -0.018],
        ];

        riskStates.forEach((risk, index) => {
          const [latOffset, lonOffset] = positionOffsets[index] ?? [0, 0];
          const marker = L.circleMarker([lat + latOffset, lon + lonOffset], {
            radius: 18,
            fillColor: risk.markerColor,
            color: risk.markerColor,
            weight: 2,
            opacity: 0.85,
            fillOpacity: 0.75,
          }).addTo(map);

          marker.bindPopup(
            `<div class="text-sm font-medium">${risk.title}</div><div class="text-xs text-gray-600 mt-1">${risk.description}</div>`
          );
        });

        mapInstanceRef.current = map;
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    });

    return () => {
      // Cleanup map on unmount or when dependencies change
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lon, riskStates]);

  return <div ref={mapRef} className="h-96 w-full rounded-2xl border border-black/10 shadow-md" />;
}

function RiskMapDisplay({ data }: { data: PredictResponse }) {
  const riskStates = useMemo(() => getRiskMapStates(data), [data]);
  const lat = data.location?.lat ?? 0;
  const lon = data.location?.lon ?? 0;

  if (!lat || !lon) return null;

  return (
    <section className="rounded-3xl border border-black/10 bg-white/40 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-black/5 dark:border-white/15 dark:bg-sky-900/30 dark:ring-white/10 sm:p-6">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
            Risk visualization map
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {riskStates.map((risk) => (
              <span
                key={risk.title}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${risk.accent}`}
              >
                <span>{risk.icon}</span>
                {risk.title}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {riskStates.map((risk) => (
            <div key={risk.title} className={`rounded-3xl border px-4 py-3 shadow-sm ${risk.accent}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{risk.icon}</span>
                <span>{risk.title}</span>
              </div>
              <p className="mt-2 text-xs text-black/70 dark:text-white/70">{risk.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <RiskMap lat={lat} lon={lon} riskStates={riskStates} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-black/10 bg-sky-200/80 p-3 text-center dark:border-white/10 dark:bg-sky-900/20">
          <div className="text-xs font-medium text-black/60 dark:text-white/60">Heat Risk</div>
          <div className="mt-1 text-sm font-semibold text-black/80 dark:text-white/80">
            {data.heat_risk?.level ?? "—"}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">{data.heat_risk?.score ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-black/10 bg-sky-200/80 p-3 text-center dark:border-white/10 dark:bg-sky-900/20">
          <div className="text-xs font-medium text-black/60 dark:text-white/60">Thunderstorm</div>
          <div className="mt-1 text-sm font-semibold text-black/80 dark:text-white/80">
            {safeNumber(data.thunderstorm?.probability_pct) === null
              ? "—"
              : `${data.thunderstorm!.probability_pct.toFixed(0)}%`}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">Probability</div>
        </div>
        <div className="rounded-lg border border-black/10 bg-sky-200/80 p-3 text-center dark:border-white/10 dark:bg-sky-900/20">
          <div className="text-xs font-medium text-black/60 dark:text-white/60">Pollution</div>
          <div className="mt-1 text-sm font-semibold text-black/80 dark:text-white/80">
            {data.air_pollution?.category ?? "—"}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">{data.air_pollution?.score ?? "—"}</div>
        </div>
      </div>
    </section>
  );
}

function getRainfallSeverity(rainfall: number): RiskSeverity {
  if (rainfall < 2.5) return "low";
  if (rainfall < 10) return "med";
  return "high";
}

function lstmDayLabel(index: number): string {
  const labels = ["Day 1", "Day 2", "Day 3"];
  return labels[index] ?? `Day ${index + 1}`;
}

function LstmForecastSection({
  days,
  probabilities,
  error,
  isLoading,
}: {
  days: number[];
  probabilities: number[];
  error?: string;
  isLoading: boolean;
}) {
  const avgChance =
    probabilities.length > 0 ? probabilities.reduce((sum, pct) => sum + pct, 0) / probabilities.length : null;
  const avgRainfall = days.length > 0 ? days.reduce((sum, rainfall) => sum + rainfall, 0) / days.length : null;
  const forecastCount = Math.max(days.length, probabilities.length);

  return (
    <div className="relative z-10 mt-6 overflow-hidden rounded-3xl border border-indigo-500/15 bg-linear-to-br from-indigo-500/10 via-sky-200/90 to-sky-100/90 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] ring-1 ring-indigo-500/10 backdrop-blur-md dark:border-indigo-400/20 dark:from-indigo-500/15 dark:via-sky-900/40 dark:to-sky-950/30 dark:ring-indigo-400/15 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full bg-indigo-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:bg-indigo-400/20 dark:text-indigo-100">
              LSTM
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
              3-day rainfall forecast
            </span>
          </div>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            LSTM-predicted rainfall amount and rain chance for the next three days.
          </p>
        </div>
        {avgChance !== null || avgRainfall !== null ? (
          <div className="flex gap-2">
            {avgRainfall !== null ? (
              <div className="rounded-2xl border border-black/10 bg-white/60 px-3 py-2 text-right dark:border-white/15 dark:bg-white/5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                  Avg rain
                </div>
                <div className="text-lg font-bold tabular-nums text-sky-950 dark:text-sky-100">
                  {avgRainfall.toFixed(1)} mm
                </div>
              </div>
            ) : null}
            {avgChance !== null ? (
              <div className="rounded-2xl border border-black/10 bg-white/60 px-3 py-2 text-right dark:border-white/15 dark:bg-white/5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                  Avg chance
                </div>
                <div className="text-lg font-bold tabular-nums text-sky-950 dark:text-sky-100">
                  {avgChance.toFixed(0)}%
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-black/10 bg-sky-200/70 dark:border-white/10 dark:bg-sky-900/25"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-medium">LSTM forecast unavailable</p>
          <p className="mt-1 text-xs opacity-90">{error}</p>
        </div>
      ) : forecastCount === 0 ? (
        <div className="mt-5 rounded-2xl border border-black/10 bg-sky-200/95 p-4 text-center text-sm text-black/60 dark:border-white/15 dark:bg-sky-900/20 dark:text-white/60">
          <p>No LSTM forecast data in this response.</p>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Point the frontend at an API build that loads{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">weather_lstm_model.keras</code>.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: forecastCount }, (_, index) => (
            <RainfallCard
              key={index}
              dayLabel={lstmDayLabel(index)}
              rainfall={days[index]}
              rainProbabilityPct={probabilities[index]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RainfallCard({
  dayLabel,
  rainfall,
  rainProbabilityPct,
}: {
  dayLabel: string;
  rainfall?: number;
  rainProbabilityPct?: number;
}) {
  const rainfallSeverity = rainfall === undefined ? null : getRainfallSeverity(rainfall);
  const likely = rainProbabilityPct !== undefined && isRainLikely(rainProbabilityPct);
  const c = severityClasses(likely ? "high" : rainfallSeverity ?? "unknown");

  return (
    <div
      className={[
        "flex min-h-36 flex-col rounded-2xl border px-3 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        c.border,
        c.bg,
      ].join(" ")}
    >
      <div className={["text-xs font-semibold uppercase tracking-wide", c.text].join(" ")}>
        {dayLabel}
      </div>

      <div className="mt-3 flex items-end gap-1">
        <span className={["text-4xl font-bold tabular-nums leading-none", c.text].join(" ")}>
          {rainfall === undefined ? "—" : rainfall.toFixed(1)}
        </span>
        <span className={["pb-1 text-xs font-semibold", c.text].join(" ")}>mm</span>
      </div>
      <div className={["mt-1 text-[10px] font-medium uppercase tracking-wide", c.text].join(" ")}>
        Predicted rainfall
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", c.badge].join(" ")}>
          {rainfallSeverity ?? "unknown"}
        </span>
        <span className={["text-sm font-bold tabular-nums", c.text].join(" ")}>
          {rainProbabilityPct === undefined ? "—" : `${rainProbabilityPct.toFixed(0)}%`}
        </span>
      </div>
      <div className={["mt-1 text-[10px] font-medium uppercase tracking-wide", c.text].join(" ")}>
        Rain chance
      </div>
    </div>
  );
}

