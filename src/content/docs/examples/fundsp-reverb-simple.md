# Fundsp Reverb (Simple variant)

<img src="/screenshots/examples/fundsp-reverb-simple.png" class="screenshot-hero" width="208" height="182" alt="fundsp-reverb-simple plugin">

Stereo plate reverb wired through a
[`fundsp`](https://github.com/SamiPerttu/fundsp) audio graph. Same
topology / params / signal flow as
[fundsp-reverb-worker](./fundsp-reverb-worker), but the graph
rebuild happens **inline on the audio thread** instead of on a
background worker.

Source: [`examples/truce-example-fundsp-reverb-simple/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple).

The [fundsp integration guide](../guide/fundsp) walks through both
variants in depth, explaining the rebuild trigger, why some params
need a rebuild, and what the worker pattern buys you.

```text
in (L,R) ──► high-pass (low cut)  ──► low-pass (high cut)  ──► reverb_stereo ──┐
                                                                                │
in (L,R) ─────────────────────────────────────────────────────────────────► dry ┤──► out
                                                                                │
                                                              mix ──────────────┘
```

| Param    | Range                  |
|----------|------------------------|
| Low Cut  | 20 Hz → 2 kHz (log)    |
| High Cut | 500 Hz → 18 kHz (log)  |
| Time     | 0.1 s → 20 s (log)     |
| Mix      | 0 → 1                  |

## Integration patterns

- **Graph rebuilt inline in `process()`.** When Time crosses the
  hysteresis threshold, `process()` calls `rebuild_graph` directly.
  `Box::new(...)` and `graph.allocate()` run on the audio thread.
  The worker variant moves both off-thread; everything else about
  the graph wiring is identical between the two crates.
- **Hysteresis on Time changes.** `reverb_stereo` bakes RT60 at
  construction, so each crossing means a full rebuild. The 5%
  threshold keeps tiny drifts (smoother ramps, automation jitter)
  from triggering rebuilds.
- **Read the raw target, not the smoothed value.** A smoothed
  `time.read()` would crawl across the threshold for ~200 ms on
  each knob move and rebuild every block until it settled —
  audible as an unstable tail.
- **Params reach the graph through `fundsp::Shared` atomics.**
  `var(&shared)` reads them per sample; the closure inside
  `for_each_frame` writes the smoothed truce-side value into the
  cell on the same tick (sample-accurate automation).
- **`Box<dyn AudioUnit>`** for the field type. The concrete
  `An<…>` is hundreds of chars of nested generics; the vtable
  cost is one indirection per block.
- **`AudioBuffer::for_each_frame::<2, _>`** transposes truce's
  per-channel layout into stack-allocated frames so fundsp's
  `tick(in, out)` callback can be called directly. No scratch
  field.

## Gotchas

- **Filter input order is positional and unchecked.** `highpass()`
  / `lowpass()` take `(signal, cutoff, Q)`. Every connection is
  `f32`, so `(cutoff | Q | signal) >> highpass()` compiles fine
  and silently feeds the filter cutoff in as audio — the resulting
  filter blows up the reverb FDN to peak ~7000 within a second.
  Test against constant input + `assert_peak_below`.
- **Type-level channels.** `dry * mix` fails to compile when `dry`
  is stereo and `mix` is a 1-channel `Shared` read; broadcast the
  mix to stereo manually with `var(&mix) | var(&mix)`. fundsp's
  payoff (graph composition with `>>` / `|` / `&`) costs this
  kind of explicit plumbing.
