# Changelog

Notable changes per release. Pre-1.0, so minor version bumps may
include breaking changes — those are called out under **Breaking**.

## 0.38.1 — 2026-05-12

- LV2: Add packaging support.

## 0.38.0 — 2026-05-12

- LV2: Fix MIDI effect categorization.
- Improved precision ergonomics using fundsp-style preludes.
- **Breaking:** renamed `param.smoothed_next()` to `param.read()` to support consistent float precision use. Upgrade path is a mechanical.
- Minor fixes.

## Backlog

### Known gaps

- **Retail iLok / PACE round-trip.** PACE wraptool is wired and
  exercised against a dev iLok account; we haven't yet round-tripped
  through a retail iLok + retail Pro Tools install. Needed before
  documenting AAX as production-ready.
- **Pro Tools shell-mode smoke test.** Manual: load a `--shell` AAX
  bundle in Pro Tools Developer, confirm hot-reload fires. Pro
  Tools' loader vs. dlopen behavior is the open question.
- **Authenticode round-trip with a real cert.** The Azure Trusted
  Signing / SHA1 thumbprint / `.pfx` paths are wired but haven't
  been exercised with a real EV / OV cert end-to-end.

### Future

- More example plugins (delay, compressor, reverb).
- WebView GUI backend.
- Distribution-grade dynamic shell (today's `--shell` is dev-loop
  only; making it a shipping mechanism is a phase-2 question).
