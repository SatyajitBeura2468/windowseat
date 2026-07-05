import type { Biome, CoachStyle, MotionIntensity, RareEvent, Weather } from "../types";
import { pickSeeded, seededRange, seededUnit, smoothstep } from "../utils/seededRandom";
import { coachThemes } from "../data/options";

const biomeOrder: Biome[] = [
  "plains",
  "fields",
  "farmland",
  "forest",
  "hills",
  "river",
  "mountains",
  "village",
  "station",
  "urban",
  "bridge",
  "desert",
  "coast",
  "foglands",
  "snow",
  "tunnel"
];

const rareEvents: RareEvent[] = [
  "passing-train",
  "platform",
  "birds",
  "deer",
  "lightning",
  "rainbow",
  "tunnel",
  "bridge",
  "signals",
  "village-lights",
  "road",
  "mist"
];

export interface BiomeBlend {
  previous: Biome;
  current: Biome;
  next: Biome;
  amount: number;
  segmentIndex: number;
  segmentProgress: number;
}

export interface EventInstance {
  type: RareEvent;
  anchor: number;
  strength: number;
  salt: string;
}

export function getCoachTheme(coach: CoachStyle) {
  return coachThemes.find((theme) => theme.id === coach) ?? coachThemes[0];
}

export function routeSpeed(seed: string, coach: CoachStyle, motion: MotionIntensity): number {
  const coachTheme = getCoachTheme(coach);
  const routeMood = 0.92 + seededUnit(seed, "route-speed") * 0.22;
  const motionMultiplier = motion === "gentle" ? 0.72 : motion === "express" ? 1.26 : 1;
  return 72 * coachTheme.speed * routeMood * motionMultiplier;
}

export function getBiomeBlend(seed: string, distance: number, weather: Weather): BiomeBlend {
  const segmentLength = 2300;
  const segmentIndex = Math.floor(distance / segmentLength);
  const local = (distance - segmentIndex * segmentLength) / segmentLength;
  const current = chooseBiome(seed, segmentIndex, weather);
  const previous = chooseBiome(seed, segmentIndex - 1, weather);
  const next = chooseBiome(seed, segmentIndex + 1, weather);
  const blendIn = smoothstep(0, 0.22, local);
  const blendOut = smoothstep(0.78, 1, local);
  const amount = local < 0.5 ? blendIn : 1 - blendOut;
  return {
    previous,
    current,
    next,
    amount,
    segmentIndex,
    segmentProgress: local
  };
}

export function chooseBiome(seed: string, segmentIndex: number, weather: Weather): Biome {
  if (weather === "snowy" && seededUnit(seed, `snow-bias:${segmentIndex}`) > 0.48) {
    return "snow";
  }
  if (weather === "foggy" && seededUnit(seed, `fog-bias:${segmentIndex}`) > 0.54) {
    return "foglands";
  }
  const mood = seededUnit(seed, "route-mood");
  const roll = seededUnit(seed, `biome:${segmentIndex}`);
  const rollingIndex = Math.floor((segmentIndex * (2 + Math.floor(mood * 4)) + roll * biomeOrder.length) % biomeOrder.length);
  const biome = biomeOrder[rollingIndex];
  if (segmentIndex > 0 && biome === chooseBiome(seed, segmentIndex - 1, weather)) {
    return biomeOrder[(rollingIndex + 3 + Math.floor(roll * 5)) % biomeOrder.length];
  }
  return biome;
}

export function getEvents(seed: string, distance: number, weather: Weather): EventInstance[] {
  const spacing = 1450;
  const currentIndex = Math.floor(distance / spacing);
  const events: EventInstance[] = [];
  for (let index = currentIndex - 2; index <= currentIndex + 4; index += 1) {
    const rarity = seededUnit(seed, `event-rarity:${index}`);
    if (rarity < 0.38) {
      continue;
    }
    let eventType = pickSeeded(seed, `event-type:${index}`, rareEvents);
    if (weather === "stormy" && seededUnit(seed, `storm-event:${index}`) > 0.58) {
      eventType = "lightning";
    }
    if (weather === "rainy" && seededUnit(seed, `rainbow-event:${index}`) > 0.78) {
      eventType = "rainbow";
    }
    if (weather === "foggy" && seededUnit(seed, `mist-event:${index}`) > 0.54) {
      eventType = "mist";
    }
    events.push({
      type: eventType,
      anchor: index * spacing + seededRange(seed, `event-anchor:${index}`, 180, spacing - 160),
      strength: seededRange(seed, `event-strength:${index}`, 0.58, 1),
      salt: `${index}:${eventType}`
    });
  }
  return events;
}
