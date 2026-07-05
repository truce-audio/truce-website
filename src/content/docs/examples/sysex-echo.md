# SysEx Echo

<img src="/screenshots/examples/sysex-echo.png" class="screenshot-hero" width="70" height="113" alt="sysex echo plugin">

MIDI effect that echoes every received SysEx message back to the
host unchanged, exercising the plugin-to-host SysEx output path
and per-format `0xF0..0xF7` framing.

Source: [`examples/truce-example-sysex-echo/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-sysex-echo).

## What it demonstrates

- Audio-less MIDI effect (`BusLayout::new()` with no audio I/O;
  `category = "midi"` in `truce.toml`)
- Matching `EventBody::SysEx` and reading variable-length payloads
  with `EventList::sysex_bytes`
- Emitting SysEx via `ProcessContext::output_events` with
  `push_sysex`, dropping (never truncating) on a full byte pool
- MIDI 2.0 output (`midi2_output = true`) so the echo exercises
  SysEx-over-UMP on AU v3 while input stays MIDI 1.0
- `driver!`-based integration test proving SysEx survives a
  mid-block sub-block split from a Transport event

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Enabled | off/on | -- | When off, incoming SysEx is not echoed |

## Build and test

```bash
cargo build -p truce-example-sysex-echo
cargo test -p truce-example-sysex-echo
```
