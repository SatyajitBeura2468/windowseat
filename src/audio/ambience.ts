import { weatherProfiles } from "../data/options";
import type { Biome, JourneyState, RareEvent } from "../types";

type SampleId = "train" | "rain" | "birds" | "river" | "coast" | "thunder" | "sheep";
type LoopId = Exclude<SampleId, "thunder" | "sheep">;

interface LoopLayer {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  gain: GainNode;
}

interface SceneMix {
  birds: number;
  river: number;
  coast: number;
  wind: number;
  station: number;
  train: number;
}

const sampleUrls: Record<SampleId, string> = {
  train: "/audio/train-interior.ogg",
  rain: "/audio/rain.ogg",
  birds: "/audio/forest-birds.ogg",
  river: "/audio/river.ogg",
  coast: "/audio/coast.ogg",
  thunder: "/audio/thunder.ogg",
  sheep: "/audio/sheep.ogg"
};

const sceneMix: Record<Biome, SceneMix> = {
  plains: { birds: 0.5, river: 0, coast: 0, wind: 0.45, station: 0, train: 1 },
  fields: { birds: 0.72, river: 0, coast: 0, wind: 0.28, station: 0, train: 1 },
  forest: { birds: 1, river: 0.08, coast: 0, wind: 0.14, station: 0, train: 0.96 },
  hills: { birds: 0.48, river: 0.12, coast: 0, wind: 0.58, station: 0, train: 1 },
  river: { birds: 0.34, river: 1, coast: 0, wind: 0.28, station: 0, train: 1 },
  mountains: { birds: 0.18, river: 0.2, coast: 0, wind: 0.82, station: 0, train: 1.04 },
  village: { birds: 0.38, river: 0, coast: 0, wind: 0.2, station: 0.34, train: 1 },
  station: { birds: 0.05, river: 0, coast: 0, wind: 0.08, station: 1, train: 0.84 },
  tunnel: { birds: 0, river: 0, coast: 0, wind: 0.02, station: 0, train: 1.28 },
  urban: { birds: 0.05, river: 0, coast: 0, wind: 0.14, station: 0.62, train: 1.03 },
  farmland: { birds: 0.65, river: 0, coast: 0, wind: 0.34, station: 0, train: 1 },
  bridge: { birds: 0.12, river: 0.78, coast: 0, wind: 0.7, station: 0, train: 1.12 },
  desert: { birds: 0, river: 0, coast: 0, wind: 1, station: 0, train: 1.02 },
  coast: { birds: 0.08, river: 0, coast: 1, wind: 0.65, station: 0, train: 1 },
  foglands: { birds: 0.08, river: 0.12, coast: 0, wind: 0.32, station: 0, train: 0.98 },
  snow: { birds: 0.03, river: 0, coast: 0, wind: 0.74, station: 0, train: 1.02 }
};

const coachAcoustics = {
  sleeper: { exterior: 1, train: 1.05, cutoff: 7200 },
  first: { exterior: 0.48, train: 0.7, cutoff: 2600 },
  chair: { exterior: 0.58, train: 0.8, cutoff: 3400 },
  luggage: { exterior: 1.12, train: 1.18, cutoff: 8200 },
  vande: { exterior: 0.4, train: 0.64, cutoff: 2100 }
} as const;

