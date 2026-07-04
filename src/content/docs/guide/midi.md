# 7. MIDI

MIDI events ride the same `EventList` as parameter automation —
they're just variants of `EventBody`. Reading them is a `match`
on the body; emitting them is `context.output_events.push(...)`.

The framework hands you wire-native integers (7-bit `u8`, 14-bit
`u16`, MIDI 2.0 16/32-bit) so values round-trip exactly with the
host. Float helpers are one function call away when you want
them.

## Declaring a MIDI plugin

Every plugin sees MIDI input that the host sends to it. What
varies is whether the plugin produces audio, MIDI, or both.

| Plugin shape | `truce.toml` `category` | Example |
|---|---|---|
| Audio effect (may also accept MIDI) | `"effect"` | EQ, compressor, synth-style filter |
| Instrument (MIDI in, audio out) | `"instrument"` | Synth, sampler |
| Note effect (MIDI in, MIDI out) | `"midi"` | Arpeggiator, transpose, chord generator |
| Analyzer (no audio out) | `"analyzer"` | Spectrum, level meter |

Set `category = "midi"` for note effects so each format wrapper
opens its MIDI I/O path:

- VST3 / CLAP: registers a MIDI input *and* output bus.
- AU: builds as `aumi` (MIDI FX), routed to Logic's MIDI FX slot.
- AAX: registers `LocalInput` + `LocalOutput` MIDI nodes.
- LV2: emits an `atom:Sequence` output port in addition to the
  input.

Set `category = "instrument"` for synths so wrappers register
MIDI input + audio output (and AU builds as `aumu`).

By default a plugin's MIDI I/O follows its `category`: instruments
and note effects accept MIDI input, and only note effects emit MIDI
output. Override either direction per plugin with the `midi_input`
and `midi_output` keys in `truce.toml` (see the
[`truce.toml` reference](../reference/truce-toml.md)). They apply
consistently across CLAP, VST3, VST2, AU, AAX, and LV2:

- An audio effect that reacts to MIDI (a CC-controlled filter) sets
  `midi_input = true`. On AU this registers it as an `aumf`
  MusicEffect so the host routes MIDI to it.
- An instrument or effect that also emits MIDI (a chord generator,
  an envelope-to-CC follower) sets `midi_output = true` so every
  format declares its MIDI output port/bus.

### Multiple MIDI ports

Most plugins have one MIDI in and/or out port. A plugin that needs
more - a router, a merger, a per-destination sequencer - declares the
count with `midi_input_ports` / `midi_output_ports` in `truce.toml`:

```toml
[[plugin]]
category = "midi"
midi_output_ports = 4    # one input port, four output ports
```

A port count is authoritative: a non-zero `midi_input_ports` /
`midi_output_ports` enables that direction's MIDI capability on every
format by itself, `0` disables it, and a count that contradicts
`midi_input` / `midi_output` is a compile error.

Each `Event` carries a `port` field. Inbound, filter by `event.port`;
outbound, stamp the target port with `Event::on_port(offset, port, body)`
(the plain `Event::new(offset, body)` uses port `0`). CLAP (N note ports),
VST3 (N event buses), and LV2 (N atom ports) carry more than one MIDI
port in both directions. On VST3 this includes the channel controllers
(CC / pitch bend / pressure), which VST3 delivers as parameter changes
rather than events: truce advertises a separate bank of hidden mapping
parameters per event bus, so each port's controllers decode back onto
that port instead of merging. AU v3 carries multiple MIDI *output* ports
(`MIDIOutputNames`, one per declared output; host support varies); its
MIDI input, plus VST2, AU v2, and AAX, clamp to a single port and route
everything to port `0`, logging a one-line skip so the truncation isn't
silent.

#### Getting MIDI onto a port in a host

Declaring the ports is the easy half. Whether the host lets a user
*route* a distinct MIDI source to each port is entirely up to the
host, and the story is bumpier than the API suggests:

