# Envelope

<img src="/screenshots/examples/envelope.png" class="screenshot-hero" width="139" height="113" alt="envelope plugin">

Envelope follower to MIDI CC: tracks the input signal's level and
emits it as a control-change while passing the audio through
unchanged. Drop it on a track and use that track's dynamics to
modulate another instrument or effect over MIDI.

Source: [`examples/truce-example-envelope/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-envelope).

## What it demonstrates

- Plugin-to-host MIDI output: `midi_output = true` in `truce.toml`
  plus `context.output_events.push(Event::new(..))` with
  `EventBody::ControlChange`
- Sample-accurate event timestamps, emitting on 7-bit value change
  instead of once per block
- De-duplication of consecutive identical CC values so a steady
  level does not flood the host
- A peak follower with instant attack and a parameterized release
  (`log(..)` range, `smooth = "exp(10)"` on the Release param)
- Explicit `bus_layouts()` returning `BusLayout::stereo()` and
  bit-exact audio passthrough via `buffer.io(ch)` +
  `copy_from_slice`

## Parameters

| Name | Range | Unit |
|------|-------|------|
| CC | 0 to 127 (discrete, default 1) | CC number |
| Release | 1 to 1000 (log, default 100) | ms |
