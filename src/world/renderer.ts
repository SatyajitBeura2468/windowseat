import { timePalettes, weatherProfiles } from "../data/options";
import type { Biome, JourneyState, RareEvent, TimePalette, WeatherProfile } from "../types";
import { clamp, fbm, lerp, seededRange, seededUnit, smoothstep } from "../utils/seededRandom";
import { getBiomeBlend, getCoachTheme, getEvents, routeSpeed } from "./journey";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  getState: () => JourneyState;
  onMilestone?: (label: string) => void;
}

interface Size {
  width: number;
  height: number;
  dpr: number;
}

type LayerName = "far" | "mid" | "near";

const biomeColors: Record<Biome, { far: string; mid: string; near: string; accent: string; snow: number; water: number }> = {
  plains: { far: "#6f9177", mid: "#719e61", near: "#5b7f3b", accent: "#d9be71", snow: 0, water: 0 },
  fields: { far: "#8aa36f", mid: "#c8ad5d", near: "#8b8c3d", accent: "#e9c568", snow: 0, water: 0 },
  forest: { far: "#486f61", mid: "#2f644a", near: "#1f4d37", accent: "#6e8b4f", snow: 0, water: 0 },
  hills: { far: "#6d8174", mid: "#647a55", near: "#52663f", accent: "#b59662", snow: 0, water: 0 },
  river: { far: "#687f76", mid: "#5e8f97", near: "#3e6575", accent: "#b7d8d8", snow: 0, water: 1 },
  mountains: { far: "#6f7c8b", mid: "#636d78", near: "#4b5660", accent: "#d2d7d2", snow: 0.35, water: 0 },
  village: { far: "#7d886c", mid: "#856b4d", near: "#5f6640", accent: "#f0bd74", snow: 0, water: 0 },
  station: { far: "#6f7776", mid: "#7c735e", near: "#565a52", accent: "#f2c46c", snow: 0, water: 0 },
  tunnel: { far: "#18222a", mid: "#101820", near: "#090e13", accent: "#d9a95f", snow: 0, water: 0 },
  urban: { far: "#65717c", mid: "#596873", near: "#454f56", accent: "#f2c36f", snow: 0, water: 0 },
  farmland: { far: "#81996d", mid: "#baa95e", near: "#697b3c", accent: "#d8be6f", snow: 0, water: 0 },
  bridge: { far: "#6e7d86", mid: "#587987", near: "#344d5c", accent: "#cbd6d7", snow: 0, water: 0.72 },
  desert: { far: "#b58d63", mid: "#c99d5d", near: "#9f7c48", accent: "#e9c382", snow: 0, water: 0 },
  coast: { far: "#688d9e", mid: "#4d91a3", near: "#3f6f7c", accent: "#e7d6a4", snow: 0, water: 1 },
  foglands: { far: "#a0aaa5", mid: "#89988f", near: "#687a72", accent: "#dfe4dd", snow: 0, water: 0.14 },
  snow: { far: "#c8d9df", mid: "#dbe8e9", near: "#b5cad0", accent: "#ffffff", snow: 1, water: 0 }
};

