# Multiport

<img src="/screenshots/examples/multiport.png" class="screenshot-hero" width="277" height="210" alt="multiport plugin">

Multi-timbral instrument with two MIDI input ports: the host routes
a separate track to each port, and each port plays its own
independently shaped sound (port 0 defaults to a sine pad, port 1
to a saw lead) from a single instance.

Source: [`examples/truce-example-multiport/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-multiport).

## What it demonstrates

- Multiple MIDI input ports (`midi_input_ports = 2` in
  `truce.toml`); VST3 event buses and CLAP note ports carry the
  port, other formats clamp to one
- Reading `event.port` to key voices by `(port, channel, note)`
  and select the per-port patch
- Nested parameter structs with `#[nested(base = 0)]` /
  `#[nested(base = 4)]` for stable flattened param ids
- Sample-accurate event handling: draining `events.get(next)`
  against `sample_offset` inside the render loop
- Block-rate smoothed reads with `read_after(n)` and voice
  stealing that prefers releasing voices
- `ProcessStatus::Tail(0)` when all voices are silent, plus
  `Event::on_port` in tests

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| P0 Wave | Sine, Saw, Square, Triangle | -- | Port 0 oscillator waveform (default Sine) |
| P0 Cutoff | 0 to 1 | % | Port 0 one-pole low-pass cutoff |
| P0 Release | 0.01 to 4 | s | Port 0 release time |
| P0 Volume | -60 to 6 | dB | Port 0 lane volume |
| P1 Wave | Sine, Saw, Square, Triangle | -- | Port 1 oscillator waveform (default Saw) |
| P1 Cutoff | 0 to 1 | % | Port 1 one-pole low-pass cutoff |
| P1 Release | 0.01 to 4 | s | Port 1 release time |
| P1 Volume | -60 to 6 | dB | Port 1 lane volume |

## Build and test

```bash
cargo build -p truce-example-multiport
cargo test -p truce-example-multiport
```