- **REAPER** maps its per-track MIDI buses (B1–B16) to plugin ports,
  but only for the **VST3** build, and only after you enable
  **Map REAPER MIDI Buses to VST3 MIDI Buses** — it's off by default.
  Find it in the FX window: click the pin-connector button (the one
  showing e.g. `2/64 out`), then the small **I/O** button in the
  top-right of the grid, and tick the mapping. Then a track send set
  to `Bus 2` reaches the plugin's port `1`. REAPER does **not** map
  buses to CLAP note ports today, so a CLAP plugin gets everything on
  port `0` — bus-2 traffic even arrives wrapped in a proprietary
  SysEx envelope (`F0 FF 52 50 …`), which is REAPER's tell that the
  mapping is off or unsupported.
- **Bitwig** indexes CLAP note ports (it's ahead of REAPER on most
  CLAP surfaces), so it's the better host for testing multi-port
  CLAP.

If notes you routed to port 1 come out sounding like port 0's patch,
that's a host not delivering the second port. Confirm the plugin
itself dispatches `event.port` correctly before suspecting your code:
the `driver!` harness scripts on port `0` only, so build `Event`s
directly with `Event::on_port(offset, port, body)`, push them into an
`EventList`, and call `process` — the same delivery path a real
host's port routing hits. `truce-example-multiport` does exactly this
in its tests.

## The event model

```rust
pub struct Event {
    pub sample_offset: u32,    // 0..num_samples in this block
    pub port: u8,              // MIDI port; 0 unless the plugin declares more
    pub body: EventBody,
}

pub enum EventBody {
    // MIDI 1.0 channel voice
    NoteOn        { group, channel, note, velocity },           // u8 each
    NoteOff       { group, channel, note, velocity },
    Aftertouch    { group, channel, note, pressure },           // poly key pressure
    ChannelPressure { group, channel, pressure },
    ControlChange { group, channel, cc, value },                // 7-bit
    PitchBend     { group, channel, value: u16 },               // 14-bit, 8192 = center
    ProgramChange { group, channel, program },

    // MIDI 2.0 channel voice (wire-native 16/32-bit)
    NoteOn2 / NoteOff2     { ..., velocity: u16, attribute_type, attribute },
    PolyPressure2          { ..., pressure: u32 },
    PerNoteCC              { ..., cc, value: u32, registered },
    PerNotePitchBend       { ..., value: u32 },                 // 0x8000_0000 = center, full-scale ±48 st
    PerNoteManagement      { ..., flags },
    ControlChange2         { ..., cc, value: u32 },
    ChannelPressure2       { ..., pressure: u32 },
    PitchBend2             { ..., value: u32 },
    ProgramChange2         { ..., program, bank: Option<(u8, u8)> },
    RegisteredController   { ..., bank, index, value: u32 },    // RPN
    AssignableController   { ..., bank, index, value: u32 },    // NRPN

    // Plugin/host control (not MIDI)
    ParamChange { id, value },
    ParamMod    { id, note_id, value },                         // CLAP per-voice
    Transport   (TransportInfo),

    // System layer
    SysEx       { pool_offset, len },                           // bytes in EventList::sysex_bytes()
}
```

`EventBody` is `Copy`, so the audio path never clones an event.
`group` is the UMP group (0–15); legacy MIDI 1.0 wrappers fill
`0`. `channel` is 0–15.

The list is **stable-sorted by `sample_offset`** before your
plugin sees it. Ties stay in the order the host sent them, which
matters when (e.g.) a CC arrives at the same sample as a note-on.

## Reading MIDI input

The plugin sees `&EventList` in `process()`:

```rust
fn process(&mut self, buffer: &mut AudioBuffer, events: &EventList,
           context: &mut ProcessContext) -> ProcessStatus {
    for event in events.iter() {
        match &event.body {
            EventBody::NoteOn  { note, velocity, .. } => self.note_on(*note, *velocity),
            EventBody::NoteOff { note, .. }           => self.note_off(*note),
            EventBody::ControlChange { cc, value, .. } => self.cc(*cc, *value),
            EventBody::PitchBend { value, .. }         => self.pb(*value),
            _ => {}
        }
    }
    // ... DSP ...
    ProcessStatus::Normal
}
```

The `_ => {}` arm catches MIDI 2.0 / per-note variants you don't
care about. Drop it and you'll get a non-exhaustive-match error
that lists everything you missed — use it if you want the
compiler to flag a forgotten case.

