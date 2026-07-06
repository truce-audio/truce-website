# 16. Best practices

A distilled checklist for plugins that behave well in every host. Each
item links to the chapter that covers it in depth; this page is the
short version you can scan before shipping.

## The audio thread is sacred

`process()` runs under a hard deadline set by the host's buffer size. A
single missed deadline is an audible click, so the audio thread must
never do anything with unbounded or unpredictable latency:

- no allocation, no `free`, no lock, no syscall, no file or network I/O;
- no unbounded loop (bound every iteration by the block size or a fixed
  count);
- no `println!` / logging, no `Mutex::lock`, no `Instant::now` in hot code.

Everything the audio thread touches is sized up front. Allocate scratch
buffers in [`reset`](plugin-anatomy.md) (it receives the maximum block
size) or in construction, and size them to that maximum. The
per-instance `EventList` is already pre-allocated; `clear()` and refill
it, never build a fresh one per block. See
[processing](processing.md).

## Precision: `f64` state, `f32` wire

The host wire is `f32`, but single precision drifts over a long session.
Keep DSP *state* - phase accumulators, filter memory, delay-line
positions, modulation math - in `f64`, and cast to `f32` only at the
sample-write boundary. An `f32` phase counter accumulates error audibly
over a multi-hour set.

Pick a prelude per file: `truce::prelude::*` for `f32`,
`truce::prelude64::*` for `f64` end-to-end (the framework advertises
64-bit support to hosts that can use it). Don't import two preludes in
the same file. See [precision](plugin-anatomy.md#precision-preludes).

## Params vs. DSP state

Two kinds of mutable data, two homes:

- **Parameters** are automatable, host-visible, and shared across
  threads. They live in your `#[derive(Params)]` struct with atomic
  storage. Read them each block; don't cache their values in your logic
  struct.
- **DSP state** is per-instance, mutated every sample, and touched only
  by the audio thread. It lives in your logic struct as plain fields, not
  in the params struct.

Keeping the two separate is what lets the editor be a pure function of
the params (below). See [plugin anatomy](plugin-anatomy.md) and
[state](state.md#params-vs-state).

## Smooth every audible parameter

A raw parameter jump zippers. Declare `smooth = "exp(5)"` (or a suitable
time) on any parameter that scales audio - gain, cutoff, mix - and read
the smoothed value per sample or per block. Snap smoothers to their
targets in `reset()` so the first block after activation isn't a ramp up
from zero. See [smoothing](parameters.md#smoothing) and
[sample-accurate automation](parameters.md#sample-accurate-automation).

## Respect event timing

Note and parameter events carry a `sample_offset` into the block. Apply
them at that offset, not all at the top of the block, or automation and
note timing smear by up to a buffer. The framework can split the block at
event boundaries for you. See
[sample-accurate event splitting](processing.md#sample-accurate-event-splitting)
and [MIDI](midi.md).

## Set up in `reset()`, not construction

Construction runs once; `reset()` runs on every activation and whenever
the sample rate or block size changes. Put sample-rate-dependent setup
there: `set_sample_rate`, `snap_smoothers`, clearing delay lines, sizing
scratch to the new maximum block. Construction just wires up fields. See
[lifecycle](plugin-anatomy.md#lifecycle).

## Report latency and tail

If your plugin looks ahead - a lookahead limiter, a linear-phase EQ, an
FFT frame - report it from `latency()` so the host delay-compensates and
your plugin stays time-aligned in the mix. If it rings out after input
stops - reverb, delay - report `tail()` so the host doesn't cut the tail
when the transport stops.

## Keep `bundle_id` stable

A plugin's identity (its CLAP / VST3 ids and its state-envelope hash)
derives from `bundle_id`, not the display name. Pick it once and never
change it: renaming the display name is free, but changing `bundle_id`
orphans every saved session and preset that referenced the old identity.
Porting from another framework? Use
[`migrate_state`](state.md#migrating-state-from-a-pre-truce-build) to keep
loading the old blobs.

## The editor is a function of the params

`editor(params)` has no `self` by design, so opening the GUI provably
can't take the plugin lock or read DSP state. If the editor genuinely
needs shared, DSP-derived data (an analyzer's spectrum, say), route it
through a `#[skip]` field on the params struct - fill it in construction,
read it back in `editor`. Don't try to smuggle DSP state to the GUI any
other way. See [GUI](gui.md) and [state](state.md).

## Save state off the audio thread

Parameters are saved and restored for you. For extra state (file paths,
view modes, custom curves), override
[`snapshot_into`](state.md#two-ways-to-save-save_state-vs-snapshot_into):
the audio thread serializes into a reused buffer each block and the host
reads it back without ever locking the plugin, so a host save never
stalls audio. Use `serialize_into` (not `serialize`) so the per-block
serialize is allocation-free. Reach for the simpler `save_state` only
when the state is small and cheap.

## Offload heavy work to a worker

IR loading, FFT planning, file decode, convolution setup - anything that
allocates or blocks - belongs on a worker thread, with results handed to
the audio thread through a lock-free channel. The audio thread requests
and consumes; it never waits. See [workers](workers.md).

## Kill denormals in feedback paths

Filters and reverbs whose feedback decays toward zero can slip into
denormal numbers, which some CPUs process an order of magnitude slower -
an idle plugin that spikes CPU. Flush very small values to zero in
feedback loops (a tiny DC offset or an explicit flush), and sanitize host
input before dividing by it.

## Test and validate before shipping

Bugs in an audio plugin surface as glitches in someone's session, so
gate on them:

- Use the [audio-testing driver](audio-testing.md) to assert state
  round-trips, the editor exists, and known input produces known output -
  no host needed.
- Gate on [audio-thread allocations](audio-testing.md#catching-audio-thread-allocations):
  wrap a `driver!` run in `assert_no_audio_alloc` under the `rt-paranoid`
  feature and a `process` that starts allocating fails the test, before
  it ever becomes a dropout in someone's session.
- [Screenshot-test](gui.md#screenshot-tests) the editor so layout
  regressions fail in CI.
- Run [`cargo truce validate`](shipping.md#validate) (auval, pluginval,
  clap-validator) before every release, strict in CI.