export class JourneyRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getState: () => JourneyState;
  private size: Size = { width: 1, height: 1, dpr: 1 };
  private rafId = 0;
  private lastTime = 0;
  private distance = 0;
  private startTime = 0;
  private milestone = "";
  private onMilestone?: (label: string) => void;

  constructor({ canvas, getState, onMilestone }: RendererOptions) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Canvas rendering is not available in this browser.");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.getState = getState;
    this.onMilestone = onMilestone;
    this.resize();
  }

  start() {
    this.stop();
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    const tick = (time: number) => {
      this.render(time);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      dpr
    };
    this.canvas.width = Math.round(this.size.width * dpr);
    this.canvas.height = Math.round(this.size.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  randomizeDistance(seed: string) {
    this.distance = seededRange(seed, "start-distance", 0, 6000);
  }

  getCurrentDistance() {
    return this.distance;
  }

  private isRichScene() {
    return this.getState().visualDepth === "rich";
  }

  private render(time: number) {
    const state = this.getState();
    const delta = Math.min(0.04, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    this.distance += delta * routeSpeed(state.seed, state.coach, state.motion);

    const elapsed = (time - this.startTime) / 1000;
    const { width, height } = this.size;
    const palette = timePalettes[state.time];
    const weather = weatherProfiles[state.weather];
    const biomeBlend = getBiomeBlend(state.seed, this.distance, state.weather);
    const biome = biomeBlend.current;

    this.ctx.clearRect(0, 0, width, height);
    this.drawSky(palette, weather, state.seed, elapsed);
    this.drawCelestial(palette, weather, state.seed, elapsed);
    this.drawClouds(palette, weather, state.seed, elapsed);
    this.drawWeatherLight(palette, weather, state.seed, elapsed);
    this.drawAtmosphericDepth(biome, palette, weather, state.seed);
    this.drawTerrainLayer("far", biome, palette, weather, state.seed, elapsed, 0.1);
    this.drawTerrainLayer("mid", biome, palette, weather, state.seed, elapsed, 0.32);
    this.drawWorldFeatures(biome, palette, weather, state.seed, elapsed);
    this.drawTerrainLayer("near", biome, palette, weather, state.seed, elapsed, 0.74);
    this.drawRareEvents(palette, weather, state.seed, elapsed);
    this.drawForegroundStreaks(palette, weather, state.seed, elapsed);
    this.drawWeather(state.weather, palette, weather, state.seed, elapsed);
    this.drawGlass(palette, weather, state.seed, elapsed);
    this.reportMilestone(biome, state.weather);
  }

  private drawSky(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.48, blendHex(palette.skyMid, "#aab5bf", weather.cloudCover * 0.2));
    gradient.addColorStop(1, palette.horizon);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    const warmth = this.ctx.createRadialGradient(width * 0.74, height * 0.22, 0, width * 0.74, height * 0.22, width * 0.8);
    warmth.addColorStop(0, `rgba(255, 218, 149, ${0.14 + seededUnit(seed, "sky-warmth") * 0.08})`);
    warmth.addColorStop(0.38, "rgba(255, 170, 105, 0.055)");
    warmth.addColorStop(1, "rgba(255, 170, 105, 0)");
    this.ctx.fillStyle = warmth;
    this.ctx.fillRect(0, 0, width, height);

    if (weather.cloudCover > 0.65) {
      const veil = this.ctx.createLinearGradient(0, 0, 0, height * 0.9);
      veil.addColorStop(0, `rgba(176, 187, 196, ${weather.cloudCover * 0.24})`);
      veil.addColorStop(1, "rgba(176, 187, 196, 0)");
      this.ctx.fillStyle = veil;
      this.ctx.fillRect(0, 0, width, height * 0.9);
    }

    const pulse = Math.sin(elapsed * 0.06 + seededUnit(seed, "light-pulse") * 6) * 0.015;
    this.ctx.fillStyle = `rgba(255,255,255,${clamp(pulse, 0, 0.03)})`;
    this.ctx.fillRect(0, 0, width, height);
  }

  private drawCelestial(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    if (palette.starAlpha > 0.05) {
      this.ctx.save();
      this.ctx.globalAlpha = palette.starAlpha * (1 - weather.cloudCover * 0.65);
      this.ctx.fillStyle = "#eaf5ff";
      for (let i = 0; i < 80; i += 1) {
        const x = seededUnit(seed, `star-x:${i}`) * width;
        const y = seededUnit(seed, `star-y:${i}`) * height * 0.52;
        const r = seededRange(seed, `star-r:${i}`, 0.45, 1.45);
        const twinkle = 0.62 + Math.sin(elapsed * seededRange(seed, `star-t:${i}`, 0.6, 1.5) + i) * 0.38;
        this.ctx.globalAlpha = palette.starAlpha * twinkle * (1 - weather.cloudCover * 0.65);
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    const isNight = palette.starAlpha > 0.3;
    const cx = isNight ? width * 0.74 : width * 0.18;
    const cy = isNight ? height * 0.18 : height * 0.24;
    const radius = isNight ? Math.max(18, width * 0.035) : Math.max(26, width * 0.05);
    const glow = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 4.5);
    glow.addColorStop(0, isNight ? "rgba(206, 231, 255, 0.46)" : "rgba(255, 224, 150, 0.48)");
    glow.addColorStop(0.34, isNight ? "rgba(117, 169, 215, 0.12)" : "rgba(255, 170, 90, 0.16)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(cx - radius * 5, cy - radius * 5, radius * 10, radius * 10);
    this.ctx.fillStyle = isNight ? "rgba(229, 244, 255, 0.82)" : "rgba(255, 239, 178, 0.72)";
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius * (isNight ? 0.62 : 0.9), 0, Math.PI * 2);
    this.ctx.fill();
    if (isNight) {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.beginPath();
      this.ctx.arc(cx + radius * 0.24, cy - radius * 0.12, radius * 0.58, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalCompositeOperation = "source-over";
    }
  }

  private drawClouds(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const count = Math.floor(8 + weather.cloudCover * 18);
    for (let i = 0; i < count; i += 1) {
      const lane = seededUnit(seed, `cloud-lane:${i}`);
      const y = height * (0.1 + lane * 0.42);
      const scale = seededRange(seed, `cloud-scale:${i}`, 0.58, 1.8);
      const speed = (0.005 + weather.wind * 0.026) * (0.6 + scale);
      const base = seededUnit(seed, `cloud-x:${i}`) * width;
      const x = ((base - (this.distance * speed + elapsed * 4) * width * 0.05) % (width + 360)) - 220;
      const alpha = 0.08 + weather.cloudCover * 0.26;
      this.drawCloud(x, y, width * 0.12 * scale, alpha, palette.light);
    }
  }

  private drawCloud(x: number, y: number, radius: number, alpha: number, color: string) {
    this.ctx.save();
    this.ctx.fillStyle = hexToRgba(color, alpha);
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, radius * 1.4, radius * 0.38, 0, 0, Math.PI * 2);
    this.ctx.ellipse(x + radius * 0.55, y - radius * 0.12, radius * 0.82, radius * 0.46, 0, 0, Math.PI * 2);
    this.ctx.ellipse(x - radius * 0.58, y + radius * 0.03, radius * 0.72, radius * 0.34, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawWeatherLight(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const stormBreak = weather.cloudCover > 0.56 && weather.visibility > 0.52;
    if (!stormBreak || !this.isRichScene()) {
      return;
    }
    this.ctx.save();
    this.ctx.globalCompositeOperation = "screen";
    const drift = Math.sin(elapsed * 0.035 + seededUnit(seed, "shaft-phase") * Math.PI * 2) * width * 0.04;
    for (let i = 0; i < 4; i += 1) {
      const x = width * seededRange(seed, `shaft-x:${i}`, 0.12, 0.86) + drift;
      const spread = width * seededRange(seed, `shaft-w:${i}`, 0.07, 0.16);
      const beam = this.ctx.createLinearGradient(x, height * 0.08, x + spread * 0.42, height * 0.76);
      beam.addColorStop(0, hexToRgba(palette.light, 0));
      beam.addColorStop(0.28, hexToRgba(palette.light, 0.045 + weather.cloudCover * 0.028));
      beam.addColorStop(1, hexToRgba(palette.light, 0));
      this.ctx.fillStyle = beam;
      this.ctx.beginPath();
      this.ctx.moveTo(x - spread * 0.18, height * 0.1);
      this.ctx.lineTo(x + spread * 0.2, height * 0.1);
      this.ctx.lineTo(x + spread, height * 0.8);
      this.ctx.lineTo(x - spread * 0.55, height * 0.8);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawAtmosphericDepth(biome: Biome, palette: TimePalette, weather: WeatherProfile, seed: string) {
    if (!this.isRichScene()) {
      return;
    }
    const { width, height } = this.size;
    const color = biomeColors[biome];
    this.ctx.save();
    for (let band = 0; band < 3; band += 1) {
      const yBase = height * (0.42 + band * 0.065);
      const amp = height * (0.055 + band * 0.022);
      const density = 26 + band * 8;
      this.ctx.beginPath();
      this.ctx.moveTo(0, height);
      for (let i = 0; i <= density; i += 1) {
        const x = (i / density) * width;
        const worldX = (x + this.distance * (0.035 + band * 0.026)) / width;
        const ridge = yBase - fbm(`${seed}:atmo:${biome}:${band}`, worldX * (2.4 + band), 4) * amp;
        this.ctx.lineTo(x, ridge);
      }
      this.ctx.lineTo(width, height);
      this.ctx.closePath();
      this.ctx.globalAlpha = (0.18 - band * 0.035) * weather.visibility;
      this.ctx.fillStyle = blendHex(color.far, palette.skyMid, 0.42 + band * 0.12);
      this.ctx.fill();
    }

    const haze = this.ctx.createLinearGradient(0, height * 0.32, 0, height * 0.74);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.58, hexToRgba(palette.light, 0.08 + weather.cloudCover * 0.04));
    haze.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = haze;
    this.ctx.fillRect(0, height * 0.25, width, height * 0.55);
    this.ctx.restore();
  }

  private drawTerrainLayer(
    layer: LayerName,
    biome: Biome,
    palette: TimePalette,
    weather: WeatherProfile,
    seed: string,
    elapsed: number,
    parallax: number
  ) {
    const { width, height } = this.size;
    const color = biomeColors[biome];
    const baseY = layer === "far" ? height * 0.56 : layer === "mid" ? height * 0.68 : height * 0.83;
    const amplitude = layer === "far" ? height * 0.16 : layer === "mid" ? height * 0.11 : height * 0.06;
    const rich = this.isRichScene();
    const density = layer === "far" ? (rich ? 26 : 11) : layer === "mid" ? (rich ? 36 : 16) : rich ? 54 : 23;
    const speed = this.distance * parallax;
    const layerColor = blendHex(color[layer], palette.groundTint, layer === "far" ? 0.36 : 0.16);
    const visibilityAlpha = layer === "far" ? weather.visibility : lerp(1, weather.visibility, 0.38);

    this.ctx.save();
    this.ctx.globalAlpha = visibilityAlpha;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    for (let i = 0; i <= density; i += 1) {
      const x = (i / density) * width;
      const worldX = (x + speed) / width;
      let terrain = fbm(`${seed}:${biome}:${layer}`, worldX * (rich ? 3.9 : 3.2), rich ? 6 : 5);
      if (biome === "mountains" && layer === "far") {
        terrain = Math.pow(terrain, 1.8) * 1.35;
      }
      if (biome === "desert") {
        terrain = smoothstep(0.05, 0.95, terrain) * 0.72;
      }
      const fine = rich ? fbm(`${seed}:${biome}:fine:${layer}`, worldX * 12.5, 3) * amplitude * 0.08 : 0;
      const ridge = baseY - terrain * amplitude - fine - Math.sin(worldX * 4 + elapsed * 0.04) * amplitude * 0.08;
      this.ctx.lineTo(x, ridge);
    }
    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    const gradient = this.ctx.createLinearGradient(0, baseY - amplitude, 0, height);
    gradient.addColorStop(0, layerColor);
    gradient.addColorStop(1, blendHex(color.near, palette.shadow, layer === "near" ? 0.42 : 0.22));
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    if (rich) {
      this.drawTerrainTexture(layer, biome, palette, seed, parallax, baseY);
    }

    if (color.snow > 0.2 || biome === "mountains") {
      this.drawSnowCaps(seed, layer, baseY, amplitude, parallax, color.snow || 0.24);
    }

    if ((color.water > 0.48 && layer !== "far") || biome === "bridge") {
      this.drawWater(layer, palette, biome, parallax, elapsed);
    }

    if (layer === "mid") {
      this.drawMidgroundDetails(biome, palette, weather, seed, parallax, elapsed);
    }
    if (layer === "near") {
      this.drawNearDetails(biome, palette, weather, seed, parallax, elapsed);
    }
    this.ctx.restore();
  }

  private drawTerrainTexture(layer: LayerName, biome: Biome, palette: TimePalette, seed: string, parallax: number, baseY: number) {
    const { width, height } = this.size;
    const color = biomeColors[biome];
    const count = layer === "far" ? 22 : layer === "mid" ? 48 : 96;
    const alpha = layer === "far" ? 0.08 : layer === "mid" ? 0.14 : 0.18;
    this.ctx.save();
    this.ctx.globalAlpha *= alpha;
    this.ctx.strokeStyle = blendHex(color.accent, palette.shadow, layer === "near" ? 0.18 : 0.05);
    this.ctx.lineWidth = layer === "near" ? 1.4 : 1;
    for (let i = 0; i < count; i += 1) {
      const lane = seededUnit(seed, `texture-lane:${layer}:${i}`);
      const y = lerp(baseY + 8, height * 0.98, lane);
      const x = ((seededRange(seed, `texture-x:${layer}:${i}`, 0, width * 1.5) - this.distance * parallax * (1.4 + lane)) % (width + 80)) - 40;
      const len = seededRange(seed, `texture-l:${layer}:${i}`, layer === "near" ? 18 : 10, layer === "near" ? 74 : 42);
      const tilt = seededRange(seed, `texture-t:${layer}:${i}`, -5, 5);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.quadraticCurveTo(x + len * 0.45, y - 2 + tilt, x + len, y + tilt * 0.4);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawSnowCaps(seed: string, layer: LayerName, baseY: number, amplitude: number, parallax: number, strength: number) {
    if (layer === "near") {
      return;
    }
    const { width } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha *= clamp(strength, 0.18, 0.72);
    this.ctx.strokeStyle = "rgba(247, 252, 255, 0.74)";
    this.ctx.lineWidth = layer === "far" ? 2 : 1.2;
    this.ctx.beginPath();
    for (let i = 0; i <= 18; i += 1) {
      const x = (i / 18) * width;
      const worldX = (x + this.distance * parallax) / width;
      const terrain = fbm(`${seed}:snowcap:${layer}`, worldX * 3.2, 5);
      const y = baseY - terrain * amplitude - 8;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawWater(layer: LayerName, palette: TimePalette, biome: Biome, parallax: number, elapsed: number) {
    const { width, height } = this.size;
    const y = layer === "mid" ? height * 0.69 : height * 0.78;
    const h = layer === "mid" ? height * 0.15 : height * 0.2;
    const gradient = this.ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, hexToRgba(blendHex("#5fa6bd", palette.light, 0.2), 0.74));
    gradient.addColorStop(1, hexToRgba(blendHex("#26495a", palette.shadow, 0.25), 0.88));
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, y, width, h);
    this.ctx.strokeStyle = "rgba(255,255,255,0.22)";
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 22; i += 1) {
      const yy = y + 12 + i * (h / 22);
      const offset = ((this.distance * parallax * 1.8 + elapsed * 18 + i * 61) % (width + 80)) - 80;
      this.ctx.beginPath();
      this.ctx.moveTo(offset, yy);
      this.ctx.lineTo(offset + width * seededRange(`${biome}`, `water:${i}`, 0.08, 0.2), yy + Math.sin(elapsed + i) * 1.5);
      this.ctx.stroke();
    }
  }

  private drawWorldFeatures(biome: Biome, palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const rich = this.isRichScene();
    if (["village", "urban", "station"].includes(biome)) {
      const count = biome === "urban" ? (rich ? 46 : 28) : rich ? 28 : 16;
      for (let i = 0; i < count; i += 1) {
        const anchor = seededRange(seed, `building:${i}`, -100, width + 220);
        const x = (anchor - (this.distance * 0.24 + i * 137) % (width + 280)) % (width + 280);
        const y = height * seededRange(seed, `building-y:${i}`, 0.48, 0.68);
        const w = seededRange(seed, `building-w:${i}`, 28, 86);
        const h = seededRange(seed, `building-h:${i}`, 28, biome === "urban" ? 116 : 70);
        this.drawBuilding(x, y, w, h, palette, weather, i);
      }
    }

    if (biome === "coast") {
      this.drawBirdFlock(width * 0.66, height * 0.28, 7, palette, elapsed);
    }

    if (rich && ["fields", "farmland", "plains", "village"].includes(biome)) {
      for (let i = 0; i < 8; i += 1) {
        const x = ((seededRange(seed, `hut:${i}`, 0, width * 1.6) - this.distance * 0.18) % (width + 180)) - 90;
        const y = height * seededRange(seed, `hut-y:${i}`, 0.55, 0.68);
        this.drawDistantHut(x, y, seededRange(seed, `hut-s:${i}`, 0.55, 1.05), palette, weather, i);
      }
    }

    if (rich && ["urban", "village", "station", "farmland"].includes(biome)) {
      this.drawDistantWires(palette, weather, seed, elapsed);
    }

    if (rich && ["fields", "farmland", "plains", "hills", "village"].includes(biome)) {
      const herdX = ((seededRange(seed, "landscape-herd", 0, width * 1.8) - this.distance * 0.21) % (width + 260)) - 130;
      this.drawSheepHerd(herdX, height * 0.69, palette, weather, 0.7, elapsed);
    }

    if (rich && ["mountains", "hills", "foglands"].includes(biome)) {
      const fallX = ((seededRange(seed, "landscape-fall", 0, width * 1.6) - this.distance * 0.085) % (width + 240)) - 120;
      this.drawWaterfall(fallX, height * 0.58, palette, weather, 0.62);
    }

    if (["river", "coast", "bridge"].includes(biome)) {
      this.drawRiverLife(palette, weather, seed, elapsed);
    }
  }

  private drawMidgroundDetails(
    biome: Biome,
    palette: TimePalette,
    weather: WeatherProfile,
    seed: string,
    parallax: number,
    elapsed: number
  ) {
    const { width, height } = this.size;
    const rich = this.isRichScene();
    const count = biome === "forest" ? (rich ? 124 : 72) : biome === "desert" ? (rich ? 34 : 18) : biome === "snow" ? (rich ? 54 : 26) : rich ? 78 : 42;
    for (let i = 0; i < count; i += 1) {
      const world = seededRange(seed, `mid-tree:${i}`, 0, width * 2);
      const x = ((world - this.distance * parallax * seededRange(seed, `mid-speed:${i}`, 0.55, 1.05)) % (width + 120)) - 60;
      const y = height * seededRange(seed, `mid-y:${i}`, 0.55, 0.77);
      const scale = seededRange(seed, `mid-scale:${i}`, 0.55, 1.35);
      if (biome === "desert") {
        this.drawDesertShrub(x, y, scale, palette);
      } else if (biome === "fields" || biome === "farmland" || biome === "plains") {
        this.drawFieldLine(x, y, scale, palette, i);
      } else if (biome === "snow") {
        this.drawPine(x, y, scale * 0.75, palette, weather, true);
      } else if (biome !== "river" && biome !== "bridge" && biome !== "station") {
        if (rich && i % 4 === 0) {
          this.drawBroadleaf(x, y, scale, palette, weather);
        } else {
          this.drawPine(x, y, scale, palette, weather, false);
        }
      }
    }

    if (biome === "farmland" || biome === "fields") {
      this.drawFieldRows(palette, seed, parallax, elapsed);
    }
  }

  private drawNearDetails(
    biome: Biome,
    palette: TimePalette,
    weather: WeatherProfile,
    seed: string,
    parallax: number,
    elapsed: number
  ) {
    const { width, height } = this.size;
    const rich = this.isRichScene();
    const trackY = height * 0.88;
    this.ctx.strokeStyle = "rgba(27, 30, 31, 0.34)";
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 2; i += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, trackY + i * 18);
      this.ctx.lineTo(width, trackY + i * 10);
      this.ctx.stroke();
    }

    for (let i = 0; i < (rich ? 20 : 12); i += 1) {
      const spacing = width / (rich ? 10 : 7);
      const x = ((i * spacing - (this.distance * parallax * 1.45) % spacing) + width) % (width + spacing) - spacing;
      this.ctx.save();
      this.ctx.translate(x, trackY + 12);
      this.ctx.rotate(-0.05);
      this.ctx.fillStyle = hexToRgba(blendHex("#4a3325", palette.shadow, 0.35), 0.58);
      this.ctx.fillRect(-24, -3, 48, 7);
      this.ctx.restore();
    }

    if (biome === "station") {
      this.drawPlatform(palette, weather, seed, elapsed);
    }

    if (rich) {
      this.drawForegroundPoles(palette, seed, elapsed);
    }

    for (let i = 0; i < (rich ? 68 : 32); i += 1) {
      const x = ((seededRange(seed, `grass:${i}`, 0, width * 1.5) - this.distance * parallax * 1.8) % (width + 60)) - 30;
      const y = height * seededRange(seed, `grass-y:${i}`, 0.76, 0.96);
      const h = seededRange(seed, `grass-h:${i}`, biome === "desert" ? 8 : 14, biome === "forest" ? 58 : 34);
      this.ctx.strokeStyle = hexToRgba(biomeColors[biome].accent, 0.28);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.quadraticCurveTo(x + Math.sin(elapsed + i) * 8, y - h * 0.55, x + 4, y - h);
      this.ctx.stroke();
    }
  }

  private drawDistantHut(
    x: number,
    y: number,
    scale: number,
    palette: TimePalette,
    weather: WeatherProfile,
    index: number
  ) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.46 * weather.visibility;
    const wall = blendHex(index % 2 ? "#9b7650" : "#735c4a", palette.groundTint, 0.22);
    const roof = blendHex("#51392e", palette.shadow, 0.2);
    const w = 34 * scale;
    const h = 20 * scale;
    this.ctx.fillStyle = wall;
    this.ctx.fillRect(x - w / 2, y - h, w, h);
    this.ctx.fillStyle = roof;
    this.ctx.beginPath();
    this.ctx.moveTo(x - w * 0.62, y - h);
    this.ctx.lineTo(x, y - h - 18 * scale);
    this.ctx.lineTo(x + w * 0.62, y - h);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = hexToRgba(palette.accent, palette.lampAlpha * 0.55);
    this.ctx.fillRect(x + w * 0.14, y - h + 7 * scale, 5 * scale, 6 * scale);
    this.ctx.restore();
  }

  private drawDistantWires(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.26 * weather.visibility;
    this.ctx.strokeStyle = blendHex("#26343b", palette.shadow, 0.24);
    this.ctx.lineWidth = 1;
    const y = height * 0.5;
    for (let row = 0; row < 2; row += 1) {
      this.ctx.beginPath();
      for (let i = 0; i <= 16; i += 1) {
        const x = (i / 16) * width;
        const sag = Math.sin(i * 0.9 + elapsed * 0.04 + row) * 4 + seededRange(seed, `wire:${row}:${i}`, -3, 3);
        if (i === 0) {
          this.ctx.moveTo(x, y + row * 13 + sag);
        } else {
          this.ctx.lineTo(x, y + row * 13 + sag);
        }
      }
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawForegroundPoles(palette: TimePalette, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const trackY = height * 0.83;
    this.ctx.save();
    for (let i = 0; i < 8; i += 1) {
      const spacing = width / 3.5;
      const x = ((seededRange(seed, `near-pole:${i}`, 0, width) - this.distance * 1.16) % (width + spacing)) - spacing * 0.4;
      const poleH = seededRange(seed, `near-pole-h:${i}`, 84, 150);
      this.ctx.globalAlpha = 0.24;
      this.ctx.strokeStyle = blendHex("#2d3335", palette.shadow, 0.3);
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(x, trackY);
      this.ctx.lineTo(x + Math.sin(elapsed + i) * 2, trackY - poleH);
      this.ctx.stroke();
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x - 26, trackY - poleH + 18);
      this.ctx.lineTo(x + 28, trackY - poleH + 13);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawRareEvents(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const events = getEvents(seed, this.distance, this.getState().weather);
    for (const event of events) {
      const x = width - (this.distance - event.anchor) * eventSpeed(event.type);
      if (x < -width * 0.9 || x > width * 1.8) {
        continue;
      }
      const progress = clamp((width - x) / width, 0, 1);
      switch (event.type) {
        case "passing-train":
          this.drawPassingTrain(x, height * 0.62, palette, event.strength);
          break;
        case "platform":
          this.drawEventPlatform(x, height * 0.68, palette, weather, event.strength);
          break;
        case "birds":
          this.drawBirdFlock(x, height * (0.2 + seededUnit(seed, `bird-y:${event.salt}`) * 0.22), 9, palette, elapsed);
          break;
        case "deer":
          this.drawDeer(x, height * 0.76, palette, progress);
          break;
        case "lightning":
          this.drawLightning(x, palette, event.strength, elapsed);
          break;
        case "rainbow":
          this.drawRainbow(x, height * 0.6, event.strength);
          break;
        case "tunnel":
          this.drawTunnelMouth(x, height * 0.48, event.strength);
          break;
        case "bridge":
          this.drawBridgeTruss(x, height * 0.73, palette, event.strength);
          break;
        case "signals":
          this.drawSignalPoles(x, height * 0.72, palette, event.strength);
          break;
        case "village-lights":
          this.drawVillageLights(x, height * 0.58, palette, event.strength);
          break;
        case "road":
          this.drawRoad(x, height * 0.78, palette, event.strength);
          break;
        case "mist":
          this.drawMistBank(x, height * 0.62, palette, event.strength);
          break;
        case "sheep":
          this.drawSheepHerd(x, height * 0.76, palette, weather, event.strength, elapsed);
          break;
        case "waterfall":
          this.drawWaterfall(x, height * 0.6, palette, weather, event.strength);
          break;
      }
    }
  }

  private drawForegroundStreaks(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const coach = getCoachTheme(this.getState().coach);
    const intensity = coach.vibration * (this.getState().motion === "express" ? 1.35 : this.getState().motion === "gentle" ? 0.72 : 1);
    this.ctx.save();
    this.ctx.globalAlpha = 0.12 + intensity * 0.035;
    this.ctx.strokeStyle = hexToRgba(blendHex(palette.light, "#ffffff", 0.2), 0.34);
    this.ctx.lineWidth = 1.1;
    for (let i = 0; i < 28; i += 1) {
      const y = height * seededRange(seed, `streak-y:${i}`, 0.58, 0.96);
      const x = ((seededRange(seed, `streak-x:${i}`, 0, width * 1.8) - this.distance * 1.8 - elapsed * 70) % (width + 120)) - 80;
      const len = seededRange(seed, `streak-l:${i}`, 20, 110) * (1 + weather.wind * 0.3);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + len, y + seededRange(seed, `streak-s:${i}`, -3, 2));
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawWeather(weatherId: string, palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    if (weatherId === "rainy" || weatherId === "stormy") {
      const rainCount = weatherId === "stormy" ? 240 : 150;
      this.ctx.save();
      this.ctx.strokeStyle = weatherId === "stormy" ? "rgba(205, 232, 255, 0.34)" : "rgba(219, 239, 247, 0.25)";
      this.ctx.lineWidth = weatherId === "stormy" ? 1.6 : 1.1;
      for (let i = 0; i < rainCount; i += 1) {
        const speed = seededRange(seed, `rain-speed:${i}`, 0.8, 1.7);
        const x = (seededUnit(seed, `rain-x:${i}`) * width + elapsed * 120 * speed + this.distance * 0.08) % width;
        const y = (seededUnit(seed, `rain-y:${i}`) * height + elapsed * 620 * speed) % height;
        const len = seededRange(seed, `rain-l:${i}`, 16, weatherId === "stormy" ? 42 : 30);
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - len * 0.28, y + len);
        this.ctx.stroke();
      }
      this.ctx.restore();
      if (this.getState().glassEffects) {
        this.drawRainDroplets(seed, elapsed, weatherId === "stormy" ? 1 : 0.72);
      }
    }

    if (weatherId === "snowy") {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      for (let i = 0; i < 150; i += 1) {
        const size = seededRange(seed, `snow-size:${i}`, 1, 3.6);
        const x = (seededUnit(seed, `snow-x:${i}`) * width + Math.sin(elapsed * 0.6 + i) * 30 + this.distance * 0.02) % width;
        const y = (seededUnit(seed, `snow-y:${i}`) * height + elapsed * seededRange(seed, `snow-speed:${i}`, 18, 82)) % height;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    if (weather.visibility < 0.75) {
      const fog = this.ctx.createLinearGradient(0, height * 0.18, 0, height);
      fog.addColorStop(0, `rgba(225, 232, 230, ${(1 - weather.visibility) * 0.2})`);
      fog.addColorStop(0.54, `rgba(225, 232, 230, ${(1 - weather.visibility) * 0.34})`);
      fog.addColorStop(1, `rgba(225, 232, 230, ${(1 - weather.visibility) * 0.18})`);
      this.ctx.fillStyle = fog;
      this.ctx.fillRect(0, 0, width, height);
    }

    if (weatherId === "stormy") {
      const flash = Math.pow(Math.max(0, Math.sin(elapsed * 0.72 + seededUnit(seed, "storm-phase") * 10)), 22);
      if (flash > 0.02) {
        this.ctx.fillStyle = `rgba(220, 236, 255, ${flash * 0.35})`;
        this.ctx.fillRect(0, 0, width, height);
      }
    }

    this.ctx.fillStyle = weather.tint;
    this.ctx.fillRect(0, 0, width, height);
    const vignette = this.ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.22, width * 0.5, height * 0.48, width * 0.74);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, hexToRgba(palette.shadow, 0.17));
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, width, height);
  }

  private drawGlass(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    if (!this.getState().glassEffects) {
      return;
    }
    const { width, height } = this.size;
    const reflected = this.ctx.createLinearGradient(0, 0, width, height);
    reflected.addColorStop(0, "rgba(255,255,255,0.09)");
    reflected.addColorStop(0.18, "rgba(255,255,255,0.015)");
    reflected.addColorStop(0.52, "rgba(255,255,255,0)");
    reflected.addColorStop(0.78, "rgba(255,255,255,0.055)");
    reflected.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = reflected;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.save();
    this.ctx.globalAlpha = (0.09 + weather.cloudCover * 0.04) * (this.isRichScene() ? 1.5 : 1);
    this.ctx.strokeStyle = hexToRgba(palette.light, 0.38);
    this.ctx.lineWidth = 1;
    for (let i = 0; i < (this.isRichScene() ? 13 : 6); i += 1) {
      const x = seededRange(seed, `glass-line:${i}`, 0, width) + Math.sin(elapsed * 0.08 + i) * 4;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.bezierCurveTo(x + 28, height * 0.3, x - 24, height * 0.66, x + 10, height);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawRainDroplets(seed: string, elapsed: number, strength: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = strength;
    for (let i = 0; i < 40; i += 1) {
      const x = seededUnit(seed, `drop-x:${i}`) * width;
      const drift = (elapsed * seededRange(seed, `drop-speed:${i}`, 6, 28) + seededUnit(seed, `drop-phase:${i}`) * height) % (height + 80);
      const y = drift - 60;
      const length = seededRange(seed, `drop-l:${i}`, 12, 58);
      const alpha = seededRange(seed, `drop-a:${i}`, 0.06, 0.18);
      this.ctx.strokeStyle = `rgba(235, 250, 255, ${alpha})`;
      this.ctx.lineWidth = seededRange(seed, `drop-w:${i}`, 1, 2.4);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.bezierCurveTo(x + 3, y + length * 0.35, x - 2, y + length * 0.68, x + 1, y + length);
      this.ctx.stroke();
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, 2.5, 4.5, 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawPine(x: number, y: number, scale: number, palette: TimePalette, weather: WeatherProfile, snowy: boolean) {
    const trunk = blendHex("#4b3224", palette.shadow, 0.18);
    const foliage = snowy ? "#e2eef0" : blendHex("#234a34", palette.groundTint, 0.22);
    this.ctx.save();
    this.ctx.shadowColor = hexToRgba(palette.shadow, 0.12);
    this.ctx.shadowBlur = 4 * scale;
    this.ctx.fillStyle = trunk;
    this.ctx.fillRect(x - 2 * scale, y - 18 * scale, 4 * scale, 18 * scale);
    this.ctx.fillStyle = hexToRgba(foliage, weather.visibility);
    for (let i = 0; i < (this.isRichScene() ? 5 : 3); i += 1) {
      const top = y - (42 - i * 13) * scale;
      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.sin(i) * scale, top + i * 2 * scale);
      this.ctx.lineTo(x - (20 - i * 2.6) * scale, y - (12 - i * 2.2) * scale);
      this.ctx.lineTo(x + (20 - i * 2.6) * scale, y - (12 - i * 2.2) * scale);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBroadleaf(x: number, y: number, scale: number, palette: TimePalette, weather: WeatherProfile) {
    this.ctx.save();
    const trunk = blendHex("#5f402b", palette.shadow, 0.18);
    const leaf = blendHex("#315d3f", palette.groundTint, 0.18);
    this.ctx.globalAlpha = weather.visibility;
    this.ctx.fillStyle = trunk;
    this.ctx.fillRect(x - 2 * scale, y - 20 * scale, 4 * scale, 20 * scale);
    this.ctx.fillStyle = hexToRgba(leaf, 0.78);
    for (let i = 0; i < 5; i += 1) {
      const ox = (i - 2) * 7 * scale;
      const oy = Math.sin(i * 1.7) * 4 * scale;
      this.ctx.beginPath();
      this.ctx.ellipse(x + ox, y - 34 * scale + oy, 13 * scale, 17 * scale, i * 0.25, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawFieldLine(x: number, y: number, scale: number, palette: TimePalette, index: number) {
    this.ctx.strokeStyle = hexToRgba(blendHex("#d8bd63", palette.groundTint, index % 2 ? 0.24 : 0.1), 0.55);
    this.ctx.lineWidth = Math.max(1, scale);
    this.ctx.beginPath();
    this.ctx.moveTo(x - 32 * scale, y);
    this.ctx.quadraticCurveTo(x, y - 5 * scale, x + 44 * scale, y + 2 * scale);
    this.ctx.stroke();
  }

  private drawDesertShrub(x: number, y: number, scale: number, palette: TimePalette) {
    this.ctx.strokeStyle = hexToRgba(blendHex("#6d6d45", palette.shadow, 0.16), 0.72);
    this.ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.quadraticCurveTo(x + (i - 1.5) * 8 * scale, y - 10 * scale, x + (i - 1.5) * 14 * scale, y - 20 * scale);
      this.ctx.stroke();
    }
  }

  private drawFieldRows(palette: TimePalette, seed: string, parallax: number, elapsed: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.strokeStyle = hexToRgba(blendHex("#e0c165", palette.shadow, 0.1), 0.22);
    for (let row = 0; row < 18; row += 1) {
      const y = height * 0.63 + row * height * 0.018;
      const offset = (this.distance * parallax * (1 + row * 0.06) + elapsed * 3) % 90;
      this.ctx.beginPath();
      this.ctx.moveTo(-20 - offset, y);
      this.ctx.lineTo(width + 60, y + seededRange(seed, `field-row:${row}`, 18, 58));
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawBuilding(x: number, y: number, w: number, h: number, palette: TimePalette, weather: WeatherProfile, index: number) {
    this.ctx.fillStyle = hexToRgba(blendHex(index % 3 ? "#685748" : "#64717a", palette.shadow, 0.22), 0.72 * weather.visibility);
    this.ctx.fillRect(x, y - h, w, h);
    this.ctx.fillStyle = hexToRgba(blendHex("#2c3338", palette.shadow, 0.14), 0.28 * weather.visibility);
    this.ctx.beginPath();
    this.ctx.moveTo(x - 4, y - h);
    this.ctx.lineTo(x + w * 0.5, y - h - 12);
    this.ctx.lineTo(x + w + 4, y - h);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = hexToRgba(palette.accent, palette.lampAlpha * 0.78);
    const cols = Math.floor(w / 18);
    const rows = Math.floor(h / 18);
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((c + r + index) % 3 === 0) {
          this.ctx.fillRect(x + 7 + c * 17, y - h + 8 + r * 17, 5, 6);
        }
      }
    }
  }

  private drawPlatform(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    const y = height * 0.74;
    this.ctx.fillStyle = hexToRgba(blendHex("#6c6559", palette.shadow, 0.2), 0.86);
    this.ctx.fillRect(0, y, width, height - y);
    this.ctx.fillStyle = hexToRgba("#f0d083", 0.5);
    for (let i = 0; i < 20; i += 1) {
      const x = ((i * 90 - this.distance * 0.9) % (width + 100)) - 80;
      this.ctx.fillRect(x, y + 8, 42, 3);
    }
    for (let i = 0; i < 8; i += 1) {
      const x = ((seededRange(seed, `people:${i}`, 0, width) - this.distance * 0.82) % (width + 120)) - 60;
      this.drawHumanSilhouette(x, y - 2, palette, weather, elapsed + i);
    }
  }

  private drawHumanSilhouette(x: number, y: number, palette: TimePalette, weather: WeatherProfile, phase: number) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.5 * weather.visibility;
    this.ctx.fillStyle = blendHex("#202023", palette.shadow, 0.3);
    this.ctx.beginPath();
    this.ctx.arc(x, y - 25, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillRect(x - 3, y - 21, 6, 17);
    this.ctx.strokeStyle = this.ctx.fillStyle;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 2, y - 4);
    this.ctx.lineTo(x - 4 + Math.sin(phase) * 2, y + 6);
    this.ctx.moveTo(x + 2, y - 4);
    this.ctx.lineTo(x + 4 - Math.sin(phase) * 2, y + 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawPassingTrain(x: number, y: number, palette: TimePalette, strength: number) {
    const { width, height } = this.size;
    const trainW = width * 0.62 * strength;
    const trainH = height * 0.22;
    this.ctx.save();
    this.ctx.globalAlpha = 0.84;
    const body = this.ctx.createLinearGradient(x, y - trainH, x, y);
    body.addColorStop(0, "#eef3f5");
    body.addColorStop(0.45, "#c9d4db");
    body.addColorStop(0.48, "#1f6bb0");
    body.addColorStop(0.55, "#1f6bb0");
    body.addColorStop(1, "#6e7f89");
    this.ctx.fillStyle = body;
    roundRect(this.ctx, x, y - trainH, trainW, trainH, 18);
    this.ctx.fill();
    this.ctx.fillStyle = "rgba(10, 24, 38, 0.58)";
    for (let i = 0; i < 9; i += 1) {
      this.ctx.fillRect(x + 28 + i * 48, y - trainH + 28, 28, 26);
    }
    this.ctx.fillStyle = hexToRgba(palette.accent, palette.lampAlpha * 0.9);
    for (let i = 0; i < 5; i += 1) {
      this.ctx.fillRect(x + 42 + i * 86, y - trainH + 62, 18, 3);
    }
    this.ctx.restore();
  }

  private drawEventPlatform(x: number, y: number, palette: TimePalette, weather: WeatherProfile, strength: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.74 * weather.visibility;
    this.ctx.fillStyle = blendHex("#746b5d", palette.shadow, 0.18);
    this.ctx.fillRect(x - 80, y, width * 0.8 * strength, height * 0.22);
    this.ctx.fillStyle = hexToRgba("#f4cf7b", 0.58);
    this.ctx.fillRect(x - 60, y + 10, width * 0.7 * strength, 4);
    this.ctx.strokeStyle = hexToRgba("#d4d8d5", 0.7);
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const px = x + i * 110;
      this.ctx.beginPath();
      this.ctx.moveTo(px, y);
      this.ctx.lineTo(px, y - 74);
      this.ctx.stroke();
      this.ctx.fillStyle = hexToRgba(palette.accent, palette.lampAlpha * 0.8);
      this.ctx.beginPath();
      this.ctx.arc(px, y - 82, 9, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBirdFlock(x: number, y: number, count: number, palette: TimePalette, elapsed: number) {
    this.ctx.save();
    this.ctx.strokeStyle = hexToRgba(blendHex("#17202a", palette.shadow, 0.3), 0.58);
    this.ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i += 1) {
      const bx = x + i * 18;
      const by = y + Math.sin(elapsed * 1.6 + i) * 10 + (i % 3) * 8;
      this.ctx.beginPath();
      this.ctx.moveTo(bx - 6, by);
      this.ctx.quadraticCurveTo(bx, by - 6, bx + 6, by);
      this.ctx.quadraticCurveTo(bx + 1, by - 3, bx + 14, by + 1);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawDeer(x: number, y: number, palette: TimePalette, progress: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.globalAlpha = 0.58;
    this.ctx.fillStyle = blendHex("#6c492f", palette.shadow, 0.2);
    this.ctx.beginPath();
    this.ctx.ellipse(0, -14, 24, 10, -0.08, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(24, -23, 8, 7, -0.15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = this.ctx.fillStyle;
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const lx = -14 + i * 9;
      const phase = Math.sin(progress * Math.PI * 6 + i);
      this.ctx.beginPath();
      this.ctx.moveTo(lx, -7);
      this.ctx.lineTo(lx + phase * 4, 10);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawLightning(x: number, palette: TimePalette, strength: number, elapsed: number) {
    const { height } = this.size;
    const flash = Math.pow(Math.max(0, Math.sin(elapsed * 4.2 + x)), 14) * strength;
    if (flash < 0.08) {
      return;
    }
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(226, 240, 255, ${flash})`;
    this.ctx.lineWidth = 2.4;
    this.ctx.shadowColor = palette.light;
    this.ctx.shadowBlur = 18;
    this.ctx.beginPath();
    this.ctx.moveTo(x, height * 0.08);
    this.ctx.lineTo(x + 18, height * 0.23);
    this.ctx.lineTo(x - 10, height * 0.27);
    this.ctx.lineTo(x + 22, height * 0.48);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawRainbow(x: number, y: number, strength: number) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.26 * strength;
    const colors = ["#ff6b6b", "#ffd166", "#77dd77", "#6ec6ff", "#b593ff"];
    colors.forEach((color, index) => {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 130 + index * 7, Math.PI * 1.06, Math.PI * 1.88);
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  private drawTunnelMouth(x: number, y: number, strength: number) {
    const { height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.96 * strength;
    this.ctx.fillStyle = "#111820";
    this.ctx.beginPath();
    this.ctx.moveTo(x - 130, height);
    this.ctx.lineTo(x - 130, y + 70);
    this.ctx.quadraticCurveTo(x, y - 80, x + 160, y + 70);
    this.ctx.lineTo(x + 180, height);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(222, 229, 225, 0.18)";
    this.ctx.lineWidth = 12;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawBridgeTruss(x: number, y: number, palette: TimePalette, strength: number) {
    const { width } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.48 * strength;
    this.ctx.strokeStyle = blendHex("#bfcbd0", palette.shadow, 0.12);
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const px = x + i * 86;
      this.ctx.beginPath();
      this.ctx.moveTo(px, y);
      this.ctx.lineTo(px + 44, y - 92);
      this.ctx.lineTo(px + 86, y);
      this.ctx.stroke();
    }
    this.ctx.beginPath();
    this.ctx.moveTo(x - 40, y);
    this.ctx.lineTo(x + width * 0.8, y);
    this.ctx.moveTo(x - 20, y - 92);
    this.ctx.lineTo(x + width * 0.75, y - 92);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawSignalPoles(x: number, y: number, palette: TimePalette, strength: number) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.82 * strength;
    for (let i = 0; i < 4; i += 1) {
      const px = x + i * 120;
      this.ctx.strokeStyle = "rgba(215, 222, 220, 0.62)";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(px, y);
      this.ctx.lineTo(px, y - 92);
      this.ctx.stroke();
      this.ctx.fillStyle = i % 2 ? "#d74b40" : "#5ad083";
      this.ctx.shadowColor = palette.accent;
      this.ctx.shadowBlur = palette.lampAlpha * 12;
      this.ctx.beginPath();
      this.ctx.arc(px, y - 104, 8, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawVillageLights(x: number, y: number, palette: TimePalette, strength: number) {
    this.ctx.save();
    this.ctx.globalAlpha = strength;
    for (let i = 0; i < 18; i += 1) {
      const px = x + i * 34;
      const py = y + Math.sin(i) * 18;
      this.ctx.fillStyle = hexToRgba(palette.accent, palette.lampAlpha * 0.8);
      this.ctx.shadowColor = palette.accent;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawRoad(x: number, y: number, palette: TimePalette, strength: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.45 * strength;
    this.ctx.fillStyle = blendHex("#343c40", palette.shadow, 0.22);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + width * 0.3, height);
    this.ctx.lineTo(x + width * 0.42, height);
    this.ctx.lineTo(x + 60, y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.22)";
    this.ctx.setLineDash([18, 16]);
    this.ctx.beginPath();
    this.ctx.moveTo(x + 30, y);
    this.ctx.lineTo(x + width * 0.36, height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  private drawMistBank(x: number, y: number, palette: TimePalette, strength: number) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.26 * strength;
    this.drawCloud(x, y, 150, 0.8, palette.light);
    this.drawCloud(x + 160, y + 18, 120, 0.72, palette.light);
    this.drawCloud(x - 130, y + 28, 130, 0.62, palette.light);
    this.ctx.restore();
  }

  private drawSheepHerd(
    x: number,
    y: number,
    palette: TimePalette,
    weather: WeatherProfile,
    strength: number,
    elapsed: number
  ) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.58 * weather.visibility * strength;
    for (let i = 0; i < 11; i += 1) {
      const sx = x + (i % 6) * 25 + Math.sin(i * 2.1) * 8;
      const sy = y + Math.floor(i / 6) * 17 + Math.sin(i * 1.4) * 5;
      const bob = Math.sin(elapsed * 1.2 + i) * 0.8;
      this.ctx.fillStyle = blendHex("#eee9dd", palette.light, 0.18);
      this.ctx.beginPath();
      this.ctx.ellipse(sx, sy - 7 + bob, 9, 6, -0.08, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = blendHex("#4a423d", palette.shadow, 0.2);
      this.ctx.beginPath();
      this.ctx.ellipse(sx + 8, sy - 9 + bob, 3.6, 3, 0.2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = this.ctx.fillStyle;
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(sx - 4, sy - 2);
      this.ctx.lineTo(sx - 5, sy + 5);
      this.ctx.moveTo(sx + 3, sy - 2);
      this.ctx.lineTo(sx + 4, sy + 5);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawWaterfall(
    x: number,
    y: number,
    palette: TimePalette,
    weather: WeatherProfile,
    strength: number
  ) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.42 * weather.visibility * strength;
    const fall = this.ctx.createLinearGradient(x, y - 118, x, y + 16);
    fall.addColorStop(0, hexToRgba(palette.light, 0.12));
    fall.addColorStop(0.4, "rgba(225,244,250,0.78)");
    fall.addColorStop(1, "rgba(199,229,238,0.16)");
    this.ctx.strokeStyle = fall;
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - 118);
    this.ctx.bezierCurveTo(x - 8, y - 72, x + 10, y - 36, x - 2, y);
    this.ctx.stroke();
    this.ctx.fillStyle = "rgba(226,244,247,0.22)";
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 2, 24, 7, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawRiverLife(palette: TimePalette, weather: WeatherProfile, seed: string, elapsed: number) {
    const { width, height } = this.size;
    this.ctx.save();
    this.ctx.globalAlpha = 0.48 * weather.visibility;
    for (let i = 0; i < 3; i += 1) {
      const x = ((seededRange(seed, `boat:${i}`, 0, width * 1.5) - this.distance * 0.16) % (width + 160)) - 80;
      const y = height * seededRange(seed, `boat-y:${i}`, 0.68, 0.78);
      this.ctx.fillStyle = blendHex("#5d3527", palette.shadow, 0.18);
      this.ctx.beginPath();
      this.ctx.moveTo(x - 18, y);
      this.ctx.quadraticCurveTo(x, y + 8, x + 20, y);
      this.ctx.lineTo(x + 14, y + 7);
      this.ctx.lineTo(x - 12, y + 7);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = hexToRgba(palette.light, 0.24);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x - 22, y + 11 + Math.sin(elapsed + i));
      this.ctx.lineTo(x + 28, y + 11);
      this.ctx.stroke();
    }
    for (let i = 0; i < 28; i += 1) {
      const x = ((seededRange(seed, `reed:${i}`, 0, width * 1.4) - this.distance * 0.48) % (width + 70)) - 35;
      const y = height * seededRange(seed, `reed-y:${i}`, 0.76, 0.88);
      const h = seededRange(seed, `reed-h:${i}`, 12, 34);
      this.ctx.strokeStyle = hexToRgba(blendHex("#496a42", palette.groundTint, 0.2), 0.5);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.quadraticCurveTo(x + weather.wind * 5, y - h * 0.55, x + weather.wind * 7, y - h);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private reportMilestone(biome: Biome, weather: string) {
    const label = `${biome}:${weather}`;
    if (label === this.milestone) {
      return;
    }
    this.milestone = label;
    this.onMilestone?.(formatBiome(biome));
  }
}

function eventSpeed(type: RareEvent) {
  if (type === "passing-train") {
    return 2.8;
  }
  if (type === "birds") {
    return 0.38;
  }
  if (type === "sheep") {
    return 0.52;
  }
  if (type === "waterfall") {
    return 0.22;
  }
  if (type === "lightning" || type === "rainbow" || type === "mist") {
    return 0.26;
  }
  return 1.1;
}

function formatBiome(biome: Biome) {
  return biome
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function blendHex(a: string, b: string, amount: number) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = Math.round(lerp(ca.r, cb.r, amount));
  const g = Math.round(lerp(ca.g, cb.g, amount));
  const blue = Math.round(lerp(ca.b, cb.b, amount));
  return `#${toHex(r)}${toHex(g)}${toHex(blue)}`;
}

function parseHex(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}
