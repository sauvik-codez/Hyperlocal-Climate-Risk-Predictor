export function formatTemperatureC(value: number): string {
  const rounded = Math.round(value);
  return `${rounded}°C`;
}

export function formatPrecipMm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} mm`;
}

export function formatWindKmh(value: number): string {
  const rounded = Math.round(value);
  return `${rounded} km/h`;
}

export function formatHumidityPct(value: number): string {
  const rounded = Math.round(value);
  return `${rounded}%`;
}

export function formatDayShort(isoDate: string, timeZone?: string | null): string {
  const dt = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone: timeZone ?? undefined,
  }).format(dt);
}

