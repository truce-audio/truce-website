# Chord

<img src="/screenshots/examples/chord.png" class="screenshot-hero" width="139" height="113" alt="chord plugin">

Chord instrument: play one note, hear a triad (or 7th), and the
chord's notes are also emitted to the host as MIDI so they can
drive a second instrument.

Source: [`examples/truce-example-chord/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-chord).

## What it demonstrates

- Instrument that emits MIDI (`midi_output = true` in `truce.toml`
  so every format declares its MIDI output port/bus)
- `EnumParam<ChordType>` with `#[derive(ParamEnum)]` and
  `#[name = "..."]` variant labels
- Emitting `NoteOn` / `NoteOff` events via
  `ProcessContext::output_events` at the incoming event's
  `sample_offset`
- Last-note priority with matched `NoteOff` emission for every
  sounding voice, preventing stuck notes downstream
- Output-only bus layout
  (`BusLayout::new().with_output("Main", ChannelConfig::Stereo)`)
- Built-in `GridLayout` editor with `dropdown` and `knob` widgets

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Chord | Major, Minor, Maj7, Min7, Sus4 | -- | Chord quality as intervals from the played root |
| Gain | 0 to 1 | % | Output level, smoothed (`smooth = "exp(5)"`) |

## Build and test

```bash
cargo build -p truce-example-chord
cargo test -p truce-example-chord
```
