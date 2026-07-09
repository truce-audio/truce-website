# 7. Workers

Some work has no place on the audio thread: allocating or freeing
memory, building a DSP graph, an FFT, resampling, reading a file -
anything that can block or run for an unbounded time. The fix is a
**worker thread**: a background thread that does the heavy work while
`process()` stays real-time.

truce deliberately ships no "worker" abstraction. The Rust ecosystem
already has the right primitives - lock-free queues, ring buffers, and
`std::thread` - and every plugin's worker differs in exactly the parts a
wrapper would have to hide. This chapter shows how to wire one up
directly, using the two workers in the repo as worked examples.

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

- push into a channel with `force_push` / `try_push` / drop-on-full,
  never a blocking send;
- pop from a channel with `pop` / `try_recv`, never a blocking receive;
- the worker does all the heavy work **and all the heavy drops** - a big
  `Box` or `Vec` is never dropped in `process()`.

The worker thread can block, allocate, and free freely. That's the whole
point of moving the work there.

## The primitives

| Need | Reach for |
|------|-----------|
| Stream samples audio → worker | [`ringbuf`](https://crates.io/crates/ringbuf) SPSC (`HeapRb::split()`) |
| Hand a discrete request or built object between threads | [`crossbeam-queue`](https://crates.io/crates/crossbeam-queue) `ArrayQueue` |
| Wake an idle worker on demand | `std::thread::park` / `Thread::unpark` |
| Publish results to the GUI | shared atomics (see [meters](gui.md) or the analyzer's `SpectrumData`) |

Add `crossbeam-queue` / `ringbuf` to your plugin's `Cargo.toml` directly;
they're not re-exported by truce, so you control the versions.

## Shape 1: offload construction

*Build a heavy object off-thread, hand it to the audio thread, free the
old one off-thread.* The
[`fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker)
example rebuilds its fundsp graph this way when the user moves the Time
knob (each change reconstructs the reverb's delay-line network, which
allocates).

Three lock-free queues carry the handoff:

```rust
struct RebuildChannel {
    requests: ArrayQueue<RebuildRequest>,   // audio → worker: Copy, capacity 1
    ready:    ArrayQueue<ReadyGraph>,        // worker → audio: capacity 1
    discard:  ArrayQueue<Box<dyn AudioUnit>>,// audio → worker: free off-thread
    shutdown: AtomicBool,
}
```

**Request (audio → worker), coalesced.** The audio thread posts the
latest target and wakes the worker. `force_push` on a `Copy` request is
safe here - the displaced value drops for free:

```rust
state.rebuild.requests.force_push(RebuildRequest { sample_rate, time_s });
state.worker_thread.unpark();
```

The worker drains to the *newest* request and ignores the rest, so a
knob sweep triggers one rebuild per worker cycle, not one per block:

```rust
let mut latest = None;
while let Some(req) = channel.requests.pop() { latest = Some(req); }
if let Some(req) = latest {
    let graph = build_graph(req.sample_rate, req.time_s, /* ... */); // allocates
    let _ = channel.ready.force_push(ReadyGraph { graph, sample_rate: req.sample_rate });
}
```

**Swap in (worker → audio), with staleness rejection.** The audio thread
pops the finished graph and swaps it in - but only if it was built for
the current sample rate. A graph the worker was midway through building
when `reset()` changed the rate is routed straight to `discard`:

```rust
if let Some(ready) = state.rebuild.ready.pop() {
    if ready.sample_rate.to_bits() == state.last_built_sr.to_bits() {
        let old = std::mem::replace(&mut state.graph, ready.graph);
        let _ = state.rebuild.discard.push(old);      // free off-thread
    } else {
        let _ = state.rebuild.discard.push(ready.graph); // stale: discard
    }
}
```

**Free off-thread.** `discard` is padded (capacity 8 vs. at most one
swap per block) so it can't fill and force a free on the audio thread.
The worker drains and drops it at the top of its loop. That
`std::mem::replace` above never runs `drop` on the old graph - it moves
it into the queue instead.

**reset() short-circuits the worker.** `reset()` is off the audio
thread, so it rebuilds *synchronously* and drains any in-flight result so
a stale one can't land afterwards:

```rust
fn rebuild_now(&mut self, sample_rate: f64, time_s: f32) {
    self.graph = build_graph(sample_rate, time_s, /* ... */); // allocate directly
    self.last_built_sr = sample_rate;
    while self.rebuild.requests.pop().is_some() {}   // drop stale request
    while self.rebuild.ready.pop().is_some()   {}    // drop stale in-flight graph
}
```

## Shape 2: stream and analyze

*Stream samples out to the worker; publish results back for the GUI.*
The [`truce-analyzer`](https://github.com/truce-audio/truce-analyzer)
plugin taps the audio into a ring buffer, and a worker runs the spectral
analysis and writes the spectrum into shared atomics the editor reads.

**Tap (audio → worker), drop on full, frame-aligned.** A
`ringbuf::HeapRb` split into producer / consumer. If the worker stalls,
the producer *drops* samples rather than block - and rounds the vacant
window down to whole frames so a drop never desyncs L/R:

```rust
fn push_stereo_frames(tap_tx: &mut HeapProd<f32>, samples: &[f32]) {
    let vacant_aligned = tap_tx.vacant_len() & !1;   // whole stereo frames
    let push_len = samples.len().min(vacant_aligned);
    let _ = tap_tx.push_slice(&samples[..push_len]);
}
```

Size the buffer for the worst realistic scheduling gap (the analyzer
uses 32k frames, ~170 ms at 192 kHz), with drop-on-full as the net
beyond that.

**Worker loop, poll + short sleep.** A streaming worker polls the tap and
sleeps briefly when it's empty. The sleep must be short enough that a
60 Hz UI never sees stale data (the analyzer uses 4 ms), and each
iteration processes a *bounded* number of frames so `shutdown` /
`reset` still get checked at ~kHz under a full buffer:

```rust
loop {
    if ctl.shutdown.load(Ordering::Acquire) { break; }
    let n = tap_rx.pop_slice(&mut scratch);      // scratch pre-sized off-thread
    if n == 0 { thread::sleep(Duration::from_millis(4)); continue; }
    for frame in scratch[..n].chunks_exact(2) { core.process_stereo(frame[0], frame[1]); }
}
```

**Publish results to the GUI.** The worker writes into shared atomics -
the same idea as truce's [meters](gui.md), just scaled up. The analyzer
stores each spectrum bin as an `AtomicU32` (an `f32` bit-punned with
`to_bits()` / `from_bits()`); the editor reads them each frame.

Because `editor(params)` is an [associated function over the param
store](gui.md) - it only gets the params, so it can't reach DSP state -
the plugin hands the shared handle to the editor through a `#[skip]`
field on the params struct:

```rust
#[derive(Params)]
pub struct AnalyzerParams {
    #[param(/* ... */)] pub gain: FloatParam,

    // `#[skip]` = not a parameter. The plugin's `init` fills it so
    // `editor(params)`, which only sees the param store, can reach the
    // shared spectrum.
    #[skip]
    editor_bridge: Arc<OnceLock<EditorBridge>>,   // { spectrum, instance_id }
}
```

`init` calls `params.editor_bridge.set(...)`; `editor(params)` reads it
back and hands the spectrum to the GUI. For a single scalar value,
`#[meter]` + `context.set_meter()` already does all of this for you.

## Lifecycle

Spawn the worker in your logic's `init`, store its handle in the
`DspState`, and **join it in `Drop`** on that state:

```rust
let handle = thread::Builder::new()
    .name("my-plugin-worker".into())        // always name the thread
    .spawn(move || { /* worker loop */ })
    .expect("spawn worker");

impl Drop for MyPluginDsp {
    fn drop(&mut self) {
        self.ctl.shutdown.store(true, Ordering::Release);
        self.worker_thread.unpark();          // if you park; wakes it to see shutdown
        if let Some(h) = self.handle.take() { let _ = h.join(); }
    }
}
```

Join, don't detach: the worker holds `Arc`s to shared state, and joining
guarantees it has stopped touching that state before the DSP state
drops. Under [`--shell` hot-reload](hot-reload.md) each logic
instance owns its own worker; on reload the old instance's `Drop` joins
the old worker and the new instance spawns a fresh one, so there's
nothing extra to do.

## Real-time checklist

Everything the audio thread touches:

- no lock, no allocation, no free, no syscall, no unbounded loop;
- every channel push is `force_push` / `try_push` / drop-on-full;
- audio → worker requests are coalesced to the latest, capacity 1;
- heavy objects are freed on the worker via a padded discard queue;
- worker scratch buffers are pre-sized off-thread, never grown in
  `process()`.

Get those right and the worker is invisible to the host: `process()`
stays wait-free, and the heavy work happens where it can't hurt the
audio.
