# Reiss Panning

<img src="/screenshots/reiss-mcpherson/panning.png" class="screenshot-hero" width="208" height="113" alt="Reiss Panning">

Two stereo-pan algorithms selectable at runtime:

- **Panorama + Precedence** - tangent-law gain combined with a
  per-side time delay derived from the pan position. Aimed at
  loudspeakers.
- **ITD + ILD** - spherical-head model producing an interaural
  time difference (via fractional delay) and an interaural level
  difference (via a first-order shelf). Aimed at headphones.

Source: [`reiss-mcpherson-panning/`](https://github.com/truce-audio/reiss-mcpherson-effects/tree/main/plugins/reiss-mcpherson-panning).

## What it demonstrates

- Two pan implementations sharing the same parameter surface,
  selected by `EnumParam`
- Per-channel short delay lines for the time-difference half
- A simple shelf filter for the level-difference half
