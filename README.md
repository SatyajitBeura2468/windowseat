<div align="center">

<sub>AN ENDLESS JOURNEY, ONE WINDOW AT A TIME</sub>

# 🚆 WindowSeat

**A cinematic, procedural train-window experience inspired by journeys across India.**

Watch landscapes unfold, weather drift in, daylight change, and the coach quietly move around you—without a destination, a timer, or anything demanding your attention.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
![Canvas 2D](https://img.shields.io/badge/Canvas_2D-Procedural_Rendering-1F2937?style=flat-square)
![Runtime dependencies](https://img.shields.io/badge/runtime_dependencies-0-2F855A?style=flat-square)
[![License: MIT](https://img.shields.io/badge/License-MIT-EAB308?style=flat-square)](LICENSE)

</div>

---

## In short

> **WindowSeat turns your browser into a moving train window.** Choose a coach, route seed, weather, time of day, and pace—then settle into an endlessly generated journey with layered scenery and responsive sound.

It is less about getting somewhere and more about that familiar, quiet feeling of watching the world pass by.

## The experience

| | What it brings to the journey |
|:--:|---|
| 🌄 | **Procedural routes** — reproducible journeys generated from a route seed |
| 🌦️ | **Living atmosphere** — sun, cloud, rain, storms, fog, and snow |
| 🕰️ | **Eight times of day** — from early dawn to midnight blue |
| 🚃 | **Five coach moods** — sleeper, first-class, chair car, luggage-view, and modern premium |
| 🏞️ | **Layered landscapes** — fields, forests, rivers, hills, villages, stations, coastlines, tunnels, and more |
| 🎧 | **Scene-aware sound** — field recordings blended with procedural rail rhythm |
| 📷 | **Snapshot capture** — save the view you happen to catch |
| ✨ | **Cinematic details** — parallax, sway, reflections, droplets, lightning, cabin glow, and rare events |

## Make the journey yours

- Pick a **coach** with its own palette, movement, and character.
- Enter a **route seed** to revisit the same procedural journey.
- Change the **weather** and **time** without restarting.
- Move at a **gentle**, **steady**, or **express** rhythm.
- Toggle **sound**, enter **focus mode**, or save a **snapshot**.
- Fine-tune scenery depth, window glass, and cabin glow—or let **Cinematic cut** choose the mood.

Your latest visual preferences are kept locally in the browser. Sound always begins off, in line with browser autoplay expectations.

## Under the window frame

WindowSeat keeps the technical footprint intentionally small:

- **TypeScript** for the experience, state, and rendering systems
- **Canvas 2D** for the procedural world and atmospheric effects
- **CSS + semantic DOM** for the coach interior and controls
- **Web Audio API** for layered ambience and mechanical rail sound
- **Vite** for development and production builds
- **Zero runtime packages**

```text
src/
├── audio/       Scene-aware ambience and procedural sound
├── data/        Coach, weather, time, and motion profiles
├── ui/          Interface icons
├── utils/       Seeded randomness
├── world/       Journey generation and Canvas renderer
└── main.ts      Application shell, state, and interactions
```

## Run it locally

You will need a recent version of [Node.js](https://nodejs.org/) and npm.

```bash
git clone https://github.com/SatyajitBeura2468/windowseat.git
cd windowseat
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Vite development server |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |

## Audio and attribution

The ambience combines procedural Web Audio layers with carefully selected public-domain and CC0 field recordings. Individual recordings, creators, licenses, and source pages are documented in [`public/audio/SOURCES.md`](public/audio/SOURCES.md).

## License

WindowSeat is open source under the [MIT License](LICENSE).

---

<div align="center">

**Designed and built by [Satyajit Beura](https://github.com/SatyajitBeura2468).**

<sub>For the people who still look up when a train crosses the horizon.</sub>

</div>
