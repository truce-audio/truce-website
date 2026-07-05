# MIDI Inspector

<img src="/screenshots/examples/midi-inspector.png" class="screenshot-hero" width="760" height="460" alt="midi-inspector plugin">

Audio effect with MIDI in/out that passes the track's audio through
untouched, forwards MIDI, and shows a live scrolling log of every
event it receives, decoded with a raw fallback line.

Source: [`examples/truce-example-midi-inspector/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-midi-inspector).

## What it demonstrates

- MIDI 2.0 opt-in (`midi2 = true` in `truce.toml`) so hosts
  deliver native 2.0 events (`NoteOn2`, `PerNoteCC`, ...) for
  full-resolution display
- Streaming structured realtime data (not just scalar meters) from
  the audio thread to the editor: a lock-free `EventRing`
  (`crossbeam_queue::ArrayQueue`) that `process()` pushes into and
  the editor drains each frame
- Sharing non-parameter state through a `#[skip]` field on the
  `#[derive(Params)]` struct, reached via the same `Arc` on both
  threads
- iced editor via `IcedEditor` / `IcedPlugin`, with
  `needs_redraw()` polling the ring so a live MIDI stream repaints
  promptly, plus pause / clear / category filters
- SysEx handling: `EventList::sysex_bytes` resolves payloads, and
  thru re-pushes them with `push_sysex_on_port` so bytes land in
  the output list's own pool
- Stereo passthrough bus (`BusLayout::stereo()`) so the plugin
  loads as an ordinary insert in audio-centric hosts that don't
  host MIDI-only plugins

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| MIDI Thru | on/off | -- | Forward every MIDI event to the output (on, default) or monitor only (off) |
