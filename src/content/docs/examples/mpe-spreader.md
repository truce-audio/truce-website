# MPE Spreader

<img src="/screenshots/examples/mpe-spreader.png" class="screenshot-hero" width="208" height="182" alt="mpe-spreader plugin">

MIDI effect that promotes MIDI 1.0 to MIDI 2.0 and spreads notes
across the channel address space, with per-note vibrato and
brightness modes. A test vehicle for truce's MIDI 2.0 encode
surface.

Source: [`examples/truce-example-mpe-spreader/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-mpe-spreader).

## What it demonstrates

- MIDI 2.0 output opt-in (`midi2_output = true` in `truce.toml`):
  every 1.0 channel-voice message is re-emitted as its 2.0
  `EventBody` (`NoteOn2`, `ControlChange2`, `PitchBend2`,
  `PolyPressure2`, `ChannelPressure2`, `ProgramChange2`)
- Value promotion via the `truce::core::midi` upscale helpers
  (`upscale_7_to_16`, `upscale_7_to_32`, `upscale_14_to_32`)
- MPE-style voice allocation: round-robin note fan across a
  configurable channel count
- Per-note expression output: a vibrato LFO emitted as 32-bit
  `PerNotePitchBend`, and the mod wheel routed to `PerNoteCC` 74
  (brightness) on every held note
- Recentering pitch bends on note-off and mode switches so no
  note is left detuned
- `#[derive(ParamEnum)]` algorithm selector rendered as a dropdown
  in a built-in `GridLayout` editor

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Algorithm | Passthrough / Channel Fan / Per-Note Vibrato (2.0 only) / MPE Vibrato / Mod Brightness | -- | How notes are addressed and which expression is generated |
| Channels | 1 to 16 | -- | Fan width for channel round-robin modes |
| Vibrato Rate | 0.1 to 12 (log) | Hz | Vibrato LFO rate |
| Vibrato Depth | 0 to 2 | st | Vibrato depth in semitones |

## Build and test

```bash
cargo build -p truce-example-mpe-spreader
cargo test -p truce-example-mpe-spreader
```
