# 6. Integrating fundsp

[`fundsp`](https://github.com/SamiPerttu/fundsp) is a Rust audio
DSP library whose operator-overloaded combinators (`>>`, `|`, `&`,
`*`, `+`) read like a small DSP DSL. truce gives you the host
plumbing — formats, params, GUI, state — and leaves
`process()` to you. The two compose cleanly because fundsp is
agnostic about *where* its `AudioUnit::tick` runs, and truce is
agnostic about *what* you do inside `process`.

This chapter walks through both fundsp reverb examples in the
repo. They share the same signal flow, params, and UI. They
differ only in *how the fundsp graph gets rebuilt when the user
moves the Time knob*:

- [`examples/truce-example-fundsp-reverb-simple`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple)
  — rebuilds the graph **inline on the audio thread**. Easy
  to read end-to-end; not safe to ship.
- [`examples/truce-example-fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker)
  — rebuilds on a **dedicated worker thread** and swaps the
  finished graph in via lock-free queues. `process()` stays
  allocation-free.

## The shared topology

Both crates wire the same stereo plate reverb: a dry path bussed
against a wet path of (high-pass → low-pass → `reverb_stereo`),
crossfaded by a mix knob.

```text
    in (L,R) ──► high-pass (low cut) ──► low-pass (high cut) ──► reverb_stereo ──┐
                                                                                 │
    in (L,R) ──────────────────────────────────────────────────────────────► dry ┤──► out
```

In fundsp combinator form:

```rust
let hp_l = (pass() | var(low_cut) | dc(FILTER_Q)) >> highpass::<f32>();
let hp_r = (pass() | var(low_cut) | dc(FILTER_Q)) >> highpass::<f32>();
let lp_l = (pass() | var(high_cut) | dc(FILTER_Q)) >> lowpass::<f32>();
let lp_r = (pass() | var(high_cut) | dc(FILTER_Q)) >> lowpass::<f32>();

let filters_stereo = (hp_l | hp_r) >> (lp_l | lp_r);
let wet = filters_stereo >> reverb_stereo(ROOM_SIZE, time_s, DAMPING);
let dry = multipass::<U2>();

let mix_stereo     = || var(mix) | var(mix);
let inv_mix_stereo = || (dc(1.0) - var(mix)) | (dc(1.0) - var(mix));

// `&` is Bus: dry + wet share the input and sum their outputs.
let mut graph: Box<dyn AudioUnit> =
    Box::new((dry * inv_mix_stereo()) & (wet * mix_stereo()));
graph.set_sample_rate(sample_rate);
graph.allocate();
```

A few fundsp-specific things worth flagging up front:

- **SVF inputs are positional, every input is `f32`.** Stacking
  `(cutoff | Q | signal)` instead of `(signal | cutoff | Q)`
  compiles fine and feeds the filter cutoff as audio. The
  reverb FDN downstream then amplifies it well past peak inside
  a second. There's an `extended_steady_state_stays_bounded`
  regression test in both crates pinned to exactly this trap.
- **`var()` is mono.** To feed a stereo node, stack two reads
  of the same `Shared` so the channel counts line up.
- **`&` is Bus.** `dry * inv_mix & wet * mix` is "share input,
  sum outputs" — i.e. the classic dry/wet crossfade.

## Sharing parameters with the graph

The fundsp graph is built once and then ticks forever. Params
move continuously. The bridge is a `Shared` cell per knob the
graph reads via `var()`:

```rust
// Stateless descriptor.
pub struct FundspReverbSimple;

// Per-instance DSP state.
pub struct FundspReverbSimpleDsp {
    low_cut_shared: Shared,
    high_cut_shared: Shared,
    mix_shared:     Shared,
    graph: Box<dyn AudioUnit>,
    // ...
}
```

In `process()` you push the latest smoothed param value into
each `Shared` every frame, just before `graph.tick` (params arrive as
a `&Self::Params` argument, DSP state as `&mut Self::DspState`):

```rust
buffer.for_each_stereo_frame(|frame_in, frame_out| {
    state.low_cut_shared.set_value(params.low_cut.read());
    state.high_cut_shared.set_value(params.high_cut.read());
    state.mix_shared.set_value(params.mix.read());
    state.graph.tick(frame_in, frame_out);
});
```

`for_each_stereo_frame` transposes channel-major into 2-in/2-out
frames so fundsp's `tick(in, out)` slots in. It's the `(2, 2)`
shorthand for `for_each_frame_io::<IN, OUT>`, so the same call runs
over any declared bus - a mono source fans into both graph inputs, a
stereo bus maps 1:1 - with no per-width branch. The `Shared`
writes are atomic stores, which the audio thread is fine with.

## When do you have to rebuild?

Most fundsp parameters can be plumbed through `Shared` and live
without rebuilding the graph. A few cannot:

- **Sample rate.** `set_sample_rate` recomputes filter
  coefficients top-down through the graph. `reset()` is called
  off the audio thread, so this rebuild is free; you just need
  to remember to call it.
- **Reverb Time (RT60).** `reverb_stereo(room_size, time_s,
  damping)` bakes RT60 into the FDN's feedback gains at
  *construction*. There's no setter — changing Time means a
  fresh `reverb_stereo(...)`, which means a fresh `Box::new` and
  `graph.allocate()`. That's a heap call. That's the problem.

Anything you want to "live-tweak" continuously needs a
`Shared` (cutoffs, mix). Anything that's baked into the graph
topology needs a rebuild on change (Time, structural choices).

### Hysteresis on Time

The Time param is declared `smooth = "none"`. Two reasons:

1. The graph rebuild is discrete — there's no smoother on the
   reading side because nothing reads continuously.
2. A smoothed value would crawl across whatever rebuild
   threshold we pick over ~200 ms and trigger a rebuild every
   block until it settles — audible as an unstable tail.

Both crates also impose a 0.05 s threshold so tiny drifts
(automation noise, knob jitter) don't fire:

```rust
const TIME_REBUILD_THRESHOLD_S: f32 = 0.05;

let time_s = params.time.value();
if (time_s - state.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
    // ... rebuild
}
```

## Variant 1: inline rebuild (the simple crate)

The simple variant just calls `rebuild_graph` directly inside
`process()` when the threshold trips:

```rust
fn process(state: &mut Self::DspState, params: &Self::Params,
           buffer: &mut AudioBuffer, /* … */) -> ProcessStatus {
    let time_s = params.time.value();
    if (time_s - state.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
        state.rebuild_graph(state.last_built_sr, time_s);
        state.last_built_time_s = time_s;
    }
    // … same per-frame loop as above
}
```

`rebuild_graph` does `Box::new(...)` and `graph.allocate()`,
both of which can block on the system allocator. That's a
real-time-safety violation. On a CoreAudio buffer of 128
frames at 48 kHz you have 2.67 ms; if `malloc` takes a hard
page-fault or contends on a lock, you get an audio dropout —
maybe a click, maybe silence for a buffer, depending on the
host.

The simple variant exists because the integration shape is
visible in one file, with no thread-handoff machinery to follow.
It is **not** safe to ship and the crate's docstring says so.

## Variant 2: background rebuild + lock-free swap (the worker crate)

The worker variant moves the rebuild off the audio thread. It schedules
the rebuild as a truce [background task](workers.md) - the managed pool
owns the thread, the wakeup, and the teardown - and hands the finished
graph back through a lock-free swap:

```text
   audio thread (process)                  pool worker (run)
   ──────────────────────                  ──────────────────────
   detect Time threshold trip
       │ ctx.tasks::<RebuildRequest>()
       │     .spawn_coalescing(req)  ───►   build_graph(...)
       ▼                                    ready.force_push(graph)
   ready.pop() in next process      ◄───
   std::mem::replace(&mut graph, …)
   discard.push(old_graph)          ───►   drop runs here (next run)
```

The request *is* the task; two lock-free queues carry the graphs
themselves, both `force_push` so neither side blocks:

```rust
#[derive(Copy, Clone)]
struct RebuildRequest { sample_rate: f64, time_s: f32 }   // the task

struct WorkerShared {                        // an Arc<..> #[skip] field on the params
    ready:   ArrayQueue<ReadyGraph>,         // worker → audio, capacity 1
    discard: ArrayQueue<Box<dyn AudioUnit>>, // audio → worker, capacity 8
    // ... plus the fundsp `Shared` cells the graph reads ...
}
```

`WorkerShared` lives as a `#[skip]` field on the params struct, so both
`process()` (via `&params`) and `run` (via `&params`) reach it - the
same shared-`Arc` mechanism the editor uses. Capacities:

- **`ready` capacity 1.** At most one freshly-built graph waits. If the
  pool built one and another change comes in before the audio thread
  picks it up, `force_push` displaces the stale graph and drops it on the
  pool thread - never on the audio thread.
- **`discard` capacity 8.** Big enough that a slow pool can't stall the
  audio thread by filling the queue. On overflow we keep the old graph
  live for a block instead of freeing it on the audio thread.

There's no `requests` queue and no worker thread of your own:
`spawn_coalescing` is the single-slot "latest target wins" channel into
the pool, and the pool provides the thread.

### Scheduling the rebuild

`process()` posts the latest target to the pool with `spawn_coalescing`.
It's wait-free and keeps only the newest request, so a knob sweep
collapses to one rebuild per pool cycle, not one per block:

```rust
if let Some(tasks) = ctx.tasks::<RebuildRequest>() {
    tasks.spawn_coalescing(RebuildRequest { sample_rate: state.last_built_sr, time_s });
}
```

The pool runs `run` off the audio thread: it frees any graph the
audio thread handed back (the heavy drop lands here), builds the new one,
and force-pushes it to `ready`. `BackgroundTask` is implemented on the
task type itself - the request arrives as `self`:

```rust
impl BackgroundTask for RebuildRequest {
    type Params = FundspReverbWorkerParams;

    fn run(self, params: &FundspReverbWorkerParams) {
        let w = &params.worker;
        while let Some(old) = w.discard.pop() { drop(old); }   // heavy drop, off-thread
        let graph = build_graph(self.sample_rate, self.time_s,
                                &w.low_cut, &w.high_cut, &w.mix);
        let _ = w.ready.force_push(ReadyGraph {
            graph, sample_rate: self.sample_rate, time_s: self.time_s,
        });
    }
}
```

Wire it in with the `tasks:` key on the macro - a bracketed list of
task types:

```rust
truce::plugin! {
    logic:  FundspReverbWorker,
    params: FundspReverbWorkerParams,
    tasks:  [RebuildRequest],
}
```

### SR-tagging ready graphs

`reset()` runs off the audio thread (the host calls it on
sample-rate change, on transport start, on plugin
activation). If a worker rebuild is in flight when
`reset()` fires for a *new* SR, the in-flight graph is being
built against the *old* SR. The audio thread shouldn't accept
it.

Each `ReadyGraph` carries the SR it was built with:

```rust
struct ReadyGraph {
    graph: Box<dyn AudioUnit>,
    sample_rate: f64,
    time_s: f32,
}
```

When `process()` pops one, it checks SR:

```rust
if let Some(ready) = state.worker.ready.pop() {
    if ready.sample_rate.to_bits() == state.last_built_sr.to_bits() {
        let old = std::mem::replace(&mut state.graph, ready.graph);
        let _ = state.worker.discard.push(old);
        state.last_built_time_s = ready.time_s;
    } else {
        // Stale SR - route to discard so the pool frees it.
        let _ = state.worker.discard.push(ready.graph);
    }
}
```

`reset()` runs off the audio thread, so it rebuilds *synchronously* and
drains `ready` so an old in-flight build can't slip into `process()`
after the SR has changed:

```rust
// in reset(), on an SR or Time change:
state.graph = build_graph(sample_rate, time_s, &w.low_cut, &w.high_cut, &w.mix);
state.last_built_sr = sample_rate;
state.last_built_time_s = time_s;
while w.ready.pop().is_some() {}
```

Comparing `f64`s with `.to_bits() == .to_bits()`: SR is a
discrete host setting, not a measurement, so exact-bit equality
is what we want. An epsilon compare would risk false-positives
that quietly accept a stale graph.

### Optimistic `last_built_time_s` update

When `process()` requests a rebuild, it updates
`last_built_time_s` *immediately*, not after the worker hands
back the new graph:

```rust
if (time_s - state.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
    state.last_built_time_s = time_s;     // optimistic
    if let Some(tasks) = ctx.tasks::<RebuildRequest>() {
        tasks.spawn_coalescing(RebuildRequest {
            sample_rate: state.last_built_sr,
            time_s,
        });
    }
}
```

Without that, the diff trips every block while the pool is
building - `spawn_coalescing`'s single slot would just overwrite
the same target repeatedly. The optimistic update makes "I've
already asked for this target" implicit.

If the user then moves Time *further* past the threshold while
the pool is still building, the diff trips again and a new
request lands. Worst case, the pool discards one graph and
builds the latest one.

### No thread to own

Because the rebuild runs on the shared pool, there is no worker thread,
no `park` / `unpark`, no `shutdown` flag, and no `Drop` join to write -
the pool owns all of it. The plugin's `DspState` is just the live graph
and the inputs it was built with:

```rust
struct FundspReverbWorkerDspState {
    graph: Box<dyn AudioUnit>,
    last_built_sr: f64,
    last_built_time_s: f32,
}
```

The pool is process-global and shared across every truce plugin in the
host, so keep `run` short and non-blocking - a graph build is fine;
blocking on I/O is not (that would want a dedicated
[`StreamWorker`](workers.md) instead).

## Which one should you ship?

Always the worker variant for real-time DSP that needs a
rebuild. With the managed pool there's no thread machinery to
write — an `impl BackgroundTask`, one `spawn_coalescing` call,
and the `ready` / `discard` handoff, all of which clone cleanly
from the worker crate for any plugin with a "rebuild" knob.

The simple variant is fine for non-shipping contexts where the
audio dropouts don't matter — quick experiments, offline
rendering, classroom demos. Treat it as a transitional step:
get the topology right inline, then port to the worker shape
once you're happy with the signal flow.

## What's next

- **[Chapter 7 → workers](workers.md)** — the managed pool,
  `AudioTap`, and dedicated worker threads in full.
- **[Chapter 8 → midi](midi.md)** — fundsp covers DSP graphs;
  truce gives you sample-accurate MIDI on top.
- **[Chapter 9 → gui](gui.md)** — wire the reverb's params
  into widgets and meters.
- **[Chapter 10 → audio-testing](audio-testing.md)** — both
  reverb crates ship regression tests for stability at 96 kHz,
  filter input-order traps, and Time automation. They make
  good templates.
- **[`examples/truce-example-fundsp-reverb-simple`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple)** and **[`examples/truce-example-fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker)** in the repo — the
  files this chapter walked through.
