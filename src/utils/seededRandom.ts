export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededUnit(seed: string, salt: string | number): number {
  return mulberry32(hashString(`${seed}:${salt}`))();
}

export function seededRange(seed: string, salt: string | number, min: number, max: number): number {
  return min + (max - min) * seededUnit(seed, salt);
}

export function seededInt(seed: string, salt: string | number, min: number, max: number): number {
  return Math.floor(seededRange(seed, salt, min, max + 1));
}

export function pickSeeded<T>(seed: string, salt: string | number, values: readonly T[]): T {
  return values[Math.floor(seededUnit(seed, salt) * values.length) % values.length];
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

export function noise1D(seed: string, x: number): number {
  const floor = Math.floor(x);
  const fraction = x - floor;
  const a = seededUnit(seed, floor);
  const b = seededUnit(seed, floor + 1);
  return lerp(a, b, smoothstep(0, 1, fraction));
}

export function fbm(seed: string, x: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += noise1D(`${seed}:oct${i}`, x * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total === 0 ? 0 : value / total;
}

export function makeRouteSeed(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rng = mulberry32(Date.now() >>> 0);
  const chunks = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join("")
  );
  return chunks.join("-");
}
