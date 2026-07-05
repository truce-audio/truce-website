# Stereo Utility

<img src="/screenshots/examples/stereo-utility.png" class="screenshot-hero" width="208" height="210" alt="stereo-utility plugin">

Stereo utility with independent gain, polarity invert, and up to
50 ms of delay per side. Its real subject is parameter-group
reuse: one `ChannelStrip` struct drives both channels.

Source: [`examples/truce-example-stereo-utility/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-stereo-utility).

## What it demonstrates

- `#[nested]` param groups: `ChannelStrip` is declared once and
  pulled in twice; bare `#[nested]` rebases each slot to its own
  id range derived from the field name, so left and right resolve
  to distinct controls with no hand-written ids
- Addressing reused-group params in the editor by flattened id
  (`self.params.left.gain.id()`) instead of the derived `ParamId`
  enum
- Built-in `GridLayout` editor with two `section(..)` groups
  mixing `knob` and `toggle` widgets
- Per-channel delay lines sized in `reset()` from the sample rate,
  with block-rate delay/polarity reads and per-sample smoothed
  gain (`smooth = "exp(5)"`, `db_to_linear`)
- The broad `truce-test` assertion suite: param id uniqueness,
  normalized round-trips, AU metadata, state resilience, editor
  lifecycle, and screenshot baselines

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Left Gain | -60 to +12 (default 0) | dB |
| Left Invert | off/on | toggle |
| Left Delay | 0 to 50 (default 0) | ms |
| Right Gain | -60 to +12 (default 0) | dB |
| Right Invert | off/on | toggle |
| Right Delay | 0 to 50 (default 0) | ms |
