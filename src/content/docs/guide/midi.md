# 8. MIDI

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

### MIDI 2.0

The wire dialect is opt-in per plugin. Without the opt-in
everything is MIDI 1.0: a host speaking MIDI 2.0 gets its channel
voice down-converted before delivery, so a plugin that didn't ask
never sees the 2.0 `EventBody` variants.

```toml
[[plugin]]
category = "instrument"
midi2 = true              # both directions
```

`midi2 = true` covers both directions; `midi2_input` /
`midi2_output` override one at a time (absent, each follows
`midi2`). The keys require a MIDI port in the direction they
name: `midi2_input = true` on a plugin with no MIDI input is a
compile error, and the blanket `midi2 = true` needs at least one
port in either direction.

What the opt-in buys per format:

- **CLAP** advertises the MIDI2 note dialect and carries the
  native 16/32-bit and per-note variants both ways
  (`CLAP_EVENT_MIDI2` UMP in; CLAP-native notes, expressions,
  and raw MIDI out).
- **AU v3** declares `audioUnitMIDIProtocol` = 2.0 so the host
  delivers native UMP; output rides the host's `MIDIEventList`
  block in the host's protocol, with the byte block as fallback
  (macOS 12+ / iOS 15+).
- **VST3** has no UMP transport; the per-note subset crosses as
  note expression instead - see the coverage table below.
- **VST2, AU v2, AAX, LV2** stay MIDI 1.0 regardless.

[`examples/truce-example-midi-inspector`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-midi-inspector)
decodes every event truce can deliver into a live scrolling log -
useful for eyeballing what a host actually sends on each dialect.

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

MIDI 2.0 companions, same module:

- `upscale_7_to_16(u8) -> u16`, `upscale_7_to_32(u8) -> u32`,
  `upscale_14_to_32(u16) -> u32` - the spec's min-center-max
  up-scaling, not a plain shift: center and max map exactly
  (`64 → 0x8000`, `127 → 0xFFFF`), so a centered 1.0 value stays
  centered in 2.0.
