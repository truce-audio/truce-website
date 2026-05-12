# Changelog

Notable changes per release. Pre-1.0, so minor version bumps may
include breaking changes — those are called out under **Breaking**.

## 0.38.0 — 2026-05-12

- LV2: Fix MIDI effect categorization.
- Improved precision ergonomics using fundsp-style preludes.
- **Breaking:** renamed `param.smoothed_next()` to `param.read()` to support consistent float precision use. Upgrade path is a mechanical.
- Minor fixes.
