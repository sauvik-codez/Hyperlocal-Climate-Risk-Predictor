export type WeatherCodeInfo = {
  label: string;
  category:
    | "clear"
    | "clouds"
    | "fog"
    | "drizzle"
    | "rain"
    | "snow"
    | "thunder"
    | "unknown";
};

// Open-Meteo weather codes (WMO interpretation)
// https://open-meteo.com/en/docs
export function getWeatherCodeInfo(code: number): WeatherCodeInfo {
  switch (code) {
    case 0:
      return { label: "Clear sky", category: "clear" };
    case 1:
      return { label: "Mainly clear", category: "clear" };
    case 2:
      return { label: "Partly cloudy", category: "clouds" };
    case 3:
      return { label: "Overcast", category: "clouds" };
    case 45:
    case 48:
      return { label: "Fog", category: "fog" };
    case 51:
    case 53:
    case 55:
      return { label: "Drizzle", category: "drizzle" };
    case 56:
    case 57:
      return { label: "Freezing drizzle", category: "drizzle" };
    case 61:
    case 63:
    case 65:
      return { label: "Rain", category: "rain" };
    case 66:
    case 67:
      return { label: "Freezing rain", category: "rain" };
    case 71:
    case 73:
    case 75:
      return { label: "Snow fall", category: "snow" };
    case 77:
      return { label: "Snow grains", category: "snow" };
    case 80:
    case 81:
    case 82:
      return { label: "Rain showers", category: "rain" };
    case 85:
    case 86:
      return { label: "Snow showers", category: "snow" };
    case 95:
      return { label: "Thunderstorm", category: "thunder" };
    case 96:
    case 99:
      return { label: "Thunderstorm with hail", category: "thunder" };
    default:
      return { label: "Unknown", category: "unknown" };
  }
}

