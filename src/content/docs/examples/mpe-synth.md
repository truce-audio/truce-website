# MPE Synth

<img src="/screenshots/examples/mpe-synth.png" class="screenshot-hero" width="208" height="113" alt="mpe-synth plugin">

Per-note-expressive polyphonic synth that decodes native MIDI 2.0:
16-bit velocity, 32-bit per-note pitch bend, and per-note
brightness. The render half of the [MPE Spreader](mpe-spreader.md) -
it makes the spreader's per-note expression audible.

Source: [`examples/truce-example-mpe-synth/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-mpe-synth).

## What it demonstrates

- MIDI 2.0 input opt-in (`midi2 = true` in `truce.toml`) so the
  host delivers native 2.0 events at full resolution
- Per-voice expression decode: `NoteOn2` 16-bit velocity to
  amplitude, `PerNotePitchBend` (32-bit) to per-voice detune,
  `PerNoteCC` 74 to per-voice filter cutoff, `PitchBend2` to
  channel-wide bend
- 1.0 fallback arms for every 2.0 event (`NoteOn`, `PitchBend`,
  `ControlChange`) so the synth plays on VST2 / AU v2 / AAX / LV2
  at 7/14-bit resolution
- `ControlChange2` 74 driving a host-visible parameter
  (`master_cutoff.set_value`) as a 32-bit macro
- MIDI channel mapped to equal-power stereo pan, so a
  channel-fanned chord spreads across the field; 32-voice pool
  with release-aware stealing
- Sample-accurate event dispatch inside the render loop,
  `ProcessStatus::Tail`, smoothed params via `read_after`

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Master Cutoff | 0 to 1 | % | Master filter cutoff macro scaling every voice's brightness |
| Release | 0.01 to 4 | s | Amp envelope release time |
| Volume | -60 to 6 | dB | Output level |
