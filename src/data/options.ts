import type { CoachTheme, MotionIntensity, TimeOfDay, TimePalette, Weather, WeatherProfile } from "../types";

export const coachThemes: CoachTheme[] = [
  {
    id: "sleeper",
    label: "Sleeper-style",
    shortLabel: "Sleeper",
    description: "Soft blue vinyl, practical rails, gentle overnight sway.",
    speed: 0.92,
    sway: 1.08,
    vibration: 0.9,
    palette: {
      cabin: "#314d68",
      cabinDeep: "#162738",
      trim: "#cad7dc",
      trimSoft: "#91aebd",
      cloth: "#1c6f86",
      metal: "#b8c8cd",
      highlight: "#e7f3f5"
    }
  },
  {
    id: "first",
    label: "First-class",
    shortLabel: "First",
    description: "Warm wood, muted brass, quieter suspension.",
    speed: 0.82,
    sway: 0.72,
    vibration: 0.55,
    palette: {
      cabin: "#3b281f",
      cabinDeep: "#1b100c",
      trim: "#c79c66",
      trimSoft: "#8f6b45",
      cloth: "#572d2a",
      metal: "#bca178",
      highlight: "#f5d9a7"
    }
  },
  {
    id: "chair",
    label: "Chair car",
    shortLabel: "Chair",
    description: "Clean daylight coach, compact frame, lively rhythm.",
    speed: 1.02,
    sway: 0.82,
    vibration: 0.78,
    palette: {
      cabin: "#d7dce0",
      cabinDeep: "#6b747b",
      trim: "#426170",
      trimSoft: "#93a5ad",
      cloth: "#345f76",
      metal: "#e6ecef",
      highlight: "#ffffff"
    }
  },
  {
    id: "luggage",
    label: "Luggage-view",
    shortLabel: "Luggage",
    description: "Utility metal, guard-van edges, rougher track feel.",
    speed: 0.88,
    sway: 1.28,
    vibration: 1.24,
    palette: {
      cabin: "#48504a",
      cabinDeep: "#1b211d",
      trim: "#aeb6a9",
      trimSoft: "#7f8a7a",
      cloth: "#6f5b3d",
      metal: "#c9d0c1",
      highlight: "#f0f2dc"
    }
  },
  {
    id: "vande",
    label: "Modern premium",
    shortLabel: "Vande",
    description: "Bright modern shell, blue accents, smooth express glide.",
    speed: 1.16,
    sway: 0.54,
    vibration: 0.42,
    palette: {
      cabin: "#f3f7fa",
      cabinDeep: "#314453",
      trim: "#0d64b2",
      trimSoft: "#93badf",
      cloth: "#142d47",
      metal: "#dce8f0",
      highlight: "#ffffff"
    }
  }
];

export const weatherProfiles: Record<Weather, WeatherProfile> = {
  sunny: {
    label: "Sunny",
    visibility: 1,
    cloudCover: 0.18,
    precipitation: 0,
    wind: 0.42,
    tint: "rgba(255, 211, 125, 0.08)"
  },
  cloudy: {
    label: "Cloudy",
    visibility: 0.86,
    cloudCover: 0.72,
    precipitation: 0,
    wind: 0.5,
    tint: "rgba(168, 190, 202, 0.16)"
  },
  rainy: {
    label: "Rainy",
    visibility: 0.72,
    cloudCover: 0.88,
    precipitation: 0.74,
    wind: 0.78,
    tint: "rgba(86, 123, 150, 0.26)"
  },
  stormy: {
    label: "Stormy",
    visibility: 0.58,
    cloudCover: 0.98,
    precipitation: 0.96,
    wind: 1,
    tint: "rgba(42, 57, 86, 0.42)"
  },
  foggy: {
    label: "Foggy",
    visibility: 0.46,
    cloudCover: 0.64,
    precipitation: 0.08,
    wind: 0.24,
    tint: "rgba(216, 224, 219, 0.46)"
  },
  snowy: {
    label: "Snowy",
    visibility: 0.7,
    cloudCover: 0.82,
    precipitation: 0.62,
    wind: 0.48,
    tint: "rgba(234, 246, 255, 0.34)"
  }
};

export const timePalettes: Record<TimeOfDay, TimePalette> = {
  dawn: {
    skyTop: "#253559",
    skyMid: "#806a84",
    horizon: "#f2a879",
    groundTint: "#617b76",
    shadow: "#17223d",
    light: "#ffd39c",
    accent: "#f5b38d",
    starAlpha: 0.18,
    lampAlpha: 0.35
  },
  sunrise: {
    skyTop: "#43638d",
    skyMid: "#ee9d83",
    horizon: "#ffd29d",
    groundTint: "#7f956f",
    shadow: "#3c4162",
    light: "#ffe2aa",
    accent: "#ff9467",
    starAlpha: 0,
    lampAlpha: 0.18
  },
  morning: {
    skyTop: "#70a8d6",
    skyMid: "#b9d9e9",
    horizon: "#fff2c6",
    groundTint: "#7aa465",
    shadow: "#41646b",
    light: "#fff0b8",
    accent: "#f1c66f",
    starAlpha: 0,
    lampAlpha: 0.05
  },
  noon: {
    skyTop: "#5faee2",
    skyMid: "#a8dcf3",
    horizon: "#f3f6d5",
    groundTint: "#7faf65",
    shadow: "#416370",
    light: "#fff7d6",
    accent: "#e7c65f",
    starAlpha: 0,
    lampAlpha: 0
  },
  evening: {
    skyTop: "#536aa2",
    skyMid: "#d07a75",
    horizon: "#ffbf7b",
    groundTint: "#7a7d5b",
    shadow: "#252748",
    light: "#ffbf76",
    accent: "#f4755a",
    starAlpha: 0.04,
    lampAlpha: 0.34
  },
  dusk: {
    skyTop: "#202d55",
    skyMid: "#65517a",
    horizon: "#d98a73",
    groundTint: "#4f6b62",
    shadow: "#111a33",
    light: "#e49b82",
    accent: "#d87474",
    starAlpha: 0.32,
    lampAlpha: 0.62
  },
  night: {
    skyTop: "#071226",
    skyMid: "#102344",
    horizon: "#26365d",
    groundTint: "#23394a",
    shadow: "#050a16",
    light: "#b9d7ff",
    accent: "#74a6d9",
    starAlpha: 0.68,
    lampAlpha: 0.92
  },
  midnight: {
    skyTop: "#030915",
    skyMid: "#071936",
    horizon: "#132b4d",
    groundTint: "#182b38",
    shadow: "#02040a",
    light: "#7ab0de",
    accent: "#496d9f",
    starAlpha: 0.82,
    lampAlpha: 1
  }
};

export const coachOptions = coachThemes.map(({ id, label }) => ({ value: id, label }));

export const weatherOptions = Object.entries(weatherProfiles).map(([value, profile]) => ({
  value: value as Weather,
  label: profile.label
}));

export const timeOptions: Array<{ value: TimeOfDay; label: string }> = [
  { value: "dawn", label: "Dawn" },
  { value: "sunrise", label: "Sunrise" },
  { value: "morning", label: "Morning" },
  { value: "noon", label: "Noon" },
  { value: "evening", label: "Evening" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
  { value: "midnight", label: "Midnight blue" }
];

export const motionOptions: Array<{ value: MotionIntensity; label: string }> = [
  { value: "gentle", label: "Gentle" },
  { value: "steady", label: "Steady" },
  { value: "express", label: "Express" }
];
