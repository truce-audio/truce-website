# Examples

Example plugins covering effects, instruments, MIDI processors, and
GUI framework integrations. Each one lives under
[`examples/`](https://github.com/truce-audio/truce/tree/main/examples)
in the truce repo and is small enough to read top-to-bottom in one
sitting.

## Effects, instruments, MIDI

| Plugin | Type | GUI | Screenshot |
|--------|------|-----|-----------|
| [gain](./gain) | Effect | Built-in | <img src="/screenshots/examples/gain.png" width="208" height="251" alt="gain plugin"> |
| [eq](./eq) | Effect | Built-in | <img src="/screenshots/examples/eq.png" width="208" height="362" alt="eq plugin"> |
| [synth](./synth) | Instrument | Built-in | <img src="/screenshots/examples/synth.png" width="277" height="279" alt="synth plugin"> |
| [transpose](./transpose) | MIDI | Built-in | <img src="/screenshots/examples/transpose.png" width="139" height="113" alt="transpose plugin"> |
| [arpeggio](./arpeggio) | MIDI | Built-in | <img src="/screenshots/examples/arpeggio.png" width="139" height="182" alt="arpeggio plugin"> |
| [tremolo](./tremolo) | Effect | egui | <img src="/screenshots/examples/tremolo.png" width="270" height="162" alt="tremolo plugin"> |
| [state](./state) | Effect | egui | <img src="/screenshots/examples/state.png" width="320" height="120" alt="state plugin"> |
| [envelope](./envelope) | Effect | Built-in | <img src="/screenshots/examples/envelope.png" width="139" height="113" alt="envelope plugin"> |
| [cc-filter](./cc-filter) | Effect | Built-in | <img src="/screenshots/examples/cc-filter.png" width="139" height="113" alt="cc-filter plugin"> |
| [chord](./chord) | Instrument | Built-in | <img src="/screenshots/examples/chord.png" width="139" height="113" alt="chord plugin"> |
| [stereo-utility](./stereo-utility) | Effect | Built-in | <img src="/screenshots/examples/stereo-utility.png" width="208" height="210" alt="stereo-utility plugin"> |
| [dasp-bitcrusher](./dasp-bitcrusher) | Effect | Built-in | <img src="/screenshots/examples/dasp-bitcrusher.png" width="208" height="113" alt="dasp-bitcrusher plugin"> |
| [sysex-echo](./sysex-echo) | MIDI | Built-in | <img src="/screenshots/examples/sysex-echo.png" width="70" height="113" alt="sysex-echo plugin"> |
| [multiport](./multiport) | Instrument | Built-in | <img src="/screenshots/examples/multiport.png" width="277" height="210" alt="multiport plugin"> |
| [midi-inspector](./midi-inspector) | Effect | Iced | <img src="/screenshots/examples/midi-inspector.png" width="380" height="230" alt="midi-inspector plugin"> |
| [mpe-spreader](./mpe-spreader) | MIDI | Built-in | <img src="/screenshots/examples/mpe-spreader.png" width="208" height="182" alt="mpe-spreader plugin"> |
| [mpe-synth](./mpe-synth) | Instrument | Built-in | <img src="/screenshots/examples/mpe-synth.png" width="208" height="113" alt="mpe-synth plugin"> |
| [fundsp-reverb-simple](./fundsp-reverb-simple) | Effect | Built-in | <img src="/screenshots/examples/fundsp-reverb-simple.png" width="208" height="182" alt="fundsp-reverb-simple plugin"> |
| [fundsp-reverb-worker](./fundsp-reverb-worker) | Effect | Built-in | <img src="/screenshots/examples/fundsp-reverb-worker.png" width="208" height="182" alt="fundsp-reverb-worker plugin"> |

The two `fundsp-reverb-*` crates share a topology and signal
flow but rebuild the graph differently; the [fundsp integration
guide](../guide/fundsp) walks through both.

## GUI framework comparison

The same plugin written across five GUI backends. Compare them to
see how each framework handles the same layout.

### Gain (small editor, four widgets)

| Plugin | GUI | Screenshot |
|--------|-----|-----------|
| [gain](./gain) | Built-in | <img src="/screenshots/examples/gain.png" width="208" height="251" alt="gain (built-in)"> |
| [gain-egui](./gain-egui) | egui | <img src="/screenshots/examples/gain-egui.png" width="176" height="290" alt="gain-egui"> |
| [gain-iced](./gain-iced) | Iced | <img src="/screenshots/examples/gain-iced.png" width="176" height="290" alt="gain-iced"> |
| [gain-slint](./gain-slint) | Slint | <img src="/screenshots/examples/gain-slint.png" width="176" height="290" alt="gain-slint"> |
| [gain-vizia](./gain-vizia) | Vizia | <img src="/screenshots/examples/gain-vizia.png" width="176" height="260" alt="gain-vizia"> |

A sixth variant, [gain-egui-aspect](./gain-egui-aspect), is the
egui gain with a 2:3 aspect-ratio lock on host resize.

### GUI Zoo (every widget kind, mixed spans + positions)

A passthrough plugin that exercises every built-in widget kind
(knob, slider, toggle, dropdown, meter, XY pad) across mixed grid
spans and positions. Layout / widget regressions surface here
before they reach the real example plugins; it's also the natural
reference when picking a GUI framework.

| Plugin | GUI | Screenshot |
|--------|-----|-----------|
| [gui-zoo](./gui-zoo) | Built-in | <img src="/screenshots/examples/gui-zoo.png" width="415" height="887" alt="gui-zoo (built-in)"> |
| [gui-zoo-egui](./gui-zoo-egui) | egui | <img src="/screenshots/examples/gui-zoo-egui.png" width="350" height="450" alt="gui-zoo-egui"> |
| [gui-zoo-iced](./gui-zoo-iced) | Iced | <img src="/screenshots/examples/gui-zoo-iced.png" width="350" height="450" alt="gui-zoo-iced"> |
| [gui-zoo-slint](./gui-zoo-slint) | Slint | <img src="/screenshots/examples/gui-zoo-slint.png" width="350" height="450" alt="gui-zoo-slint"> |
| [gui-zoo-vizia](./gui-zoo-vizia) | Vizia | <img src="/screenshots/examples/gui-zoo-vizia.png" width="302" height="460" alt="gui-zoo-vizia"> |

The slint + vizia variants live under
`crates/truce-{slint,vizia}/examples/` (their own Cargo
sub-workspaces — see the [vizia integration guide](../guide/gui/vizia)
for why) rather than the top-level `examples/` directory.

## Block DSP

| Plugin | Demonstrates | Screenshot |
|--------|--------------|-----------|
| [block-gain](./block-gain) | `truce_simd::math::db_to_linear_block` | <img src="/screenshots/examples/block-gain.png" width="208" height="251" alt="block-gain plugin"> |
| [block-drywet](./block-drywet) | `truce_simd::ops::mix_block` | <img src="/screenshots/examples/block-drywet.png" width="139" height="182" alt="block-drywet plugin"> |
| [block-gate](./block-gate) | `truce_simd::ops::abs_max_block` + `zero_block` | <img src="/screenshots/examples/block-gate.png" width="139" height="113" alt="block-gate plugin"> |
| [block-saturate](./block-saturate) | `truce_simd::math::tanh_block` | <img src="/screenshots/examples/block-saturate.png" width="139" height="182" alt="block-saturate plugin"> |
| [block-widen](./block-widen) | `truce_simd::ops::mac_block` | <img src="/screenshots/examples/block-widen.png" width="139" height="113" alt="block-widen plugin"> |
| [block-surround-meter](./block-surround-meter) | `truce_simd::math::linear_to_db_block` | <img src="/screenshots/examples/block-surround-meter.png" width="70" height="251" alt="block-surround-meter plugin"> |

Each `block-*` example isolates one `truce_simd::ops::*` or
`truce_simd::math::*` shape. See the [SIMD section of the
processing guide](../guide/processing#compile-time-simd-baseline)
for the design.

## Out-of-tree

Larger examples live in their own repos — useful when you want to
see what truce looks like at the scale of a real plugin rather
than a 100-line teaching example.

### Reiss & McPherson effects

15 effects ported from Reiss & McPherson's *Audio Effects: Theory,
Implementation and Application* (originally Juan Gil's JUCE
implementations). Sources in
[reiss-mcpherson-effects](https://github.com/truce-audio/reiss-mcpherson-effects).

| Plugin | Effect | Screenshot |
|--------|--------|-----------|
| [reiss-delay](./reiss-delay) | Circular-buffer delay | <img src="/screenshots/reiss-mcpherson/delay.png" width="208" height="113" alt="Reiss Delay"> |
| [reiss-vibrato](./reiss-vibrato) | LFO-modulated delay (pitch wobble) | <img src="/screenshots/reiss-mcpherson/vibrato.png" width="415" height="113" alt="Reiss Vibrato"> |
| [reiss-flanger](./reiss-flanger) | Modulated short delay + dry sum | <img src="/screenshots/reiss-mcpherson/flanger.png" width="415" height="182" alt="Reiss Flanger"> |
| [reiss-chorus](./reiss-chorus) | Multi-voice ensemble chorus | <img src="/screenshots/reiss-mcpherson/chorus.png" width="346" height="182" alt="Reiss Chorus"> |
| [reiss-pingpong](./reiss-pingpong) | Cross-channel ping-pong delay | <img src="/screenshots/reiss-mcpherson/pingpong.png" width="277" height="113" alt="Reiss Ping-Pong"> |
| [reiss-parametric-eq](./reiss-parametric-eq) | Single-band parametric EQ (7 shapes) | <img src="/screenshots/reiss-mcpherson/parametric-eq.png" width="346" height="113" alt="Reiss Parametric EQ"> |
| [reiss-wahwah](./reiss-wahwah) | Manual / LFO / envelope wah | <img src="/screenshots/reiss-mcpherson/wahwah.png" width="415" height="210" alt="Reiss Wah-Wah"> |
| [reiss-phaser](./reiss-phaser) | Cascaded all-pass phaser | <img src="/screenshots/reiss-mcpherson/phaser.png" width="346" height="182" alt="Reiss Phaser"> |
| [reiss-tremolo](./reiss-tremolo) | LFO amplitude modulation | <img src="/screenshots/reiss-mcpherson/tremolo.png" width="277" height="113" alt="Reiss Tremolo"> |
| [reiss-ringmod](./reiss-ringmod) | Ring modulation | <img src="/screenshots/reiss-mcpherson/ringmod.png" width="277" height="113" alt="Reiss Ring Mod"> |
| [reiss-compressor](./reiss-compressor) | Compressor / expander / gate | <img src="/screenshots/reiss-mcpherson/compressor.png" width="277" height="182" alt="Reiss Compressor"> |
| [reiss-distortion](./reiss-distortion) | 5-shape waveshaper + tone shelf | <img src="/screenshots/reiss-mcpherson/distortion.png" width="346" height="113" alt="Reiss Distortion"> |
| [reiss-panning](./reiss-panning) | Panorama+precedence / ITD+ILD pan | <img src="/screenshots/reiss-mcpherson/panning.png" width="208" height="113" alt="Reiss Panning"> |
| [reiss-robotization](./reiss-robotization) | Phase-vocoder robot / whisper | <img src="/screenshots/reiss-mcpherson/robotization.png" width="415" height="113" alt="Reiss Robotization"> |
| [reiss-pitchshift](./reiss-pitchshift) | Phase-vocoder pitch shifter | <img src="/screenshots/reiss-mcpherson/pitchshift.png" width="277" height="113" alt="Reiss Pitch Shift"> |

### Utility plugins

| Plugin | What it shows |
|--------|---------------|
| [truce-analyzer](https://github.com/truce-audio/truce-analyzer) | Real-time spectrum analyzer with diff overlay; non-trivial GUI built on truce. |

## Building

```bash
cargo build --workspace                       # build all
cargo test --workspace                        # run all tests
cargo truce build                             # build every format into target/bundles/
cargo truce install -p truce-example-gain     # install one plugin
cargo truce run -p truce-example-synth        # run a plugin standalone
cargo truce validate -p truce-example-gain    # auval + pluginval + clap-validator
```

## Project structure

Each example follows the same layout:

```
examples/<name>/
├── Cargo.toml
└── src/
    └── lib.rs
```

GUI framework examples may have additional files:

```
examples/gain-slint/
├── build.rs              # slint-build compilation
└── ui/
    └── main.slint        # declarative UI markup
```