SysEx payloads aren't stored inline on the event (a worst-case
~64 KiB body per event would blow up the audio thread's memory
footprint). Resolve them via the list:

```rust
EventBody::SysEx { .. } => {
    let bytes = events.sysex_bytes(&event.body);
    self.handle_sysex(bytes); // bytes are the inner payload,
                              // no leading 0xF0 / trailing 0xF7
}
```

For sample-accurate handling (synths, transient shapers),
interleave the event walk with the sample loop instead:

```rust
let mut next = 0;
for i in 0..buffer.num_samples() {
    while let Some(e) = events.get(next) {
        if e.sample_offset as usize > i { break; }
        match &e.body {
            EventBody::NoteOn  { note, velocity, .. } => self.note_on(*note, *velocity),
            EventBody::NoteOff { note, .. }           => self.note_off(*note),
            _ => {}
        }
        next += 1;
    }
    // render sample i...
}
```

## Reading values as floats

MIDI values are integers on the wire. Convert when DSP wants
floats:

```rust
use truce_core::midi::{norm_7bit, norm_pitch_bend};

EventBody::ControlChange { cc: 1, value, .. } => {
    self.mod_depth = norm_7bit(*value);              // 0..=127 → [0.0, 1.0]
}
EventBody::PitchBend { value, .. } => {
    self.bend_semitones = norm_pitch_bend(*value) * 2.0;  // [-1.0, 1.0)
}
```

Available helpers (`truce_core::midi::*`, re-exported from
`truce_utils::midi`):

- `norm_7bit(u8) -> f32` and `denorm_7bit(f32) -> u8` — velocity,
  CC, channel pressure, aftertouch, program change.
- `norm_pitch_bend(u16) -> f32` and `denorm_pitch_bend(f32) -> u16`
  — 14-bit pitch bend. Asymmetric: `0` decodes to `-1.0`,
  `8192` to `0.0`, `16383` to `~0.99987`.
- `pitch_bend_to_bytes(u16) -> (u8, u8)` and
  `pitch_bend_from_bytes(u8, u8) -> u16` — split / combine LSB +
  MSB. Format wrappers use these internally; plugins rarely
  need them.

## Emitting MIDI output

Push events onto `context.output_events`:

```rust
context.output_events.push(Event::new(
    e.sample_offset,
    EventBody::NoteOn {
        group: 0, channel: 0,
        note: 60, velocity: 100,
    },
));
```

Sample offsets must fall within the current block
(`0..num_samples`). The framework forwards each event to the
host's MIDI output as a MIDI 1.0 byte stream.

The arpeggiator example in [`examples/truce-example-arpeggio`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio)
walks held-note tracking + step scheduling:

```rust
EventBody::NoteOn  { note, .. } => self.held.push(*note),
EventBody::NoteOff { note, .. } => self.held.retain(|n| n != note),
// ...later, on each step boundary:
context.output_events.push(Event::new(
    step_offset,
    EventBody::NoteOn {
        group: 0, channel: 0,
        note: chosen_note, velocity: 96,
    },
));
```

## Format coverage

| Format | MIDI 1.0 in | MIDI 1.0 out | MIDI 2.0 in | MIDI 2.0 out | SysEx in/out | Notes |
|---|---|---|---|---|---|---|
| CLAP | ✅ | ✅ | ✅† | ✅† | ✅ / ✅ | With `midi2 = true`, advertises the MIDI2 note dialect and demuxes `CLAP_EVENT_MIDI2` UMP (channel voice + per-note, with group) both in and out; without it, host MIDI 2.0 arrives downconverted to 1.0 |
| VST3 | ✅ | ✅ | partial† | partial† | ✅ / ✅ | Per-note expression (volume, pan, tuning, vibrato, expression, brightness) maps to/from `PerNoteCC` / `PerNotePitchBend`, in *and* out; the plugin declares `INoteExpressionController` so hosts offer per-note input; outgoing `noteId` is keyed `(channel << 7) \| note`, incoming host `noteId`s resolve back to `(channel, note)`; per-note CCs with no predefined expression type degrade to channel CCs |
| VST2 | ✅ | ✅ | — | — | ✅ / ✅ | MIDI 1.0 only; opt-in per VST2's `canDo("receiveVstMidiEvent")` |
| AU v2 | ✅ | ✅ | — | — | — | `MusicDeviceMIDIEvent` is MIDI 1.0 only; no host path exists for MIDI 2.0 |
| AU v3 | ✅ | ✅ | ✅† | ✅† | ✅ / ✅ | With `midi2 = true` the appex declares `audioUnitMIDIProtocol` = 2.0 so a host delivers native UMP in; output rides `midiOutputEventListBlock` for every dialect, protocol-pure in the host's `hostMIDIProtocol` (all MT 0x4 in 2.0 lists, all MT 0x2 in 1.0 lists; SysEx as MT 0x3 chains), with the byte block as fallback (macOS 12+ / iOS 15+) |
| AAX | ✅ | ✅ | — | — | ✅ / ✅ | Pro Tools' MIDI tracks; see [`formats/aax`](../formats/aax.md) |
| LV2 | ✅ | ✅ | — | — | ✅ / ✅ | Hosts deliver `atom:Sequence`; emits one in turn for note effects |

