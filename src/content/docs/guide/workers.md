# 7. Workers

Some work has no place on the audio thread: allocating or freeing
memory, building a DSP graph, an FFT, resampling, reading a file -
anything that can block or run for an unbounded time. The fix is to move
it to a **worker**: a background thread that does the heavy work while
`process()` stays real-time.

truce gives you two managed pieces so you rarely wire threads up by hand:

- **Managed background tasks** - implement one function, and truce runs
  it off the audio thread on a shared pool. For discrete work: build a
  graph, decode a file, run one FFT.
- **`AudioTap` + `StreamWorker`** - a lock-free ring for streaming
  samples off the audio thread, and an optional dedicated thread to drain
  it. For continuous work: spectral analysis, a loudness meter, an
  oscilloscope.

You still own the *shape* of the handoff - what the task does, what it
reads and writes - because that differs per plugin. What you no longer
write is the thread, the shutdown flag, the join, and the wake-up plumbing.

> **Do you actually need one?** Only if the work is *both* too heavy for
> one block *and* can't be pre-computed in [`reset()`](processing.md).
> `reset()` runs off the audio thread, so a one-time buffer allocation or
> a filter rebuild triggered by a sample-rate change belongs there, done
> synchronously - no worker needed. Reach for a worker only for
> continuous heavy computation (spectral analysis) or a rebuild driven by
> *live* automation.

## The one rule

The audio thread's side of every handoff must be **wait-free**: no lock,
no allocation, no free, no syscall, no unbounded loop. In practice:

- scheduling a task (`try_spawn` / `spawn_coalescing`) and pushing to a
  tap (`push_frames`) are wait-free and drop-or-coalesce when full, never
  block;
- the worker does all the heavy work **and all the heavy drops** - a big
  `Box` or `Vec` is never dropped in `process()`.

A worker can allocate and free freely - that's the whole point of moving
the work there. **Blocking** is the one thing to place carefully: a
dedicated `StreamWorker` owns its thread and may block on I/O or a lock as
long as it likes, but a `BackgroundTasks` handler runs on a pool shared
with every other truce plugin in the host (see below), so it must stay
short and non-blocking.

## Reaching shared state through `Params`

Your logic type is a stateless descriptor and `run_task` is a plain
function - neither has a `self` to hang shared channels off. The handoff
lives on the **params** instead, as a `#[skip]` field (not a parameter,
just state the param store carries). Both sides reach it through
`&params`: `process` on the audio thread, `run_task` on the pool, and
`editor(params)` on the GUI thread.

```rust
#[derive(Params)]
pub struct MyParams {
    #[param(/* ... */)] pub time: FloatParam,

    // `#[skip]` = not a parameter. `Default`-initialized when the param
    // store is built, so it needs no `init` to exist.
    #[skip]
    pub worker: Arc<WorkerShared>,   // the channels / ring the worker uses
}
```

This is the same mechanism the GUI uses to reach a worker's results: the
plugin publishes a handle (a spectrum, a meter) into a `#[skip]` field,
and `editor(params)` reads it back.

## Managed background tasks

For discrete off-thread work, implement `BackgroundTasks` and name it in
`truce::plugin!`. You define a `Copy` **task** type (the request) and a
`run_task` that handles it; truce runs `run_task` on a shared, bounded
pool.

```rust
impl BackgroundTasks for MyPlugin {
    type Params = MyParams;
    type Task = RebuildRequest;        // a small Copy request

    // Runs on the pool, off the audio thread. Reaches shared state
    // through `&params` - the same `#[skip]` field `process` writes.
    fn run_task(task: RebuildRequest, params: &MyParams) {
        let graph = build_graph(task.sample_rate, task.time_s); // allocates
        let _ = params.worker.ready.force_push(graph);          // hand back
    }
}

