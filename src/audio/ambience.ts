import { weatherProfiles } from "../data/options";
import type { JourneyState } from "../types";

export class AmbienceEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private wheelTimer = 0;
  private wheelIntervalMs = 0;
  private birdTimer = 0;
  private stationTimer = 0;
  private latestState: JourneyState | null = null;

  async setEnabled(enabled: boolean, state: JourneyState) {
    if (!enabled) {
      this.stop();
      return;
    }
    await this.start(state);
  }

  async start(state: JourneyState) {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.context.destination);
      this.createBaseLayers();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.update(state);
  }

  stop() {
    if (this.context) {
      void this.context.suspend();
    }
    window.clearInterval(this.wheelTimer);
    window.clearInterval(this.birdTimer);
    window.clearInterval(this.stationTimer);
    this.wheelTimer = 0;
    this.birdTimer = 0;
    this.stationTimer = 0;
  }

  update(state: JourneyState) {
    if (!this.context || !this.master) {
      return;
    }
    this.latestState = state;
    const now = this.context.currentTime;
    const weather = weatherProfiles[state.weather];
    const weatherRain = state.weather === "rainy" || state.weather === "stormy" ? weather.precipitation : 0;
    const timeGain = state.time === "night" || state.time === "midnight" ? 0.25 : 0.34;
    this.master.gain.setTargetAtTime(state.focus ? timeGain + 0.08 : timeGain, now, 0.8);
    this.humGain?.gain.setTargetAtTime(state.motion === "express" ? 0.14 : state.motion === "gentle" ? 0.08 : 0.11, now, 0.6);
    this.windGain?.gain.setTargetAtTime(0.04 + weather.wind * 0.08 + (state.motion === "express" ? 0.04 : 0), now, 0.8);
    this.rainGain?.gain.setTargetAtTime(weatherRain * 0.16, now, 0.5);

    this.ensureWheelRhythm(state);
    this.ensureAtmosphericAccents();
    if (state.weather === "stormy") {
      this.maybeThunder();
    }
  }

  private createBaseLayers() {
    if (!this.context || !this.master) {
      return;
    }
    this.hum = this.context.createOscillator();
    this.hum.type = "sine";
    this.hum.frequency.value = 58;
    this.humGain = this.context.createGain();
    this.humGain.gain.value = 0.08;
    this.hum.connect(this.humGain);
    this.humGain.connect(this.master);
    this.hum.start();

    const wind = this.createNoiseLoop(2.5);
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.42;
    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0.06;
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    wind.start();

    const rain = this.createNoiseLoop(1.2);
    const rainFilter = this.context.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 1600;
    this.rainGain = this.context.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.master);
    rain.start();
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
    if (!this.context || !this.master) {
      return;
    }
    const interval = state.motion === "express" ? 290 : state.motion === "gentle" ? 520 : 390;
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
    if (!this.context || !this.master) {
      return;
    }
    if (!this.birdTimer) {
      this.birdTimer = window.setInterval(() => {
        const current = this.latestState;
        if (
          current &&
          ["sunny", "cloudy", "foggy"].includes(current.weather) &&
          ["dawn", "sunrise", "morning", "evening"].includes(current.time)
        ) {
          this.playBirdChirp();
        }
      }, 8200);
    }
    if (!this.stationTimer) {
      this.stationTimer = window.setInterval(() => {
        if (Math.random() > 0.72) {
          this.playStationMurmur();
        }
      }, 17000);
    }
  }

  private playWheelPulse(state: JourneyState) {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(state.motion === "express" ? 112 : 86, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.048, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  private playBirdChirp() {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }
    const now = this.context.currentTime;
    const gain = this.context.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    gain.connect(this.master);
    for (let i = 0; i < 3; i += 1) {
      const osc = this.context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200 + i * 180, now + i * 0.1);
      osc.frequency.exponentialRampToValueAtTime(1800 + i * 220, now + 0.08 + i * 0.1);
      osc.connect(gain);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.12);
    }
  }

  private playStationMurmur() {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }
    const now = this.context.currentTime;
    const source = this.createNoiseLoop(0.8);
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.8;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.034, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + 2.6);
  }

  private maybeThunder() {
    if (!this.context || !this.master || this.context.state !== "running" || Math.random() < 0.994) {
      return;
    }
    const now = this.context.currentTime;
    const thunder = this.createNoiseLoop(1.8);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    thunder.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    thunder.start(now);
    thunder.stop(now + 1.7);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
