import "./styles.css";
import { AmbienceEngine } from "./audio/ambience";
import { coachOptions, coachThemes, motionOptions, timeOptions, weatherOptions } from "./data/options";
import { icon } from "./ui/icons";
import type { CoachStyle, JourneyState, MotionIntensity, TimeOfDay, Weather } from "./types";
import { makeRouteSeed } from "./utils/seededRandom";
import { JourneyRenderer } from "./world/renderer";

const storageKey = "windowseat:journey-state";

const defaultState: JourneyState = {
  coach: "vande",
  seed: "KONKAN-COAST-07",
  weather: "sunny",
  time: "evening",
  motion: "steady",
  sound: false,
  focus: false
};

class WindowSeatApp {
  private root: HTMLElement;
  private state: JourneyState;
  private renderer: JourneyRenderer | null = null;
  private ambience = new AmbienceEngine();
  private controlsTimer = 0;
  private milestoneTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = this.loadState();
    this.renderShell();
    this.bindControls();
    this.startRenderer();
    this.syncUi();
    this.revealControls();
  }

  private loadState(): JourneyState {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        return { ...defaultState };
      }
      return { ...defaultState, ...JSON.parse(saved) } as JourneyState;
    } catch {
      return { ...defaultState };
    }
  }

  private saveState() {
    localStorage.setItem(storageKey, JSON.stringify(this.state));
  }

  private renderShell() {
    this.root.innerHTML = `
      <section class="windowseat" data-coach="${this.state.coach}" data-focus="${this.state.focus}">
        <div class="motion-stage" aria-hidden="true">
          <div class="aperture">
            <canvas class="journey-canvas"></canvas>
            <div class="window-reflection"></div>
            <div class="window-vignette"></div>
          </div>
          <div class="coach-frame">
            <div class="top-panel">
              <div class="route-light"></div>
              <div class="coach-grip left"></div>
              <div class="coach-grip right"></div>
            </div>
            <div class="side-panel left-panel"></div>
            <div class="side-panel right-panel"></div>
            <div class="seat-edge left-seat"></div>
            <div class="seat-edge right-seat"></div>
            <div class="lower-sill">
              <div class="sill-shadow"></div>
              <div class="track-rhythm"></div>
            </div>
          </div>
        </div>

        <button class="menu-button control-surface" type="button" aria-expanded="true" aria-controls="journey-controls">
          ${icon("menu")}
          <span class="sr-only">Toggle journey controls</span>
        </button>

        <form id="journey-controls" class="controls control-surface" aria-label="Journey controls">
          <div class="brand-lockup" aria-live="polite">
            <span class="brand-mark">${icon("spark")}</span>
            <span>
              <strong>WindowSeat</strong>
              <em class="milestone">Western Ghats</em>
            </span>
          </div>
          <label>
            <span>Coach</span>
            <select name="coach">
              ${coachOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
            </select>
          </label>
          <label class="seed-field">
            <span>Route seed</span>
            <input name="seed" type="text" autocomplete="off" spellcheck="false" maxlength="32" />
          </label>
          <label>
            <span>Weather</span>
            <select name="weather">
              ${weatherOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Time</span>
            <select name="time">
              ${timeOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
            </select>
          </label>
          <fieldset class="segmented">
            <legend>Motion</legend>
            ${motionOptions
              .map(
                (option) => `
                  <label>
                    <input type="radio" name="motion" value="${option.value}" />
                    <span>${option.label}</span>
                  </label>`
              )
              .join("")}
          </fieldset>
          <div class="action-row">
            <button type="button" class="icon-button" data-action="sound" aria-pressed="false" title="Toggle sound">
              ${icon("sound")}
              <span class="sr-only">Toggle sound</span>
            </button>
            <button type="button" class="icon-button" data-action="focus" aria-pressed="false" title="Focus mode">
              ${icon("focus")}
              <span class="sr-only">Toggle focus mode</span>
            </button>
            <button type="button" class="icon-button" data-action="snapshot" title="Save window view">
              ${icon("photo")}
              <span class="sr-only">Save window view</span>
            </button>
            <button type="button" class="randomize" data-action="randomize">
              ${icon("shuffle")}
              <span>Randomize</span>
            </button>
          </div>
        </form>

        <div class="coach-caption" aria-live="polite"></div>
        <div class="capture-flash" aria-hidden="true"></div>
      </section>
    `;
  }

  private bindControls() {
    const shell = this.getShell();
    const controls = this.getControls();
    const menuButton = this.root.querySelector<HTMLButtonElement>(".menu-button");
    controls.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      if (!target.name) {
        return;
      }
      this.updateFromControl(target);
    });
    controls.addEventListener("submit", (event) => event.preventDefault());
    this.root.addEventListener("pointermove", () => this.revealControls());
    this.root.addEventListener("focusin", () => this.revealControls());
    this.root.querySelector(".aperture")?.addEventListener("click", () => this.toggleFocus());
    menuButton?.addEventListener("click", () => {
      shell.classList.toggle("controls-open");
      const open = shell.classList.contains("controls-open");
      menuButton.setAttribute("aria-expanded", String(open));
      this.revealControls();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        if (action === "sound") {
          await this.toggleSound();
        }
        if (action === "focus") {
          this.toggleFocus();
        }
        if (action === "randomize") {
          this.randomizeJourney();
        }
        if (action === "snapshot") {
          this.saveSnapshot();
        }
      });
    });
    window.addEventListener("resize", () => this.renderer?.resize());
    window.addEventListener("keydown", async (event) => {
      if (event.key.toLowerCase() === "f") {
        this.toggleFocus();
      }
      if (event.key.toLowerCase() === "r") {
        this.randomizeJourney();
      }
      if (event.key.toLowerCase() === "m") {
        await this.toggleSound();
      }
      if (event.key === "Escape" && this.state.focus) {
        this.toggleFocus(false);
      }
    });
  }

  private startRenderer() {
    const canvas = this.root.querySelector<HTMLCanvasElement>(".journey-canvas");
    if (!canvas) {
      throw new Error("Missing journey canvas");
    }
    this.renderer = new JourneyRenderer({
      canvas,
      getState: () => this.state,
      onMilestone: (label) => this.showMilestone(label)
    });
    this.renderer.randomizeDistance(this.state.seed);
    this.renderer.start();
  }

  private updateFromControl(target: HTMLInputElement | HTMLSelectElement) {
    const value = target.value.trim();
    if (target.name === "coach") {
      this.state.coach = value as CoachStyle;
    }
    if (target.name === "seed") {
      this.state.seed = value || defaultState.seed;
      this.renderer?.randomizeDistance(this.state.seed);
    }
    if (target.name === "weather") {
      this.state.weather = value as Weather;
    }
    if (target.name === "time") {
      this.state.time = value as TimeOfDay;
    }
    if (target.name === "motion") {
      this.state.motion = value as MotionIntensity;
    }
    this.saveState();
    this.syncUi();
    this.ambience.update(this.state);
  }

  private async toggleSound() {
    this.state.sound = !this.state.sound;
    await this.ambience.setEnabled(this.state.sound, this.state);
    this.saveState();
    this.syncUi();
  }

  private toggleFocus(force?: boolean) {
    this.state.focus = typeof force === "boolean" ? force : !this.state.focus;
    this.saveState();
    this.syncUi();
    this.ambience.update(this.state);
  }

  private randomizeJourney() {
    const weathers = weatherOptions.map((option) => option.value);
    const times = timeOptions.map((option) => option.value);
    const coaches = coachThemes.map((theme) => theme.id);
    const randomSeed = makeRouteSeed();
    this.state = {
      ...this.state,
      seed: randomSeed,
      coach: coaches[Math.floor(Math.random() * coaches.length)],
      weather: weathers[Math.floor(Math.random() * weathers.length)],
      time: times[Math.floor(Math.random() * times.length)]
    };
    this.renderer?.randomizeDistance(this.state.seed);
    this.saveState();
    this.syncUi();
    this.ambience.update(this.state);
    this.showMilestone("New route");
  }

  private saveSnapshot() {
    const canvas = this.root.querySelector<HTMLCanvasElement>(".journey-canvas");
    const shell = this.getShell();
    if (!canvas) {
      return;
    }
    shell.classList.add("capturing");
    window.setTimeout(() => shell.classList.remove("capturing"), 520);
    const link = document.createElement("a");
    link.download = `windowseat-${this.state.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  private syncUi() {
    const shell = this.getShell();
    shell.dataset.coach = this.state.coach;
    shell.dataset.focus = String(this.state.focus);
    shell.style.setProperty("--sway", `${this.getSway()}px`);
    shell.classList.toggle("focus-mode", this.state.focus);
    shell.classList.add("controls-open");

    const coachTheme = coachThemes.find((theme) => theme.id === this.state.coach) ?? coachThemes[0];
    for (const [name, color] of Object.entries(coachTheme.palette)) {
      shell.style.setProperty(`--coach-${kebab(name)}`, color);
    }
    const controls = this.getControls();
    controls.querySelector<HTMLSelectElement>('[name="coach"]')!.value = this.state.coach;
    controls.querySelector<HTMLInputElement>('[name="seed"]')!.value = this.state.seed;
    controls.querySelector<HTMLSelectElement>('[name="weather"]')!.value = this.state.weather;
    controls.querySelector<HTMLSelectElement>('[name="time"]')!.value = this.state.time;
    controls.querySelectorAll<HTMLInputElement>('[name="motion"]').forEach((input) => {
      input.checked = input.value === this.state.motion;
    });

    const caption = this.root.querySelector<HTMLElement>(".coach-caption");
    if (caption) {
      caption.textContent = coachTheme.description;
    }
    const soundButton = this.root.querySelector<HTMLButtonElement>('[data-action="sound"]');
    if (soundButton) {
      soundButton.setAttribute("aria-pressed", String(this.state.sound));
      soundButton.innerHTML = `${icon(this.state.sound ? "sound" : "mute")}<span class="sr-only">Toggle sound</span>`;
    }
    const focusButton = this.root.querySelector<HTMLButtonElement>('[data-action="focus"]');
    focusButton?.setAttribute("aria-pressed", String(this.state.focus));
  }

  private revealControls() {
    const shell = this.getShell();
    shell.classList.add("controls-visible", "controls-open");
    window.clearTimeout(this.controlsTimer);
    if (!this.state.focus) {
      this.controlsTimer = window.setTimeout(() => {
        if (!this.root.matches(":focus-within")) {
          shell.classList.remove("controls-visible");
        }
      }, 4200);
    }
  }

  private showMilestone(label: string) {
    const milestone = this.root.querySelector<HTMLElement>(".milestone");
    if (!milestone) {
      return;
    }
    window.clearTimeout(this.milestoneTimer);
    milestone.textContent = label;
    milestone.classList.add("is-changing");
    this.milestoneTimer = window.setTimeout(() => milestone.classList.remove("is-changing"), 850);
  }

  private getSway() {
    const coachTheme = coachThemes.find((theme) => theme.id === this.state.coach) ?? coachThemes[0];
    const motion = this.state.motion === "gentle" ? 0.62 : this.state.motion === "express" ? 1.26 : 1;
    return coachTheme.sway * motion;
  }

  private getControls() {
    const controls = this.root.querySelector<HTMLFormElement>("#journey-controls");
    if (!controls) {
      throw new Error("Missing controls");
    }
    return controls;
  }

  private getShell() {
    const shell = this.root.querySelector<HTMLElement>(".windowseat");
    if (!shell) {
      throw new Error("Missing application shell");
    }
    return shell;
  }
}

function kebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app root");
}

new WindowSeatApp(root);