truce::plugin! {
    logic:  MyPlugin,
    params: MyParams,
    tasks:  MyPlugin,          // wires run_task onto the pool
}
```

Schedule from `process` (or the editor) through the context:

```rust
if let Some(tasks) = context.tasks::<RebuildRequest>() {
    tasks.spawn_coalescing(RebuildRequest { sample_rate, time_s });
}
```

Two ways to schedule, both wait-free:

| Method | Behavior | Use when |
|--------|----------|----------|
| `try_spawn(task)` | FIFO; every task runs; returns `Err(task)` if the inbound queue is full | Each request is distinct and must run |
| `spawn_coalescing(task)` | Single slot; keeps only the newest target and runs it once per drain | Only the newest target matters (a knob sweep) |

The pool is process-wide and bounded (it never grows past
`available_parallelism`), started lazily on the first task, and shared by
every plugin instance. A panic in `run_task` is caught, so one bad handler
can't strand the pool. There is **no thread to own and no `Drop` to
write** - a plugin that never implements `BackgroundTasks` gets no pool at
all.

Because the pool is shared and small (as few as one thread on a dual-core
machine), keep handlers **short and non-blocking**. A handler that blocks
on disk I/O, a network call, or a lock stalls background work for *every
truce plugin in the host*, not just yours. Allocation and CPU-bound bursts
are fine. For work that genuinely blocks or runs long, give the plugin its
own thread with a [`StreamWorker`](#draining-on-a-dedicated-streamworker)
instead of the pool.

## Shape 1: offload construction

*Build a heavy object off-thread, hand it to the audio thread, free the
old one off-thread.* The
[`fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker)
example rebuilds its fundsp graph this way when the user moves the Time
knob (each change reconstructs the reverb's delay-line network, which
allocates).

The task is the coalesced request; two lock-free queues carry the objects
themselves (a built graph back, a swapped-out graph away to be freed):

```rust
#[derive(Copy, Clone)]
pub struct RebuildRequest { sample_rate: f64, time_s: f32 }

pub struct WorkerShared {
    ready:   ArrayQueue<ReadyGraph>,          // worker → audio: capacity 1
    discard: ArrayQueue<Box<dyn AudioUnit>>,  // audio → worker: free off-thread
    // ... the atomic cells the live graph reads each sample ...
}
```

**Request (audio → worker), coalesced.** `process` diffs the target
against the live graph and, on a real change, posts the newest request. A
knob sweep triggers one rebuild per pool cycle, not one per block:

```rust
if (time_s - state.last_built_time_s).abs() > TIME_REBUILD_THRESHOLD_S {
    state.last_built_time_s = time_s;   // optimistic: don't re-request every block
    if let Some(tasks) = context.tasks::<RebuildRequest>() {
        tasks.spawn_coalescing(RebuildRequest { sample_rate: state.last_built_sr, time_s });
    }
}
```

**Build off-thread.** `run_task` does the allocation, frees any graph the
audio thread swapped out (the heavy drop lands here), and hands the new
one back:

```rust
fn run_task(task: RebuildRequest, params: &MyParams) {
    let w = &params.worker;
    while let Some(old) = w.discard.pop() { drop(old); }   // heavy drop, off-thread
    let graph = build_graph(task.sample_rate, task.time_s); // allocates
    let _ = w.ready.force_push(ReadyGraph { graph, sample_rate: task.sample_rate });
}
```

**Swap in (worker → audio), with staleness rejection.** The audio thread
pops the finished graph and swaps it in - but only if it was built for
the current sample rate. A graph the worker was midway through when
`reset()` changed the rate is routed straight to `discard`:

```rust
if let Some(ready) = w.ready.pop() {
    if ready.sample_rate.to_bits() == state.last_built_sr.to_bits() {
        let old = std::mem::replace(&mut state.graph, ready.graph);
        let _ = w.discard.push(old);       // free off-thread; never drops here
    } else {
        let _ = w.discard.push(ready.graph); // stale: discard
    }
}
```