- `upconvert_to_midi2(&EventBody) -> Option<EventBody>` and
  `downconvert_to_midi1(&EventBody) -> Option<EventBody>` -
  whole-event dialect conversion. Going up, a `NoteOn` with
  velocity 0 becomes a `NoteOff2` (the spec's translation rule).
  Going down, per-note controllers collapse onto their note's
  channel, MPE-style. `None` means the body is already in the
  target dialect or has no equivalent there.
- `per_note_bend_semitones(u32) -> f64` and
  `per_note_bend_from_semitones(f64) -> u32` - 32-bit per-note
  pitch bend to and from semitones at the shared ±48 st
  full-scale (saturating on the way in).

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
(`0..num_samples`). Each wrapper translates outbound events into
its host transport: a MIDI 1.0 byte stream on VST2 / AU v2 / AAX /
LV2, CLAP-native events on CLAP, the host's `MIDIEventList`
protocol on AU v3. On a MIDI 1.0 path, 2.0 bodies down-convert
where a 1.0 equivalent exists and are dropped otherwise - emit
the 2.0 variants only from plugins opted into `midi2`.

The arpeggiator example in [`examples/truce-example-arpeggio-paranoid`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio-paranoid)
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

## Host MIDI compatibility

The table above is truce's half of the contract. The other half is
the host: which slots accept a MIDI plugin, what survives
plugin-to-plugin routing, and how much of MIDI 2.0 is carried all
vary enough that the host - not the wrapper - usually decides what
your plugin actually sees. Notes from testing real hosts,
**current as of July 2026**; expect the details to shift host by
host.

### Bitwig Studio

- The reference host for CLAP MIDI 2.0: it honors the advertised
  MIDI2 note dialect and delivers native `CLAP_EVENT_MIDI2` UMP to
  a `midi2` plugin.
- On the *output* side its note graph consumes CLAP-native events -
  `clap_event_note` plus `CLAP_EVENT_NOTE_EXPRESSION` - not UMP. A
  plugin emitting only raw UMP is silent in Bitwig, which is why
  truce emits 2.0 output CLAP-natively (notes with full 16-bit
  velocity through the `f64` field, per-note control as note
  expressions, channel voice down-converted to raw MIDI).
- Per-note expressions ride `note_id` addressing, and stopping a
  clip sends wildcard note-offs - Bitwig is the host that exercises
  the wildcard paths.
- Overall the best desktop host for testing per-note and multi-port
  CLAP.

### Logic Pro

- On AU v3 the protocol negotiation works as Apple documents it:
  the appex receives input in its declared `audioUnitMIDIProtocol`,
  and CoreAudio auto-converts its output to the host's
  `hostMIDIProtocol`. A 2.0-emitting plugin needs no 1.0 fallback
  path of its own.
- The MIDI FX → instrument hop runs at the MIDI 1.0 byte level:
  notes survive the down-conversion, but per-note pitch bend and
  per-note CCs (no 1.0 equivalent) are silently dropped, and the
  UMP group is flattened. Channel-level pitch bend survives -
  MPE-style channel rotation is the portable way to push per-note
  bends through Logic's MIDI FX slot.
- A `.component` loads as AU **v2**, whose MIDI I/O
  (`MusicDeviceMIDIEvent`) is 1.0-only - the v2 build can't carry
  native 2.0 in either direction regardless of what Logic supports.
  UMP I/O exists only on the AU v3 appex.

### Cubase

- The home of VST3 note expression: it queries
  `INoteExpressionController` and sends nothing to a plugin that
  doesn't declare it (truce does).
- It sends release-phase expression - value events arriving after
  the note-off - so expression handling can't assume the note is
  still sounding. truce keeps its note-id mappings alive past
  note-off for exactly this.
- Third-party VST3 plugins can't be MIDI inserts in Cubase, so a
  note-effect → synth chain can't be built there at all. Note
  expression in Cubase is host-originated (its editor, an MPE
  controller) and delivered straight to the instrument.

### REAPER

- Routes one plugin's MIDI output onward by flattening it to a
  MIDI 1.0 byte stream - VST3 note expression doesn't survive the
  plugin-to-plugin hop. Same attrition rule as Logic's MIDI FX
  path: 1.0-expressible data survives, per-note data doesn't.
- Channel controllers reach a VST3 plugin only as `IMidiMapping`
  parameter changes; truce synthesizes the bend / CC / pressure
  events back from its hidden proxy parameters, so plugin code
  never notices.
- Its CLAP support trails its VST3 support: note effects don't
  surface as MIDI effects, and per-track MIDI buses map to VST3
  event buses only (see
  [multi-port routing](#getting-midi-onto-a-port-in-a-host)).

### Ableton Live

- No inline path for MIDI-processing plugins at all: the MIDI-effect
  slot accepts only Live's own devices and Max for Live, audio
  effects receive audio (never the track's MIDI), and only the
  instrument slot receives the track's MIDI. A note effect has to
  pose as an instrument and be routed track-to-track.
- Live also thins high-rate CC streams before they reach a plugin,
  so don't calibrate CC-driven DSP against what Live delivers.

### AUM (iOS)

- The practical test bench for AU v3 MIDI: a 2.0-capable host that
  honors `MIDIOutputNames`, so multi-cable MIDI output routing
  actually works there.
- Lists `aumi` note effects in a dedicated MIDI-effect slot and
  routes MIDI to them - coverage of the newer AU v3 MIDI APIs is
  uneven across AU hosts, and AUM is ahead of most desktop ones.

### The pattern

Host → plugin and plugin → host native 2.0 work where the format
table says they do. The consistently weak link is **plugin →
plugin** routing, which nearly every host performs at the MIDI 1.0
byte level: per-note data with a 1.0 equivalent survives the hop,
everything else is dropped. Emit per-note events for the hosts that
carry them, and fall back to MPE-style channel spread plus channel
pitch bend when output must survive an inter-plugin hop. The same
skepticism applies inbound - hosts don't always honor the
advertised dialect, so truce down-converts stray 2.0 packets for
1.0 plugins rather than dropping them.

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
([`examples/truce-example-arpeggio-paranoid/src/lib.rs`](https://github.com/truce-audio/truce/blob/main/examples/truce-example-arpeggio-paranoid/src/lib.rs))
cover the full MIDI-in / MIDI-out shape end to end.

## What's next

- **[Chapter 8 → gui](gui.md)** — visualise note state,
  expose CC mappings as parameters.
- **[Chapter 14 → hot-reload](hot-reload.md)** — iterate on
  arp logic without restarting the DAW.
- **[`examples/truce-example-arpeggio-paranoid`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio-paranoid)** in the repo — full
  MIDI in → MIDI out plugin with state, transport, and tests.
- **[`examples/truce-example-synth`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-synth)** — MIDI in → audio out
  with sample-accurate event handling.
