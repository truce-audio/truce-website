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
pub struct FundspReverbSimple {
    params: Arc<FundspReverbSimpleParams>,
    low_cut_shared: Shared,
    high_cut_shared: Shared,
    mix_shared:     Shared,
    graph: Box<dyn AudioUnit>,
    // ...
}
```

In `process()` you push the latest smoothed param value into
each `Shared` every frame, just before `graph.tick`:

```rust
buffer.for_each_frame::<2, _>(|frame_in, frame_out| {
    self.low_cut_shared.set_value(self.params.low_cut.read());
    self.high_cut_shared.set_value(self.params.high_cut.read());
    self.mix_shared.set_value(self.params.mix.read());
    self.graph.tick(frame_in, frame_out);
});
```

`for_each_frame::<2, _>` transposes channel-major into stereo
frames so fundsp's `tick(in, out)` slots in. The `Shared`
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

let time_s = self.params.time.value();
if (time_s - self.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
    // ... rebuild
}
```

Read `value()` (the raw target), not `read()` (the smoothed
sample-by-sample reading), or you get the unstable-tail problem
again even with the threshold.

## Variant 1: inline rebuild (the simple crate)

The simple variant just calls `rebuild_graph` directly inside
`process()` when the threshold trips:

```rust
fn process(&mut self, buffer: &mut AudioBuffer, /* … */) -> ProcessStatus {
    let time_s = self.params.time.value();
    if (time_s - self.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
        self.rebuild_graph(self.last_built_sr, time_s);
        self.last_built_time_s = time_s;
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

## Variant 2: worker thread + lock-free swap (the worker crate)

The worker variant moves the rebuild off the audio thread:

```text
   audio thread                            worker thread
   ────────────                           ─────────────
   detect Time threshold trip
       │
       │ requests.force_push(req)
       ▼                                  thread::park()
   self.worker_thread.unpark();    ───►   wake
                                          drain `requests`,
                                          keep the latest
                                          build_graph(...)
                                          ready.force_push(graph)
   ready.pop() in next process    ◄───
   std::mem::replace(&mut graph, …)
   discard.push(old_graph)         ───►   drop runs here
```

Three lock-free queues, all `force_push` / `try_push` so neither
thread blocks:

```rust
struct RebuildChannel {
    requests: ArrayQueue<RebuildRequest>,    // capacity 1
    ready:    ArrayQueue<ReadyGraph>,        // capacity 1
    discard:  ArrayQueue<Box<dyn AudioUnit>>,// capacity 8
    shutdown: AtomicBool,
}
```

Capacities and the reasons they're those values:

- **`requests` capacity 1.** Only the *latest* target matters;
  older requests are stale by definition. `force_push` drops
  the displaced `RebuildRequest`. Since `RebuildRequest` is
  `Copy` (just an `f64` SR and an `f32` time), nothing
  allocates on drop.
- **`ready` capacity 1.** At most one freshly-built graph
  waits. If the worker built one and another change comes in
  before the audio thread picks it up, `force_push` displaces
  the stale graph and drops it on the worker — never on the
  audio thread.
- **`discard` capacity 8.** Big enough that a slow worker can't
  stall the audio thread by filling the queue. On overflow we
  keep the old graph live for a block instead of freeing it on
  the audio thread.

### Waking the worker

`thread::park` is the standard "block until somebody
`unpark`s me" primitive. It's free when idle and wakes in
microseconds. The audio thread calls `unpark` after every
`requests.force_push`; the worker loops park → wake → drain
→ park.

```rust
self.rebuild.requests.force_push(RebuildRequest { sample_rate, time_s });
self.worker_thread.unpark();
```

The `force_push` happens *before* the unpark so the wake-up
always sees a request to handle.

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
if let Some(ready) = self.rebuild.ready.pop() {
    if ready.sample_rate.to_bits() == self.last_built_sr.to_bits() {
        let old = std::mem::replace(&mut self.graph, ready.graph);
        let _ = self.rebuild.discard.push(old);
        self.last_built_time_s = ready.time_s;
    } else {
        // Stale SR — route to discard so the worker frees it.
        let _ = self.rebuild.discard.push(ready.graph);
    }
}
```

`reset()` additionally drains the queues so an old in-flight
build can't slip into `process()` after the SR has changed:

```rust
fn rebuild_now(&mut self, sample_rate: f64, time_s: f32) {
    self.graph = build_graph(sample_rate, time_s, &self.low_cut_shared,
                             &self.high_cut_shared, &self.mix_shared);
    self.last_built_sr = sample_rate;
    self.last_built_time_s = time_s;
    while self.rebuild.requests.pop().is_some() {}
    while self.rebuild.ready.pop().is_some() {}
}
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
if (time_s - self.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
    self.last_built_time_s = time_s;     // optimistic
    self.rebuild.requests.force_push(RebuildRequest {
        sample_rate: self.last_built_sr,
        time_s,
    });
    self.worker_thread.unpark();
}
```

Without that, the diff trips every block while the worker is
building — the queue is capacity 1 so `force_push` would just
overwrite the same target repeatedly. The optimistic update
makes "I've already asked for this target" implicit.

If the user then moves Time *further* past the threshold while
the worker is still building, the diff trips again and a new
request lands. Worst case, the worker discards one graph and
builds the latest one. Acceptable.

### Drop joins the worker

```rust
impl Drop for FundspReverbWorker {
    fn drop(&mut self) {
        self.rebuild.shutdown.store(true, Ordering::Release);
        self.worker_thread.unpark();
        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }
    }
}
```

The worker loop checks `shutdown` after each iteration:

```rust
if channel.shutdown.load(Ordering::Acquire) {
    return;
}
thread::park();
```

`Release` on the store pairs with `Acquire` on the load. The
unpark is what wakes the worker so it *sees* the shutdown
flag; without it, the worker could park forever after the
plugin is destroyed.

## Which one should you ship?

Always the worker variant for real-time DSP that needs a
rebuild. The extra ~40 lines of thread machinery are
boilerplate-able and don't change once they're written —
clone the worker crate's `RebuildChannel`, `spawn_rebuild_worker`,
`rebuild_now`, and `Drop` impl as-is for any plugin that has a
"rebuild" knob.

The simple variant is fine for non-shipping contexts where the
audio dropouts don't matter — quick experiments, offline
rendering, classroom demos. Treat it as a transitional step:
get the topology right inline, then port to the worker shape
once you're happy with the signal flow.

## What's next

- **[Chapter 7 → midi](midi.md)** — fundsp covers DSP graphs;
  truce gives you sample-accurate MIDI on top.
- **[Chapter 8 → gui](gui.md)** — wire the reverb's params
  into widgets and meters.
- **[Chapter 9 → audio-testing](audio-testing.md)** — both
  reverb crates ship regression tests for stability at 96 kHz,
  filter input-order traps, and Time automation. They make
  good templates.
- **[`examples/truce-example-fundsp-reverb-simple`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple)** and **[`examples/truce-example-fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker)** in the repo — the
  files this chapter walked through.