`discard` is padded (capacity 8 vs. at most one swap per block) so it
can't fill and force a free on the audio thread. `reset()` runs off the
audio thread, so it rebuilds *synchronously* and drains any in-flight
`ready` graph so a stale one can't land afterward.

## Shape 2: stream and analyze

*Stream samples out to the worker; publish results back for the GUI.*
This is a continuous flow, not a discrete request, so it uses `AudioTap`
for the ring. The
[`truce-analyzer`](https://github.com/truce-audio/truce-analyzer) plugin
taps the audio into a tap, runs a constant-Q transform off-thread, and
writes the spectrum into shared atomics the editor reads.

### AudioTap

`AudioTap<S>` is a lock-free interleaved ring, built into truce (no extra
dependency). The audio thread pushes whole frames wait-free; a consumer
drains them. On a full ring it drops **whole frames** - never a partial
one - so a drop can't desync L/R.

```rust
let tap = Arc::new(AudioTap::new(32 * 1024, 2));   // frames, channels
                                                    // 32k frames ~ 170 ms at 192 kHz

// audio thread, in process():
tap.push_frames(&interleaved);      // wait-free; drop-on-full is the net

// consumer, off-thread:
tap.drain_with(|chunk| {            // one interleaved slice, in order
    for frame in chunk.chunks_exact(2) { core.process_stereo(frame[0], frame[1]); }
});
```

Size the ring for the worst realistic scheduling gap; drop-on-full covers
anything beyond it. You drain a tap one of two ways.

### Draining on the pool

Reuse the managed pool: a coalescing task woken each block drains the tap.
No thread of your own, bounded thread count, shared with every other
plugin's tasks.

```rust
impl BackgroundTasks for Analyzer {
    type Params = AnalyzerParams;
    type Task   = Analyze;                    // a unit "drain now" signal

    fn run_task(_task: Analyze, params: &AnalyzerParams) {
        params.worker.tap.drain_with(|chunk| { /* run the transform, publish */ });
    }
}

// process(): push, then wake the drain.
params.worker.tap.push_frames(&interleaved);
if let Some(tasks) = context.tasks::<Analyze>() { tasks.spawn_coalescing(Analyze); }
```

### Draining on a dedicated StreamWorker

`AudioTap::spawn_worker` spawns a **dedicated** thread bound to one tap. It
parks until `push_frames` wakes it, drains sequentially, and joins on
drop. The consumer's state lives *inside* the closure - one owner, so no
lock - and the thread never stalls on unrelated pool work. The analyzer
uses this so its transform state is thread-local:

```rust
let tap = Arc::new(AudioTap::new(32 * 1024, 2));
let worker = tap.clone().spawn_worker("analyzer", move |chunk| {
    for frame in chunk.chunks_exact(2) { core.process_stereo(frame[0], frame[1]); }
});
// `worker` is a StreamWorker; keep it alive (store it) and it joins on drop.
```

```rust
// process(): the push itself unparks the worker - no separate wake.
params.worker.tap.push_frames(&interleaved);
```

Because the consumer state lives on the thread, anything the audio thread
needs to change in it - a sample-rate `reset`, say - is handed across an
atomic and applied by the worker on its next drain, rather than reached
directly.

Attach **at most one worker per tap** - the ring has a single consumer,
and a second `spawn_worker` on the same tap panics. Drain a tap with a
`StreamWorker` *or* the pool, never both.

### Publish results to the GUI

The consumer writes into shared atomics - the same idea as truce's
[meters](gui.md), scaled up. The analyzer stores each spectrum bin as an
`AtomicU32` (an `f32` bit-punned with `to_bits()` / `from_bits()`); the
editor reads them each frame.

Since `editor(params)` is an [associated function over the param
store](gui.md) - it only gets the params, so it can't reach DSP state -
the plugin hands the shared handle to the editor through a `#[skip]`
field, filled in `init`:

```rust
#[derive(Params)]
pub struct AnalyzerParams {
    #[param(/* ... */)] pub gain: FloatParam,

    #[skip]
    editor_bridge: Arc<OnceLock<EditorBridge>>,   // { spectrum, instance_id }
}
```

`init` calls `params.editor_bridge.set(...)`; `editor(params)` reads it
back and hands the spectrum to the GUI. For a single scalar value,
`#[meter]` + `context.set_meter()` already does all of this for you.

## Pool or dedicated thread?

| | Managed pool (`BackgroundTasks`) | Dedicated `StreamWorker` |
|-|-|-|
| Threads | Shared, bounded across all instances | One per worker |
| Best for | Bursty or discrete work (rebuild, decode, one FFT) | Continuous streams that shouldn't share (analysis) |
| Consumer state | Reached through `&params` (a lock if mutated) | Lives on the thread, no lock |
| Contention | May wait behind other instances' tasks | Never stalls on unrelated work |
| Lifecycle | Nothing to own | The `StreamWorker` handle joins on drop |

Rule of thumb: reach for the pool first. Take a `StreamWorker` when the
work is a continuous stream whose latency you don't want gated by other
plugins, or whose state is cleaner kept thread-local.

## init and InitContext

`init` receives an `InitContext`, so you can kick off startup work while
building your DSP state - for example, request the first graph build so
the plugin is ready before the first block:

```rust
fn init(params: &Self::Params, cx: &InitContext) -> Self::DspState {
    if let Some(tasks) = cx.tasks::<RebuildRequest>() {
        tasks.try_spawn(RebuildRequest { /* ... */ }).ok();
    }
    Self::DspState::default()
}
```

## Lifecycle

The managed pool owns its own threads: you spawn nothing and join nothing.
A `StreamWorker` you *do* own - store its handle in `DspState` (or in the
`#[skip]` shared struct alongside the tap), and it **joins on drop**:

```rust
struct Shared {
    tap:     Arc<AudioTap<f32>>,
    _worker: StreamWorker,   // dropping this stops and joins the thread
    // ... published results ...
}
```

Join, don't detach: the worker holds `Arc`s to shared state, and joining
guarantees it has stopped touching that state before it drops. Under
[`--shell` hot-reload](hot-reload.md) each logic instance owns its own
state; on reload the old instance drops (its `StreamWorker` joins) and the
new instance builds fresh, so there's nothing extra to do.

## The primitives

| Need | Reach for |
|------|-----------|
| Run discrete work off-thread | `BackgroundTasks` + `tasks:` on `truce::plugin!` |
| Stream samples audio → worker | `AudioTap` (built in) |
| Drain a stream off-thread | `BackgroundTasks` on the pool, or `AudioTap::spawn_worker` for a dedicated thread |
| Hand a built object between threads | [`crossbeam-queue`](https://crates.io/crates/crossbeam-queue) `ArrayQueue` |
| Publish results to the GUI | shared atomics (see [meters](gui.md) or the analyzer's `SpectrumData`) |

`AudioTap`, `StreamWorker`, `BackgroundTasks`, and the task/init contexts
all come from the prelude - no extra dependency. Add `crossbeam-queue`
directly to your plugin's `Cargo.toml` only for the object-handoff queues
in Shape 1; it isn't re-exported, so you control the version.

## Real-time checklist

Everything the audio thread touches:

- no lock, no allocation, no free, no syscall, no unbounded loop;
- schedule with `try_spawn` / `spawn_coalescing` and push with
  `push_frames` - all wait-free, all drop-or-coalesce when full;
- audio → worker requests are coalesced to the latest where only the
  newest matters;
- heavy objects are freed on the worker via a padded discard queue;
- worker scratch buffers are pre-sized off-thread, never grown in
  `process()`.

Get those right and the worker is invisible to the host: `process()`
stays wait-free, and the heavy work happens where it can't hurt the audio.
