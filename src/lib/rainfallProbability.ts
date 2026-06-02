/** Matches api/main.py rainfall_mm_to_probability_pct (rain_threshold ≈ 65% at ~3 mm). */
export function rainfallMmToProbabilityPct(mm: number): number {
  const value = Math.max(0, mm);
  if (value < 0.05) return 8;
  const prob = 100 / (1 + Math.exp(-0.85 * (value - 2.8)));
  return Math.round(Math.min(99, Math.max(8, prob)) * 100) / 100;
}

export function probabilityPctToRainfallMm(probabilityPct: number): number {
  const pct = Math.min(99, Math.max(8, probabilityPct));
  if (pct <= 8) return 0;

  const ratio = pct / 100;
  const mm = 2.8 + Math.log(ratio / (1 - ratio)) / 0.85;
  return Math.round(Math.max(0, mm) * 100) / 100;
}

export function buildLstmRainProbabilities(
  mmDays: number[],
  todayRainPct?: number,
): number[] {
  return mmDays.map((mm, index) => {
    let pct = rainfallMmToProbabilityPct(mm);
    if (index === 0 && todayRainPct !== undefined && Number.isFinite(todayRainPct)) {
      pct = Math.round((0.55 * todayRainPct + 0.45 * pct) * 100) / 100;
    }
    return pct;
  });
}

/** Same 0.65 cutoff as rain_threshold in the API rain classifier. */
export function isRainLikely(probabilityPct: number): boolean {
  return probabilityPct >= 65;
}