† Native MIDI 2.0 *channel-voice* messages (`NoteOn2`,
`ControlChange2`, …) reach a plugin on CLAP and AU v3 - both gated on
`midi2 = true` in `truce.toml` (CLAP advertises the MIDI2 note
dialect; AU v3 declares `audioUnitMIDIProtocol` = 2.0). Without the
opt-in the host down-converts to 1.0, so a plugin that didn't ask for
MIDI 2.0 never sees the 2.0 variants. VST3 instead maps the per-note
subset through note expression. For emitting back to the host (also
gated on `midi2`): CLAP and AU v3 send the full 2.0 variants over UMP
end-to-end (CLAP via `CLAP_EVENT_MIDI2`, AU v3 via
`midiOutputEventListBlock`); VST3 sends the per-note subset (`PerNoteCC`
for the six predefined expression types, `PerNotePitchBend` for tuning)
as note-expression value events - a lossy, `noteId`-correlated mapping,
not UMP. The other wrappers stay MIDI 1.0 or rely on the host's own
downconvert.

Per-note conventions are shared across formats so the same event
sounds the same everywhere: `PerNotePitchBend` full-scale is ±48
semitones (the MPE convention; wider host bends saturate), and
per-note volume crosses in the `0..=4` linear-gain domain both CLAP
and VST3 define (`+12 dB` at wire full-scale, unity at the quarter
point).

## Testing MIDI plugins

`truce_test::driver!` scripts MIDI events sample-accurately —
same delivery path the format wrappers use, no host required.

```rust
use std::time::Duration;
use truce_test::{assertions, driver};

#[test]
fn arp_emits_step_per_quarter_at_120bpm() {
    let result = driver!(MyArp)
        .duration(Duration::from_secs(1))
        .capture_output_events(true)
        .script(|s| {
            s.note_on(60, 0.8);   // velocity is normalized [0, 1]
            s.note_on(64, 0.8);
            s.note_on(67, 0.8);
        })
        .run();

    let notes = result.output_events.iter()
        .filter(|e| matches!(e.body, EventBody::NoteOn { .. }))
        .count();
    assert_eq!(notes, 4);   // four quarter-note steps in one second at 120 BPM
}
```

The `Script` builder exposes one method per common MIDI 1.0
message — `note_on`, `note_off`, `cc`, `pitch_bend`,
`channel_pressure`, plus `set_param` for automation. Need
something else? `Script::raw(EventBody)` is the escape hatch and
takes any variant including MIDI 2.0 ones.

The arpeggiator example's tests
([`examples/truce-example-arpeggio/src/lib.rs`](https://github.com/truce-audio/truce/blob/main/examples/truce-example-arpeggio/src/lib.rs))
cover the full MIDI-in / MIDI-out shape end to end.

## What's next

- **[Chapter 8 → gui](gui.md)** — visualise note state,
  expose CC mappings as parameters.
- **[Chapter 14 → hot-reload](hot-reload.md)** — iterate on
  arp logic without restarting the DAW.
- **[`examples/truce-example-arpeggio`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio)** in the repo — full
  MIDI in → MIDI out plugin with state, transport, and tests.
- **[`examples/truce-example-synth`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-synth)** — MIDI in → audio out
  with sample-accurate event handling.
