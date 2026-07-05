export type CoachStyle = "sleeper" | "first" | "chair" | "luggage" | "vande";

export type Weather = "sunny" | "cloudy" | "rainy" | "stormy" | "foggy" | "snowy";

export type TimeOfDay =
  | "dawn"
  | "sunrise"
  | "morning"
  | "noon"
  | "evening"
  | "dusk"
  | "night"
  | "midnight";

export type MotionIntensity = "gentle" | "steady" | "express";

export type Biome =
  | "plains"
  | "fields"
  | "forest"
  | "hills"
  | "river"
  | "mountains"
  | "village"
  | "station"
  | "tunnel"
  | "urban"
  | "farmland"
  | "bridge"
  | "desert"
  | "coast"
  | "foglands"
  | "snow";

export type RareEvent =
  | "passing-train"
  | "platform"
  | "birds"
  | "deer"
  | "lightning"
  | "rainbow"
  | "tunnel"
  | "bridge"
  | "signals"
  | "village-lights"
  | "road"
  | "mist";

export interface JourneyState {
  coach: CoachStyle;
  seed: string;
  weather: Weather;
  time: TimeOfDay;
  motion: MotionIntensity;
  sound: boolean;
  focus: boolean;
}

export interface CoachTheme {
  id: CoachStyle;
  label: string;
  shortLabel: string;
  description: string;
  speed: number;
  sway: number;
  vibration: number;
  palette: {
    cabin: string;
    cabinDeep: string;
    trim: string;
    trimSoft: string;
    cloth: string;
    metal: string;
    highlight: string;
  };
}

export interface TimePalette {
  skyTop: string;
  skyMid: string;
  horizon: string;
  groundTint: string;
  shadow: string;
  light: string;
  accent: string;
  starAlpha: number;
  lampAlpha: number;
}

export interface WeatherProfile {
  label: string;
  visibility: number;
  cloudCover: number;
  precipitation: number;
  wind: number;
  tint: string;
}
