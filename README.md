# WindowSeat

WindowSeat is a cinematic train-window journey simulator: a premium, procedural, endlessly moving view from inside an Indian railway-inspired coach.

The experience is code-native and dependency-light. It uses a layered Canvas 2D renderer for scenery, weather, time of day, rare events, and motion, with CSS/DOM for the train interior and minimal controls. A scene-aware Web Audio mixer crossfades public-domain field recordings with procedural rail mechanics after the user enables sound, respecting browser autoplay rules.

## Features

- Seeded procedural route generation with reproducible journeys.
- Layered parallax landscapes across plains, fields, forest, hills, rivers, mountains, villages, stations, tunnels, urban edges, bridges, desert, coast, fog, and snow.
- Weather modes: sunny, cloudy, rainy, stormy, foggy, and snowy.
- Time-of-day moods from dawn through midnight blue.
- Indian railway-inspired coach themes: sleeper, first-class, chair car, luggage-view, and modern premium.
- Subtle motion, sway, vibration, rare events, glass reflections, rain droplets, snow, lightning, and station ambience.
- Dynamic coach acoustics and biome-specific field recordings for rail interiors, forests, rivers, coastlines, rain, thunder, and wildlife.
- Compact controls that fade away so the scenery remains the focus.

Audio sources and licenses are documented in [public/audio/SOURCES.md](public/audio/SOURCES.md).

## Development

```bash
npm.cmd install
npm.cmd run dev
```

## Build

```bash
npm.cmd run build
```
