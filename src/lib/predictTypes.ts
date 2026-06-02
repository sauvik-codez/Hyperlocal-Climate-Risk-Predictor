export type PredictPayload = {
  city: string;
  resolved_location?: {
    name: string;
    region: string;
    country: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
  current_weather?: {
    temperature_C: number;
    feels_like_C?: number;
    humidity_pct: number;
    pressure_hPa: number;
    cloud_cover_pct: number;
    wind?: {
      speed_ms?: number;
      direction_deg?: number;
    };
    wind_speed_ms?: number;
    wind_direction_deg?: number;
    dew_point_C?: number;
    visibility_km?: number;
    uv_index?: number;
    precip_mm?: number;
    solar_radiation_Wm2?: number;
  };
  rain?: {
    probability_pct: number;
    prediction: number;
  };
  thunderstorm?: {
    probability_pct: number;
  };
  heat_risk?: {
    score: number;
    level: string;
  };
  air_pollution?: {
    score: number;
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
  aqi_prediction?: {
    aqi: number;
    category: string;
  };
  lstm_forecast?: {
    next_3_days_rainfall_mm: number[];
    next_3_days_rain_probability_pct: number[];
  };
  lstm_error?: string;
};