export class AmbienceEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private mechanicalBus: GainNode | null = null;
  private fieldBus: GainNode | null = null;
  private humGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainFallbackGain: GainNode | null = null;
  private sampleLoadPromise: Promise<void> | null = null;
  private samples = new Map<SampleId, AudioBuffer>();
  private loops = new Map<LoopId, LoopLayer>();
  private wheelTimer = 0;
  private wheelIntervalMs = 0;
  private accentTimer = 0;
  private stormTimer = 0;
  private latestState: JourneyState | null = null;
  private currentBiome: Biome = "plains";

  async setEnabled(enabled: boolean, state: JourneyState) {
    this.latestState = state;
    if (!enabled) {
      this.stop();
      return;
    }
    await this.start(state);
  }

  async start(state: JourneyState) {
    this.latestState = state;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextClass();
      this.createAudioGraph();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.update(state);
    await this.ensureSamplesLoaded();
    this.update(state);
  }

  stop() {
    if (this.context) {
      void this.context.suspend();
    }
    window.clearInterval(this.wheelTimer);
    window.clearInterval(this.accentTimer);
    window.clearInterval(this.stormTimer);
    this.wheelTimer = 0;
    this.accentTimer = 0;
    this.stormTimer = 0;
  }

  setBiome(biome: Biome) {
    this.currentBiome = biome;
    if (this.latestState) {
      this.update(this.latestState);
    }
  }

  playEvent(type: RareEvent) {
    if (!this.isRunning()) {
      return;
    }
    if (type === "sheep") {
      this.playSample("sheep", 0.28, 2.2, randomBetween(-0.55, 0.55), randomBetween(0.92, 1.05));
      return;
    }
    if (type === "waterfall") {
      this.playSample("river", 0.14, 6.5, randomBetween(-0.4, 0.2), 1.08);
      return;
    }
    if (type === "birds") {
      this.playSample("birds", 0.12, 4.5, randomBetween(-0.6, 0.6), randomBetween(0.96, 1.08));
      return;
    }
    if (type === "lightning") {
      this.playThunder();
      return;
    }
    if (type === "passing-train") {
      this.playPassingTrain();
      return;
    }
    if (type === "platform" || type === "signals") {
      this.playStationMurmur(type === "platform" ? 0.085 : 0.045);
      return;
    }
    if (type === "tunnel" || type === "bridge") {
      this.playStructureBoom(type === "tunnel" ? 0.13 : 0.075);
    }
  }

  update(state: JourneyState) {
    this.latestState = state;
    if (!this.context || !this.master) {
      return;
    }
    const now = this.context.currentTime;
    const weather = weatherProfiles[state.weather];
    const scene = sceneMix[this.currentBiome];
    const coach = coachAcoustics[state.coach];
    const night = state.time === "night" || state.time === "midnight";
    const daylight = ["dawn", "sunrise", "morning", "noon", "evening"].includes(state.time);
    const motionRate = state.motion === "express" ? 1.1 : state.motion === "gentle" ? 0.9 : 1;
    const motionGain = state.motion === "express" ? 1.15 : state.motion === "gentle" ? 0.82 : 1;
    const rainAmount = state.weather === "rainy" ? 0.72 : state.weather === "stormy" ? 1 : 0;
    const birdWeather = ["sunny", "cloudy", "foggy"].includes(state.weather) ? 1 : 0.12;

    this.master.gain.setTargetAtTime(state.focus ? 0.54 : night ? 0.43 : 0.47, now, 0.8);
    this.mechanicalBus?.gain.setTargetAtTime(this.currentBiome === "tunnel" ? 1.12 : 1, now, 1.2);
    this.fieldBus?.gain.setTargetAtTime(coach.exterior, now, 1.4);
    this.humGain?.gain.setTargetAtTime((state.motion === "express" ? 0.07 : state.motion === "gentle" ? 0.038 : 0.052) * scene.train, now, 0.7);
    this.windGain?.gain.setTargetAtTime(0.018 + (scene.wind * 0.055 + weather.wind * 0.06) * coach.exterior, now, 1.1);
    this.rainFallbackGain?.gain.setTargetAtTime(rainAmount * (this.samples.has("rain") ? 0.018 : 0.12), now, 0.7);

    this.setLoop("train", 0.14 * coach.train * scene.train * motionGain, coach.cutoff, motionRate, 0);
    this.setLoop("rain", 0.18 * rainAmount * (0.72 + coach.exterior * 0.28), 7600, 1, 0.1);
    this.setLoop("birds", 0.12 * scene.birds * birdWeather * (daylight ? 1 : night ? 0.05 : 0.32), 6200, 1, -0.14);
    this.setLoop("river", 0.13 * scene.river, 4800, 1, 0.22);
    this.setLoop("coast", 0.15 * scene.coast, 5600, 1, -0.18);

    this.ensureWheelRhythm(state);
    this.ensureAtmosphericAccents();
  }

  private createAudioGraph() {
    if (!this.context) {
      return;
    }
    this.master = this.context.createGain();
    this.master.gain.value = 0.45;

    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 20;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.42;
    this.master.connect(compressor);
    compressor.connect(this.context.destination);

    this.mechanicalBus = this.context.createGain();
    this.fieldBus = this.context.createGain();
    this.mechanicalBus.connect(this.master);
    this.fieldBus.connect(this.master);
    this.createProceduralLayers();
  }

  private createProceduralLayers() {
    if (!this.context || !this.mechanicalBus || !this.fieldBus) {
      return;
    }
    const hum = this.context.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 54;
    this.humGain = this.context.createGain();
    this.humGain.gain.value = 0.05;
    hum.connect(this.humGain);
    this.humGain.connect(this.mechanicalBus);
    hum.start();

    const wind = this.createNoiseLoop(2.8);
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 380;
    windFilter.Q.value = 0.38;
    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0.035;
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.fieldBus);
    wind.start();

    const rain = this.createNoiseLoop(1.4);
    const rainFilter = this.context.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 1700;
    this.rainFallbackGain = this.context.createGain();
    this.rainFallbackGain.gain.value = 0;
    rain.connect(rainFilter);
    rainFilter.connect(this.rainFallbackGain);
    this.rainFallbackGain.connect(this.fieldBus);
    rain.start();
  }

  private async ensureSamplesLoaded() {
    if (!this.sampleLoadPromise) {
      this.sampleLoadPromise = this.loadSamples();
    }
    await this.sampleLoadPromise;
  }

  private async loadSamples() {
    if (!this.context) {
      return;
    }
    const context = this.context;
    const loaded = await Promise.allSettled(
      Object.entries(sampleUrls).map(async ([id, url]) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Unable to load ${url}`);
        }
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return [id as SampleId, buffer] as const;
      })
    );
    for (const result of loaded) {
      if (result.status === "fulfilled") {
        this.samples.set(result.value[0], result.value[1]);
      }
    }
    for (const id of ["train", "rain", "birds", "river", "coast"] as const) {
      this.createLoop(id);
    }
  }

  private createLoop(id: LoopId) {
    if (!this.context || !this.fieldBus || this.loops.has(id)) {
      return;
    }
    const buffer = this.samples.get(id);
    if (!buffer) {
      return;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = Math.min(0.12, buffer.duration * 0.02);
    source.loopEnd = Math.max(source.loopStart + 0.1, buffer.duration - Math.min(0.12, buffer.duration * 0.02));
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(id === "train" ? this.mechanicalBus ?? this.fieldBus : this.fieldBus);
    source.start(0, Math.random() * Math.max(0.01, buffer.duration - 0.2));
    this.loops.set(id, { source, filter, panner, gain });
  }

  private setLoop(id: LoopId, volume: number, cutoff: number, playbackRate: number, pan: number) {
    if (!this.context) {
      return;
    }
    const loop = this.loops.get(id);
    if (!loop) {
      return;
    }
    const now = this.context.currentTime;
    loop.gain.gain.setTargetAtTime(volume, now, id === "train" ? 0.8 : 1.8);
    loop.filter.type = "lowpass";
    loop.filter.frequency.setTargetAtTime(cutoff, now, 1.2);
    loop.source.playbackRate.setTargetAtTime(playbackRate, now, 0.9);
    loop.panner.pan.setTargetAtTime(pan, now, 1.4);
  }

  private createNoiseLoop(seconds: number) {
    if (!this.context) {
      throw new Error("Audio context not ready");
    }
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * seconds, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      last = last * 0.72 + (Math.random() * 2 - 1) * 0.28;
      data[i] = last;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  private ensureWheelRhythm(state: JourneyState) {
    if (!this.context || !this.mechanicalBus) {
      return;
    }
    const interval = state.motion === "express" ? 275 : state.motion === "gentle" ? 515 : 385;
    if (this.wheelTimer && this.wheelIntervalMs === interval) {
      return;
    }
    window.clearInterval(this.wheelTimer);
    this.wheelIntervalMs = interval;
    this.wheelTimer = window.setInterval(() => {
      if (this.latestState) {
        this.playWheelPulse(this.latestState);
      }
    }, interval);
  }

  private ensureAtmosphericAccents() {
    if (!this.accentTimer) {
      this.accentTimer = window.setInterval(() => {
        if (!this.latestState || !this.isRunning()) {
          return;
        }
        const scene = sceneMix[this.currentBiome];
        if (scene.station > 0.25 && Math.random() < scene.station) {
          this.playStationMurmur(0.045 + scene.station * 0.035);
        } else if (!this.samples.has("birds") && scene.birds > 0.4) {
          this.playBirdChirp();
        }
      }, 9200);
    }
    if (!this.stormTimer) {
      this.stormTimer = window.setInterval(() => {
        if (this.latestState?.weather === "stormy" && Math.random() > 0.52) {
          this.playThunder();
        }
      }, 6800);
    }
  }

  private playWheelPulse(state: JourneyState) {
    if (!this.context || !this.mechanicalBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(state.motion === "express" ? 108 : 82, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(state.coach === "vande" ? 0.025 : 0.04, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.mechanicalBus);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  private playSample(id: SampleId, volume: number, duration: number, pan: number, playbackRate = 1) {
    if (!this.context || !this.fieldBus || !this.isRunning()) {
      return false;
    }
    const buffer = this.samples.get(id);
    if (!buffer) {
      return false;
    }
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    const playable = Math.min(duration, buffer.duration / playbackRate);
    const maxOffset = Math.max(0, buffer.duration - playable * playbackRate - 0.05);
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.4, playable * 0.18));
    gain.gain.setValueAtTime(volume, now + Math.max(0.42, playable - 0.55));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + playable);
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.fieldBus);
    source.start(now, Math.random() * maxOffset);
    source.stop(now + playable + 0.04);
    return true;
  }

  private playThunder() {
    if (this.playSample("thunder", 0.34, 8.5, randomBetween(-0.4, 0.4), randomBetween(0.94, 1.02))) {
      return;
    }
    this.playSyntheticThunder();
  }

  private playSyntheticThunder() {
    if (!this.context || !this.fieldBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const thunder = this.createNoiseLoop(1.9);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 190;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.72);
    thunder.connect(filter);
    filter.connect(gain);
    gain.connect(this.fieldBus);
    thunder.start(now);
    thunder.stop(now + 1.78);
  }

  private playPassingTrain() {
    if (!this.context || !this.mechanicalBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const noise = this.createNoiseLoop(3.4);
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(760, now + 1.5);
    filter.frequency.exponentialRampToValueAtTime(240, now + 3.3);
    panner.pan.setValueAtTime(0.85, now);
    panner.pan.linearRampToValueAtTime(-0.85, now + 3.35);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    noise.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.mechanicalBus);
    noise.start(now);
    noise.stop(now + 3.45);
  }

  private playStationMurmur(volume: number) {
    if (!this.context || !this.fieldBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const source = this.createNoiseLoop(1.1);
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.74;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.fieldBus);
    source.start(now);
    source.stop(now + 3.3);
  }

  private playBirdChirp() {
    if (!this.context || !this.fieldBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    gain.connect(this.fieldBus);
    for (let i = 0; i < 3; i += 1) {
      const osc = this.context.createOscillator();
      osc.frequency.setValueAtTime(1220 + i * 170, now + i * 0.1);
      osc.frequency.exponentialRampToValueAtTime(1820 + i * 210, now + 0.08 + i * 0.1);
      osc.connect(gain);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.12);
    }
  }

  private playStructureBoom(volume: number) {
    if (!this.context || !this.mechanicalBus || !this.isRunning()) {
      return;
    }
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(72, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.72);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);
    osc.connect(gain);
    gain.connect(this.mechanicalBus);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  private isRunning() {
    return this.context?.state === "running";
  }
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
