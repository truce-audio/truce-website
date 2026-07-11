# 11. Real-time safety

Allocating on the audio thread - a `Vec` that grows past its capacity, a
stray `format!`, a `Box::new`, a mutex lock - is the classic cause of
dropouts under load, and it is invisible on a quiet dev machine: the code
runs fine until a real session pushes it. `rt-paranoid` is an optional
checker that flags any allocation the audio thread makes inside
`process()` (and, opt-in, frees and locks too), turning that silent hazard
into a loud, pinpointed failure.

It is **off and zero-cost by default**. With the feature disabled the
guard around `process` compiles away and no custom allocator is installed,
so release builds are completely unaffected.

## Enabling the checker

Two steps, both per crate. Turn on the feature and install the checker's
global allocator at your crate root:

```toml
# Cargo.toml
[features]
rt-paranoid = ["truce/rt-paranoid"]
```

```rust
// lib.rs
truce::enable_rt_paranoid!();
```

The `enable_rt_paranoid!` call is unconditional; the feature does the
gating. With the feature off it expands to nothing (so it never collides
with a `#[global_allocator]` you set yourself), and with it on it installs
the checking allocator. It has to be a macro you place rather than
something `truce::plugin!` emits, because a global allocator can only be
declared in the final artifact - a library cannot set one for the binary
that links it.

## Gating tests

The primary use is turning an audio test into an allocation test. Because
a [`driver!`](audio-testing.md) run drives your real `process` through the
same path a host does, wrapping one in `assert_no_audio_alloc` fails if
`process` allocated anywhere during the run:

```rust
use truce_test::{assert_no_audio_alloc, driver, InputSource};

#[test]
fn process_is_allocation_free() {
    assert_no_audio_alloc(|| {
        driver!(MyEffect)
            .duration(Duration::from_millis(50))
            .input(InputSource::Constant(0.5))
            .run()
    });
}
```

Run it with the feature on; without it the helper is a no-op, so your
ordinary `cargo test` is unaffected:

```sh
cargo test --features rt-paranoid
```

### Cover the conditional paths

The checker only flags allocations on code a test actually runs. A
constant-input render exercises the steady-state DSP, but an allocation
that only happens on a **parameter change** or a **state load** stays
hidden until a test triggers it. Script those paths so they are covered:

```rust
assert_no_audio_alloc(|| {
    driver!(MyEffect)
        .duration(Duration::from_millis(50))
        .input(InputSource::Constant(0.5))
        .script(|sc| {
            sc.set_param(P::Size, 0.1);
            sc.wait_ms(20);
            sc.set_param(P::Size, 0.9); // does resizing allocate?
        })
        .run()
});
```

## Frees and locks

`assert_no_audio_alloc` flags allocations. Two more real-time hazards are
opt-in:

- **Frees.** `truce::rt::set_check_dealloc(true)` also counts frees inside
  `process` - a value allocated in an earlier block and dropped on the
  audio thread. It is off by default because dropping a value moved in
  from a prior block is a common, benign shape; enable it to catch that
  class deliberately.
- **Locks.** `truce::rt::Mutex` and `truce::rt::RwLock` are drop-in
  replacements for the `std::sync` types that flag a `lock` / `read` /
  `write` taken inside `process`. Use them for state your DSP shares with
  another thread and the checker catches a lock on the audio thread. Only
  locks taken through these types are seen - not `std::sync::Mutex`,
  `parking_lot`, or an OS primitive reached directly.

`assert_realtime_clean` bundles all three: it enables dealloc flagging for
the run and fails on any allocation, free, or truce-typed lock in
`process`.

```rust
assert_realtime_clean(|| {
    driver!(MyEffect)
        .duration(Duration::from_millis(50))
        .input(InputSource::Constant(0.5))
        .run()
});
```

## Letting a block allocate on purpose

If a region inside `process` must legitimately allocate - a rare
first-block lazy init, a debug-only measurement - wrap just that region in
`truce::rt::allow_alloc` so it is not flagged:

```rust
let table = truce::rt::allow_alloc(|| build_wavetable(size));
```

Keep the scope as tight as possible: everything inside runs unchecked.

## Modes and the report

The scoped assertions (`assert_no_audio_alloc`, `assert_realtime_clean`)
gate a test on their own, so most suites never set a mode. Outside them,
the **mode** decides what a violation does. Set it once - in a test
harness, `main`, or your plugin's `init` - and the last call wins:

```rust
truce::rt::set_mode(truce::rt::Mode::Panic);
```

| Mode | Reaction |
|---|---|
| `Mode::Count` (default) | Log the count and a backtrace after the block; keep running |
| `Mode::Panic` | Fail the block - gate a whole suite in one line |
| `Mode::Trap` | Abort at the exact allocation, to catch the live stack in a debugger |

A violation reports the count and the resolved stack of the first offender
(symbolication is deferred until after the block, so the capture itself
stays allocation-free):

```text
truce rt-paranoid: 1 real-time violation(s) on the audio thread in process()
  first violation (allocation):
    my_effect::MyEffect::process (src/lib.rs:47)
    ...
```

## Running the checker in a host

Because `enable_rt_paranoid!` installs the allocator in the final
artifact, the check is not test-only. Build the plugin (or the
[standalone](../formats/standalone.md) host) with `--features rt-paranoid`,
load it in a DAW, and violations print to stderr per the mode - catching
allocations that only a real host provokes, like an automation curve or a
buffer-size change mid-session. Pick the reaction from `init`:

```rust
fn init(_params: &MyParams) -> MyDsp {
    truce::rt::set_mode(truce::rt::Mode::Count); // log and keep playing
    MyDsp::default()
}
```

This is a diagnostic build - ship your release without the feature so the
checker (and its allocator) compile away entirely.

## API surface

```rust
truce::enable_rt_paranoid!();          // install the checking allocator (crate root)

// truce::rt
truce::rt::set_mode(Mode);             // Count (default) | Panic | Trap
truce::rt::set_check_dealloc(bool);    // also flag frees inside process
truce::rt::allow_alloc(|| { .. });     // suspend checking for a region
truce::rt::is_active() -> bool;        // whether the feature is compiled in
truce::rt::Mutex / truce::rt::RwLock;  // lock-flagging drop-ins for std::sync

// truce_test
assert_no_audio_alloc(|| { .. });      // fail on any allocation in process
assert_realtime_clean(|| { .. });      // fail on allocation, free, or truce-typed lock
assert_audio_alloc(|| { .. });         // assert code DOES allocate (skips when off)
```

## What's next

- **[Chapter 10 → audio testing](audio-testing.md)** - the `driver!`
  these assertions wrap, and the rest of its capture surface.
- **[Chapter 17 → best practices](best-practices.md)** - the broader
  audio-thread rules the checker enforces mechanically.
