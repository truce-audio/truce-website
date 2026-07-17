# 5. Processing audio

`process()` is called on the audio thread for every block. Same
constraints as any audio plugin — no allocation, no locking, no
I/O, no `println!`. Rust's type system catches a lot of this; the
rest is up to you.

The signature is always:

```rust
fn process(
    state:   &mut Self::DspState,
    params:  &Self::Params,
    buffer:  &mut AudioBuffer,
    events:  &EventList,
    context: &mut ProcessContext,
) -> ProcessStatus;
```

Everything in this chapter is a different shape for that function.

## Buffer model

`AudioBuffer` exposes one slice per input channel and one mutable
slice per output channel, both borrowing host memory. Wrappers do
not copy input into output: read from `buffer.input(ch)` and write
to `buffer.output(ch)`. For instruments, output starts wherever the
host left it (typically zero, but don't assume — write every sample).

The slice element type is `f32` under `truce::prelude` and `f64`
under `truce::prelude64`. Where the format has a 64-bit wire - VST3
(`kSample64`), VST2 (`processDoubleReplacing`), CLAP (64-bit ports) -
a `prelude64` plugin reads and writes the host's `f64` buffers
directly, zero conversion; elsewhere (and whenever the host runs a
32-bit chain) the wrapper widens at the block boundary and narrows
on the way back out. See
[Precision (preludes)](plugin-anatomy.md#precision-preludes). The
signatures below assume the default `prelude`:

```rust
impl<'a> AudioBuffer<'a> {
    // Sizes
    fn num_samples(&self) -> usize;
    fn num_input_channels(&self) -> usize;
    fn num_output_channels(&self) -> usize;
    fn channels(&self) -> usize;             // min(in, out)

    // Channel access
    fn input(&self, ch: usize) -> &[f32];
    fn output(&mut self, ch: usize) -> &mut [f32];
    fn io(&mut self, ch: usize) -> (&[f32], &mut [f32]);
    fn io_pair(&mut self, in_ch: usize, out_ch: usize)
        -> (&[f32], &mut [f32]);

    // Per-frame view: transpose channel-major -> a fixed-size
    // (input, output) frame, for per-sample library callbacks
    // like fundsp's `tick`. See "Per-frame processing" below.
    fn for_each_frame<const N: usize>(
        &mut self, tick: impl FnMut(&[f32; N], &mut [f32; N]));
    fn for_each_frame_io<const IN: usize, const OUT: usize>(
        &mut self, tick: impl FnMut(&[f32; IN], &mut [f32; OUT]));
    fn for_each_stereo_frame(
        &mut self, tick: impl FnMut(&[f32; 2], &mut [f32; 2]));

    // Sub-block view (for sample-accurate event splitting)
    fn slice(&mut self, start: usize, len: usize) -> AudioBuffer<'_>;

    // In-place I/O (opt-in; see below)
    fn is_in_place(&self, ch: usize) -> bool;
    fn in_out_mut(&mut self, ch: usize) -> &mut [f32];

    // Diagnostics
    fn output_peak(&self, ch: usize) -> f32;
}
```

`input`, `output`, `io`, and `in_out_mut` all return slices of length
`num_samples()` — the current block, or the current sub-block if
you've called `slice()`.

## Per-sample effect

The most common shape — one multiplication per sample per channel:

```rust
fn process(_state: &mut Self::DspState, params: &Self::Params,
           buffer: &mut AudioBuffer, _: &EventList,
           _: &mut ProcessContext) -> ProcessStatus {
    for i in 0..buffer.num_samples() {
        let gain = db_to_linear(params.gain.read());
        for ch in 0..buffer.channels() {
            let (inp, out) = buffer.io(ch);
            out[i] = inp[i] * gain;
        }
    }
    ProcessStatus::Normal
}
```

Pull smoothed param values **per sample** when they need to glide
cleanly (gain, filter cutoff). Pull **per block** for param reads
that are expensive or that don't care about sample-accuracy
(mode switches, enums).

## Per-channel loop with input/output pairs

If you need separate read and write pointers (convolution, IIR
filters) rather than in-place modification:

```rust
for ch in 0..buffer.num_output_channels() {
    let (input, output) = buffer.io_pair(ch, ch);
    for i in 0..buffer.num_samples() {
        output[i] = state.filters[ch].process(input[i]);
    }
}
ProcessStatus::Normal
```

## Per-frame processing

`AudioBuffer` is channel-major: each `input(ch)` / `output(ch)` is a
contiguous slice for one channel. But a lot of DSP is naturally
*frame*-major — one input frame in, one output frame out — and the
libraries you'd reach for expect exactly that shape:
`fundsp::AudioUnit::tick`, `dasp` nodes, a hand-written per-sample node.
Feeding those from a channel-major buffer means either copying each
frame into a scratch first (a heap allocation on the audio thread) or
fighting the borrow checker over two live `&mut` borrows of the buffer.

The `for_each_frame` family does that transpose for you, in place,
against a stack-allocated `[f32; N]` frame pair — no heap, no borrow
gymnastics at the call site. `&[f32; N]` deref-coerces to `&[f32]`, so
the frames pass straight to slice-taking APIs like fundsp's `tick`.

```rust
// Stereo plugin delegating per-frame DSP to fundsp:
buffer.for_each_frame::<2, _>(|frame_in, frame_out| {
    state.graph.tick(frame_in, frame_out);
});
```

`for_each_frame::<N>` requires `N == channels()` (debug-asserted). When
your DSP has a fixed frame shape that need *not* match the bus width,
reach for the `_io` form instead:

```rust
// A fixed 2-in / 2-out graph, run over ANY declared bus layout:
buffer.for_each_frame_io::<2, 2, _>(|frame_in, frame_out| {
    state.reverb.tick(frame_in, frame_out);
});
```

`for_each_frame_io::<IN, OUT>` fills input slot `k` from bus input
channel `k`, **repeating the last available channel** when the bus has
fewer than `IN` inputs — so a mono source fans into both inputs of a
stereo graph. Output slot `k` writes bus output channel `k` while
`k < num_output_channels()`; frame outputs past the bus width are
dropped, and a bus with no inputs (an instrument) feeds silence. That
one call covers `(2, 2)` stereo and `(1, 2)` mono-in/stereo-out alike,
with no per-width branch — the right tool when your plugin declares
[multiple bus layouts](plugin-anatomy.md#bus-layouts).

`for_each_stereo_frame` is the `(2, 2)` shorthand for the common case
(a `reverb_stereo`, a stereo filter block) — same behavior, no
turbofish:

```rust
buffer.for_each_stereo_frame(|frame_in, frame_out| {
    state.graph.tick(frame_in, frame_out);
});
```

Under `truce::prelude64` the frames are `[f64; N]`. This is the shape
the [fundsp chapter](fundsp.md) builds on; use `chunks_mut` (below)
instead when you want SIMD-width blocks rather than single frames.

## SIMD block operations

LLVM autovectorizes the simple per-sample shapes and the cost is
invisible. The `truce_simd` crate exists for the rest: many
channels, many smoothed knobs, transcendentals in the inner loop.
Its per-block primitives compile down to packed SIMD (NEON on
aarch64; SSE / AVX / AVX-512 on x86_64) and unlock a 4x–16x
throughput win on the shapes that need it. Reach for it when
you've measured a hot spot, or when you know up-front the workload
will hit one of those triggers.

### The ops catalog

```rust
use truce_simd::{ops, math};
```

`truce_simd::ops` — the building blocks, all `f32`:

```rust
ops::scale_block(out: &mut [f32], src: &[f32], scale: f32);
ops::gain_block(buf: &mut [f32], gain: f32);
ops::mul_block(out: &mut [f32], a: &[f32], b: &[f32]);
ops::mac_block(out: &mut [f32], src: &[f32], scale: f32);  // out += src * scale
ops::mix_block(out: &mut [f32], a: &[f32], gain_a: f32,
                                b: &[f32], gain_b: f32);    // dry/wet workhorse
ops::copy_block(out: &mut [f32], src: &[f32]);
ops::zero_block(buf: &mut [f32]);
ops::abs_max_block(buf: &[f32]) -> f32;                    // peak detector
```

Each has a `*_scalar` twin (`scale_block_scalar`, …) that does the
same work without SIMD — useful as a reference for tests. The
`f64` versions live under `truce_simd::ops64` with identical names.

`truce_simd::math` — vectorized transcendentals, also `f32`:

```rust
math::tanh_block(out: &mut [f32], src: &[f32]);
math::db_to_linear_block(out: &mut [f32], src: &[f32]);
math::linear_to_db_block(out: &mut [f32], src: &[f32]);
math::exp2_block(out: &mut [f32], src: &[f32]);
math::log2_block(out: &mut [f32], src: &[f32]);
```

These matter because `libm`'s scalar transcendentals are opaque to
LLVM's autovectorizer — even with `-C target-cpu=native`, a loop
calling `f32::powf` stays scalar. The block forms route through
`wide`'s vectorized intrinsics, so a dB → linear conversion in
front of an envelope (the most common transcendental in a DSP
plugin) runs in 8-lane f32 chunks.

`prelude64` plugins get the same surface under `truce_simd::math64`
— identical op names, `&mut [f64]` slices, `wide::f64x4` lanes
(chunk granularity 4 instead of 8). Same vectorization win, half
the lanes, ~10× tighter error budget.

### Reading smoothed params per block

Each `FloatParam` provides a `read_into(&mut [f32])` method via the
`FloatParamReadF32` trait, which is in scope through the default
prelude. One atomic load + one atomic store per call, regardless
of slice length, and the smoother advances by exactly `out.len()`
— so chunking the host's buffer into a dynamic-stride ladder stays
correct even when the block size isn't a multiple of your stride:

```rust
// `state.gain_db` is a Vec<f32> scratch, sized to the host's max
// block in `reset`; here we walk it in strides of `STRIDE`.
while offset < total {
    let n = (total - offset).min(STRIDE);
    params.gain.read_into(&mut state.gain_db[..n]);
    // ... consume state.gain_db[..n] for n samples ...
    offset += n;
}
```

Precision follows the prelude: `prelude64` plugins import
`FloatParamReadF64` instead and the same call takes `&mut [f64]`.
See [parameters](parameters.md) for the full smoother surface.

### Walking the buffer in chunks

`AudioBuffer::chunks_mut::<N>()` iterates `(channel, sample_offset,
input, output)` tuples sized to fit one SIMD register's worth. The
final chunk per channel can be shorter than `N` (yielded as
`ChunkItem::Tail`); the full chunks come back as `ChunkItem::Full`
with `&[f32; N]` / `&mut [f32; N]`:

```rust
use truce_core::buffer::ChunkItem;

let mut chunks = buffer.chunks_mut::<32>();
while let Some(chunk) = chunks.next() {
    let (ch, sample, inp, out): (usize, usize, &[f32], &mut [f32]) = match chunk {
        ChunkItem::Full { ch, sample, inp, out } => (ch, sample, &inp[..], &mut out[..]),
        ChunkItem::Tail { ch, sample, inp, out } => (ch, sample, inp, out),
    };
    let env = if ch == 0 { &g_l } else { &g_r };
    ops::mul_block(out, inp, &env[sample..sample + inp.len()]);
}
```

Pick `N` to match the SIMD width of your target floor — 32 is a
good default for f32 on AVX2 (one register is 8 lanes, so 4
registers per chunk gives the optimizer scheduling room).

### Fast path / slow path

The canonical shape uses a **fast path** when the smoothers have
converged (gain is constant for the whole block) and a **slow
path** that vectorizes the envelope when they're still moving.
[`examples/truce-example-block-gain`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-gain)
puts both together:

```rust
fn process(
    state: &mut Self::DspState,
    params: &Self::Params,
    buffer: &mut AudioBuffer,
    _events: &EventList,
    _context: &mut ProcessContext,
) -> ProcessStatus {
    if !params.gain.is_smoothing() && !params.pan.is_smoothing() {
        // Fast path: one scalar gain for the whole block.
        let lin = db_to_linear(params.gain.value());
        let pan = params.pan.value();
        let gl = lin * (1.0 - pan.max(0.0));
        let gr = lin * (1.0 + pan.min(0.0));

        for ch in 0..buffer.channels() {
            let g = if ch == 0 { gl } else { gr };
            let (inp, out) = buffer.io(ch);
            ops::scale_block(out, inp, g);
        }
    } else {
        // Slow path: precompute a per-sample envelope, apply via
        // chunks_mut + mul_block. The scratch lives on `state`, sized
        // to the host's max block in `reset` (below).
        let n = buffer.num_samples();
        params.gain.read_into(&mut state.gain_db[..n]);
        params.pan.read_into(&mut state.pan[..n]);

        // Vectorized dB -> linear in one pass.
        math::db_to_linear_block(&mut state.lin[..n], &state.gain_db[..n]);

        // Pan split autovectorizes under -O; no explicit SIMD needed.
        for i in 0..n {
            state.g_l[i] = state.lin[i] * (1.0 - state.pan[i].max(0.0));
            state.g_r[i] = state.lin[i] * (1.0 + state.pan[i].min(0.0));
        }

        let mut chunks = buffer.chunks_mut::<32>();
        while let Some(chunk) = chunks.next() {
            let (ch, sample, inp, out) = match chunk {
                ChunkItem::Full { ch, sample, inp, out } => (ch, sample, &inp[..], &mut out[..]),
                ChunkItem::Tail { ch, sample, inp, out } => (ch, sample, inp, out),
            };
            let env = if ch == 0 { &state.g_l } else { &state.g_r };
            ops::mul_block(out, inp, &env[sample..sample + inp.len()]);
        }
    }

    ProcessStatus::Normal
}
```

The envelope scratch (`gain_db`, `pan`, `lin`, `g_l`, `g_r`) are
`Vec<f32>` fields on the plugin's `DspState`, sized once in `reset` to
the host's maximum block - never a fixed constant, which would truncate
the tail or panic the moment a host runs a block bigger than it:

```rust
fn reset(state: &mut Self::DspState, _params: &Self::Params, config: &AudioConfig) {
    for buf in [&mut state.gain_db, &mut state.pan, &mut state.lin,
                &mut state.g_l, &mut state.g_r] {
        buf.clear();
        buf.resize(config.max_block_size, 0.0);
    }
}
```

Users hit the fast path 99% of the time. The slow path only fires
while a smoother is mid-transition.

### Composing through scratch buffers

When the chain has more than one stage, hold the intermediate scratch
on your `DspState` and thread the data through each `ops::` / `math::`
call in sequence. [`examples/truce-example-block-saturate`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-saturate)
shows the pattern for `drive → tanh → output`:

```rust
// `sx` and `sy` are Vec<f32> on the DspState, sized in `reset`
// to config.max_block_size (see the reset above).
for ch in 0..buffer.channels() {
    let (inp, out) = buffer.io(ch);
    let n = inp.len();
    let sx = &mut state.sx[..n];
    let sy = &mut state.sy[..n];
    ops::scale_block(sx, inp, drive_lin);    // sx = inp * drive
    math::tanh_block(sy, sx);                // sy = tanh(sx)
    ops::scale_block(out, sy, output_lin);   // out = sy * output
}
```

Each line maps one-to-one to a math operation. Size the scratch to the
host's maximum block in `reset` and process the whole block: a
fixed-length array (`[f32; 1024]`) silently drops the tail, or panics,
the first time a host hands you a larger block - `config.max_block_size`
is the real ceiling, not a guess. See [best practices](best-practices.md).

### Compile-time SIMD baseline

`truce_simd`'s wide intrinsics dispatch at compile time via
`cfg(target_feature)`, so the binary picks one SIMD path at build
and locks it in. `cargo truce build` defaults x86_64 builds to
`-C target-cpu=x86-64-v3` (AVX2 + FMA + BMI2) so the `f32x8` path
activates automatically. aarch64 builds use NEON unconditionally.
Override with `--target-cpu` — see
[CLI reference](../reference/cli.md) for the full flag.

### More examples

Each shows a different `ops::` / `math::` shape:

- [`drywet`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-drywet)
  — `mix_block` as a dry/wet cross-fader in front of `tanh_block`.
- [`gate`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-gate)
  — `abs_max_block` for peak detection + `zero_block` for the
  silent-output path.
- [`widen`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-widen)
  — `mac_block` for mid-side recombination.
- [`surround-meter`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-surround-meter)
  — `linear_to_db_block` over a multi-channel peak array.

## MIDI and parameter events

`events` is a sorted list of `Event { sample_offset, port, body }` (`port` is `0` unless the plugin declares multiple MIDI ports).
Pattern match the body:

```rust
for event in events.iter() {
    match &event.body {
        EventBody::NoteOn  { note, velocity, .. } => state.note_on(*note, *velocity),
        EventBody::NoteOff { note, .. }           => state.note_off(*note),
        EventBody::ControlChange { cc: 1, value, .. } => {
            state.mod_depth = *value;
        }
        _ => {}
    }
}
```

`EventBody` also carries MIDI 2.0 variants (`NoteOn2`, `PerNoteCC`,
`PerNotePitchBend`, …) and CLAP parameter modulation (`ParamMod`
with a per-voice `note_id`). The `_ => {}` arm means the compiler
can still warn if you forgot a variant that mattered.

For MIDI input *and* output (arpeggiators, transposers, chord
generators), see **[midi](midi.md)**.

## Sample-accurate event splitting

**Parameter automation is sample-accurate by default.** This is the
second of two cooperating layers: the per-sample smoother read
([reading smoothed params per block](#reading-smoothed-params-per-block),
above) produces the click-free ramp, and **rechunking** — described
here — makes that ramp begin at the right sample. The framework
chunks `process()` at each `EventBody::ParamChange` so the smoother's
`set_target` runs at the event's `sample_offset` rather than at the
start of the block. Plugins reading `param.read()` (or `read_into`)
per sample then see the new target starting from the event sample —
no manual loop required. Tune the granularity via `[automation]
min_subblock_samples` in `truce.toml` (default 32) or opt a parameter
out with `#[param(chunk = false)]`. See
[parameters § Sample-accurate automation](parameters.md#sample-accurate-automation)
for both layers and the configuration surface.

For **non-parameter events** (MIDI note-on/off, transport ticks,
sysex), the chunker doesn't split on them — they arrive in the
`EventList` with the sub-block's relative `sample_offset` and the
plugin is responsible for applying them at the right sample. The
canonical shape interleaves the event loop with the sample loop:

```rust
fn process(state: &mut Self::DspState, _params: &Self::Params,
           buffer: &mut AudioBuffer, events: &EventList,
           _: &mut ProcessContext) -> ProcessStatus {
    let mut next = 0;

    for i in 0..buffer.num_samples() {
        while let Some(event) = events.get(next) {
            if event.sample_offset as usize > i { break; }
            state.handle_event(&event.body);
            next += 1;
        }
        for ch in 0..buffer.channels() {
            buffer.output(ch)[i] = state.render_sample(ch);
        }
    }
    ProcessStatus::Normal
}
```

For block-rate event handling (effects where MIDI events don't
need sample accuracy), process the event list once at the top and
then the whole block — simpler and cheaper.

## Host transport

`context.transport` surfaces tempo, play state, beat position, loop
bounds. Use it for tempo-synced LFOs, bar-locked envelopes, looping
delays.

```rust
let t = &context.transport;
if t.playing {
    let beat   = t.position_beats;
    let tempo  = t.tempo;
    let bar    = t.time_sig_num as f64;
    let phase  = (beat * self.sync_rate) % 1.0;
    let in_bar = beat % bar;
    // ...
}
```

Not every host fills every field every block. The
[`examples/truce-example-tremolo`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-tremolo) example shows the pattern:
fall back to a free-running internal clock at 120 BPM when the
host doesn't provide transport.

## Meters (DSP → UI)

Meters push from `process()` via `context.set_meter`, indexed by
typed `ParamId`. The GUI reads the latest value every frame.

```rust
context.set_meter(P::MeterL, buffer.output_peak(0));
context.set_meter(P::MeterR, buffer.output_peak(1));
```

Realtime-safe (atomic). Declaration of the `MeterSlot` fields is
in [chapter 4 → parameters.md § Meters](parameters.md#meters).

## Declaring tail time

Effects with memory — reverbs, delays, self-oscillating filters —
keep producing audio after the input stops. Tell the host how many
samples are left so it doesn't cut you off:

```rust
if state.is_producing_silence() {
    ProcessStatus::Tail(state.remaining_tail_samples())
} else {
    ProcessStatus::Normal
}
```

Return `ProcessStatus::Tail(0)` from a synth when every voice has
released — the host can then elide further `process` calls until
the next note-on.

## Building a synth

A polyphonic synth is a combination of the patterns above:

- **Sample-accurate event loop** so note-ons land at the right
  sample.
- **Per-sample param reads** for filter cutoff / resonance (they
  sound bad when block-rate'd).
- **`ProcessStatus::Tail(0)`** when all voices are done so the host
  can idle.

The full [`examples/truce-example-synth`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-synth) plugin (in the repo) is
roughly this shape:

```rust
pub struct Synth;

pub struct SynthDsp {
    sample_rate: f64,
    voices: Vec<Voice>,
}

impl PluginLogic for Synth {
    type Params = MyParams;
    type DspState = SynthDsp;

    fn init(_params: &MyParams) -> SynthDsp {
        SynthDsp { sample_rate: 0.0, voices: Vec::new() }
    }

    fn bus_layouts() -> Vec<BusLayout> {
        // Instrument: output only, no audio input.
        vec![BusLayout::new().with_output("Main", ChannelConfig::Stereo)]
    }

    fn reset(state: &mut SynthDsp, _params: &MyParams, config: &AudioConfig) {
        state.sample_rate = config.sample_rate;
        state.voices.clear();
    }

    fn process(state: &mut SynthDsp, params: &MyParams,
               buffer: &mut AudioBuffer, events: &EventList,
               _: &mut ProcessContext) -> ProcessStatus {
        let mut next = 0;

        for i in 0..buffer.num_samples() {
            // 1. Dispatch any events landing at this sample.
            while let Some(e) = events.get(next) {
                if e.sample_offset as usize > i { break; }
                match &e.body {
                    EventBody::NoteOn  { note, velocity, .. } => state.note_on(*note, *velocity),
                    EventBody::NoteOff { note, .. }           => state.note_off(*note),
                    _ => {}
                }
                next += 1;
            }

            // 2. Read per-sample smoothed params. This synth uses
            //    `use truce::prelude64::*`, so `.read()` returns
            //    `f64` and the audio buffer slices are `&[f64]`.
            let wave    = params.waveform.index();
            let cutoff  = params.cutoff.read();
            let reso    = params.resonance.read();
            let volume  = db_to_linear(params.volume.read());

            // 3. Sum the voices and write.
            let sample_rate = state.sample_rate;
            let mut sample = 0.0;
            for voice in &mut state.voices {
                sample += voice.render(wave, cutoff, reso, sample_rate);
            }
            sample *= volume;
            let out = sample.clamp(-1.0, 1.0);
            buffer.output(0)[i] = out;
            buffer.output(1)[i] = out;
        }

        // 4. Retire finished voices; signal idle when empty.
        state.voices.retain(|v| !v.is_done());
        if state.voices.is_empty() { ProcessStatus::Tail(0) } else { ProcessStatus::Normal }
    }

    fn editor(params: Arc<MyParams>) -> Box<dyn Editor> { /* ... */ }
}
```

Voice allocation, ADSR, and filter state live in the `Voice` struct
— plain Rust, no framework involvement. Parameters flow in through
`&Params` each call; nothing else is shared across threads.

### Offline rendering

`reset` receives an `AudioConfig` whose `process_mode` tells you how the
host is driving audio: `Realtime`, `Buffered`, or `Offline`. During an
offline bounce there is no wall-clock deadline, so you can allocate
bigger oversampling / lookahead buffers and trade CPU for quality. Size
those buffers in `reset` (off the audio thread); the same mode is also on
each block's `ProcessContext` as `process_mode`, so a plugin that only
wants to relax realtime discipline (not reallocate) can read it per
block. The signal is delivered on CLAP, VST3, VST2, and LV2; other
formats always report `Realtime`.

```rust
fn reset(state: &mut Self::DspState, _params: &Self::Params, config: &AudioConfig) {
    let oversample = if config.process_mode.is_offline() { 8 } else { 2 };
    state.resampler.resize(config.max_block_size * oversample);
}
```

The macro is the same for every plugin shape:

```rust
truce::plugin! {
    logic: Synth,
    params: MyParams,
}
```

## In-place I/O (opt-in)

Some hosts (Reaper, pluginval) pass the same buffer for both input
and output of a given channel. By default truce handles this for you
— the wrapper detects the alias and copies the input into per-channel
scratch so `buffer.input(ch)` and `buffer.output(ch)` are always
disjoint slices. The cost is one memcpy per aliased channel per block
(a few hundred KB/sec at audio rates) and it never shows up unless
you go looking. **Most plugins should ignore this section.**

If you profile and the wrapper memcpy is meaningful for your DSP,
override `supports_in_place()` on your `PluginLogic` impl to
return `true`. The wrapper then skips the copy and you
read+write the shared buffer directly:

```rust
impl PluginLogic for MyEffect {
    type Params = MyEffectParams;
    type DspState = MyEffectDsp;
    fn supports_in_place() -> bool { true }
    // ...
    fn process(state: &mut MyEffectDsp, _params: &MyEffectParams,
               buffer: &mut AudioBuffer, _: &EventList,
               _: &mut ProcessContext) -> ProcessStatus {
        for ch in 0..buffer.num_output_channels() {
            if buffer.is_in_place(ch) {
                // Host shares one buffer for in+out; read each
                // sample, then overwrite it.
                let inout = buffer.in_out_mut(ch);
                for s in inout.iter_mut() { *s = state.process_sample(*s); }
            } else {
                let inp = buffer.input(ch);
                let out = buffer.output(ch);
                for i in 0..inp.len() { out[i] = state.process_sample(inp[i]); }
            }
        }
        ProcessStatus::Normal
    }
}
```

The contract:

- With `supports_in_place() = true`, `buffer.input(ch)` returns an empty
  slice for in-place channels — the data only exists in the shared
  buffer. You **must** check `buffer.is_in_place(ch)` and use
  `buffer.in_out_mut(ch)` for those channels.
- With `supports_in_place() = false` (default), `buffer.input(ch)` and
  `buffer.output(ch)` are always safe and disjoint, even when the
  host requested in-place. `is_in_place` still reflects the host's
  choice — but you can ignore it.

## What's next

- **[Chapter 6 → fundsp](fundsp.md)** — drop a fundsp graph
  into `process()` and rebuild it off the audio thread when
  a "structural" param changes.
- **[Chapter 7 → workers](workers.md)** - anything too heavy
  for a block (an FFT, a graph rebuild, a file decode) goes
  off the audio thread: managed background tasks, or an
  `AudioTap` + dedicated worker for streaming analysis.
- **[Chapter 8 → midi](midi.md)** — emitting MIDI, wire-format
  helpers, MIDI 2.0 surface.
- **[Chapter 9 → gui](gui.md)** — widgets, layout, meters in
  the UI.
- **[Chapter 10 → audio-testing](audio-testing.md)** — lock
  this code in with in-process regression tests before it ships.
- **[Chapter 15 → hot-reload](hot-reload.md)** — keep your DAW
  open while you iterate on this code.
- **[`examples/truce-example-tremolo`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-tremolo)** in the repo — host transport
  + egui UI in a small, real plugin.
