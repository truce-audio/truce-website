# Examples

Example plugins covering effects, instruments, MIDI processors, and
GUI framework integrations. Each one lives under
[`examples/`](https://github.com/truce-audio/truce/tree/main/examples)
in the truce repo and is small enough to read top-to-bottom in one
sitting.

## Plugins

| Plugin | Type | GUI | Screenshot |
|--------|------|-----|-----------|
| [gain](./gain) | Effect | Built-in | <img src="/screenshots/examples/gain.png" style="max-width: 300px; max-height: 200px;" alt="gain plugin"> |
| [eq](./eq) | Effect | Built-in | <img src="/screenshots/examples/eq.png" style="max-width: 300px; max-height: 200px;" alt="eq plugin"> |
| [synth](./synth) | Instrument | Built-in | <img src="/screenshots/examples/synth.png" style="max-width: 300px; max-height: 200px;" alt="synth plugin"> |
| [transpose](./transpose) | MIDI | Built-in | <img src="/screenshots/examples/transpose.png" style="max-width: 300px; max-height: 200px;" alt="transpose plugin"> |
| [arpeggio](./arpeggio) | MIDI | Built-in | <img src="/screenshots/examples/arpeggio.png" style="max-width: 300px; max-height: 200px;" alt="arpeggio plugin"> |
| [tremolo](./tremolo) | Effect | egui | <img src="/screenshots/examples/tremolo.png" style="max-width: 300px; max-height: 200px;" alt="tremolo plugin"> |
| [state](./state) | Effect | egui | <img src="/screenshots/examples/state.png" style="max-width: 300px; max-height: 200px;" alt="state plugin"> |
| [fundsp-reverb-simple](./fundsp-reverb-simple) | Effect | Built-in | <img src="/screenshots/examples/fundsp-reverb-simple.png" style="max-width: 300px; max-height: 200px;" alt="fundsp-reverb-simple plugin"> |
| [fundsp-reverb-worker](./fundsp-reverb-worker) | Effect | Built-in | <img src="/screenshots/examples/fundsp-reverb-worker.png" style="max-width: 300px; max-height: 200px;" alt="fundsp-reverb-worker plugin"> |
| [gain-egui](./gain-egui) | Effect | egui | <img src="/screenshots/examples/gain-egui.png" style="max-width: 300px; max-height: 200px;" alt="gain-egui plugin"> |
| [gain-iced](./gain-iced) | Effect | Iced | <img src="/screenshots/examples/gain-iced.png" style="max-width: 300px; max-height: 200px;" alt="gain-iced plugin"> |
| [gain-slint](./gain-slint) | Effect | Slint | <img src="/screenshots/examples/gain-slint.png" style="max-width: 300px; max-height: 200px;" alt="gain-slint plugin"> |
| [block-gain](./block-gain) | Effect | Built-in | <img src="/screenshots/examples/block-gain.png" style="max-width: 300px; max-height: 200px;" alt="block-gain plugin"> |
| [block-drywet](./block-drywet) | Effect | Built-in | <img src="/screenshots/examples/block-drywet.png" style="max-width: 300px; max-height: 200px;" alt="block-drywet plugin"> |
| [block-gate](./block-gate) | Effect | Built-in | <img src="/screenshots/examples/block-gate.png" style="max-width: 300px; max-height: 200px;" alt="block-gate plugin"> |
| [block-saturate](./block-saturate) | Effect | Built-in | <img src="/screenshots/examples/block-saturate.png" style="max-width: 300px; max-height: 200px;" alt="block-saturate plugin"> |
| [block-widen](./block-widen) | Effect | Built-in | <img src="/screenshots/examples/block-widen.png" style="max-width: 300px; max-height: 200px;" alt="block-widen plugin"> |
| [block-surround-meter](./block-surround-meter) | Effect | Built-in | <img src="/screenshots/examples/block-surround-meter.png" style="max-width: 300px; max-height: 200px;" alt="block-surround-meter plugin"> |

The four gain variants (`gain`, `gain-egui`, `gain-iced`,
`gain-slint`) implement the same plugin with different GUI
frameworks. Compare them to see how each framework handles the
same layout.

The six `block-*` examples each isolate one `truce_simd::ops::*`
or `truce_simd::math::*` shape (`mix_block`, `mac_block`,
`abs_max_block` + `zero_block`, `tanh_block`,
`db_to_linear_block`, `linear_to_db_block`). See the [SIMD
section of the processing guide](../guide/processing#compile-time-simd-baseline)
for the design.

The two `fundsp-reverb-*` crates share a topology and signal
flow but rebuild the graph differently; the [fundsp integration
guide](../guide/fundsp) walks through both.

## Out-of-tree

Larger examples live in their own repos — useful when you want to
see what truce looks like at the scale of a real plugin rather
than a 100-line teaching example.

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
