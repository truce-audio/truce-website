# 13. State

Everything the host persists for your plugin - session save, preset
recall, duplicating an instance - is one blob: the parameter values,
serialized automatically, plus an optional **extra state** block you
own. This chapter covers the extra block, what happens on load, and
how to migrate state saved by a pre-truce build of your plugin.

## Params vs state

Use a **param** for values the host should treat as a control:
gain, frequency, mix, bypass, mode selectors. Hosts list params in
their automation editors, draw lanes against them, and feed them
through MIDI CC mappings. Params are numeric atoms and serialize
automatically - you never write code to persist them.

Use **state** for everything that isn't a numeric atom: strings,
file paths, loaded sample buffers, lists, view modes, nested
structs. State is opaque to the host - no automation, no CC mapping,
no entry in the host's parameter list. The framework round-trips the
bytes you hand it and nothing more.

There are two ways to carry that non-param state: a `#[persist]`
field on the params struct (below), or the `snapshot_into` /
`load_state` pair (further down). Both are saved in the same
envelope; they differ in where the value lives and who reaches it.

## `#[persist]`: saved fields on the params struct

For small **editor-facing config** - a view mode, an instance label,
a picked file path, an edit counter - mark the field `#[persist]` on
the `#[derive(Params)]` struct. The host saves it alongside the
parameter values with no `snapshot_into` body at all, and because it
lives on the params struct the editor reads and writes it directly
through the `Arc<Params>` it already holds.

```rust
#[derive(Params)]
pub struct MyParams {
    #[param(name = "Gain", range = "linear(-60, 6)", unit = "dB")]
    pub gain: FloatParam,

    // Compound value behind a lock: saved, not automatable.
    #[persist = "memo"]
    pub memo: RwLock<InstanceMemo>,

    // Copy scalar in a lock-free cell - reads cleaner than RwLock<u32>.
    #[persist = "edit_count"]
    pub edit_count: AtomicCell<u32>,
}
```

Pick the wrapper by the field: a `Copy` scalar (a persisted `f32`,
enum, or index) goes in a lock-free `AtomicCell<T>`; a `String`,
`Vec`, or `#[derive(State)]` struct goes behind `RwLock` / `Mutex`.
Fields are keyed (`#[persist = "key"]`, defaulting to the field
name), so a load skips unknown keys and leaves missing ones at their
defaults - old sessions open in newer plugin versions and vice
versa. It works inside `#[nested]` param structs and on every
format.

`#[persist]` vs `snapshot_into`: both persist, in the same envelope.
Use `#[persist]` for small config the editor edits in place; use
`snapshot_into` / `load_state` (below) for an opaque or large blob that
belongs with the DSP state. And note the contrast with a `#[skip]`
field: same shared-`Arc` mechanism, but a `#[skip]` field is
deliberately *not* saved - it's a live channel like an event ring
(see the [parameters reference](../reference/params.md#skipped-fields-skip)).

## `snapshot_into` / `load_state`

Two optional methods on `PluginLogic`:

```rust
fn snapshot_into(state: &Self::DspState, buf: &mut Vec<u8>) -> bool { false }
fn load_state(state: &mut Self::DspState, data: &[u8]) -> Result<(), StateLoadError> { Ok(()) }
```

The defaults mean "no extra state" - a plugin whose entire identity
is its params never touches these. When you do have extra state,
`#[derive(State)]` generates the serialize/deserialize pair for a
plain struct:

```rust
#[derive(State, Default, Clone)]
pub struct InstanceMemo {
    pub label: String,
}

pub struct StateExampleDsp {
    memo: InstanceMemo,
}

impl PluginLogic for StateExample {
    type Params = StateExampleParams;
    type DspState = StateExampleDsp;

    // Lock-free save: the audio thread serializes into a reused buffer
    // each block, and the host reads it back without ever locking the
    // plugin. `serialize_into` clears and refills `buf`, so it is
    // allocation-free once warm.
    fn snapshot_into(state: &StateExampleDsp, buf: &mut Vec<u8>) -> bool {
        state.memo.serialize_into(buf);
        true
    }

    fn load_state(state: &mut StateExampleDsp, data: &[u8]) -> Result<(), StateLoadError> {
        match InstanceMemo::deserialize(data) {
            Some(m) => { state.memo = m; Ok(()) }
            None => Err(StateLoadError::Malformed("InstanceMemo deserialize")),
        }
    }
}
```

Return `Err` for bytes you can't interpret - the wrapper logs it,
and on formats whose state API has a failure return, reports it to
the host.

### Saving without stalling audio

`snapshot_into` is the hook for serializing extra state, and it runs
off the critical path: the audio thread serializes into a reused buffer
after each block and publishes it to a slot the host reads directly, so
saving state - even a large blob - never stalls audio. Because it runs
every block, keep it cheap and allocation-free (use `serialize_into`,
which reuses the buffer's capacity). Returning `true` is a static
opt-in: once you return `true`, always return `true` (write an empty
`buf` if there's nothing to save), never flip back to `false`.

`save_state(state) -> Vec<u8>` still exists as a convenience the
framework calls off-thread (the test driver, the standalone host), and
it delegates to `snapshot_into` by default - so implementing
`snapshot_into` covers every path. You don't override `save_state`;
overriding it no longer reaches the host.

The [state example](../examples/state.md) is the runnable version of
this pattern, including the editor side.

## The load path

Hosts call their state-load API on the main thread, but `load_state`
takes `&mut Self::DspState`, which would alias the audio thread's
`&mut` DSP state inside `process()`. The wrappers resolve this the same
way on every format:

1. The blob is parsed on the host thread.
2. Parameter values apply immediately (param storage is atomic), so
   a host that reads params right back after the load sees the
   restored values.
3. The extra block is handed to the audio thread, which runs your
   `load_state` between blocks.

Two hooks fire after a load, one per thread:

- `PluginLogic::state_changed` - audio thread, immediately after
  `load_state`. Invalidate anything derived from state that the next
  `process()` reads: a decoded IR, a rebuilt wavetable, a sample-pad
  map.
- `Editor::state_changed` - GUI thread. Refresh editor-side caches
  and repaint.

## What's in the blob

The wire format is one envelope for every format: a magic tag, a
version, a hash of the plugin's identity, the param values, and your
extra block. The identity hash derives from `bundle_id` in
`truce.toml` - renaming the plugin's display name doesn't orphan
saved sessions, but changing `bundle_id` does, so pick it once.

Presets are the same envelope in a different container
([chapter 10 → presets](presets.md)), so everything on this page -
extra state, `state_changed`, migration below - applies to preset
recall too.

## Migrating state from a pre-truce build

A plugin ported to truce keeps its format IDs, so hosts hand the
truce build the state blobs the *old* build saved - a JUCE plugin's
XML, another framework's JSON, your own hand-rolled format. By
default those bytes fail the load (the host is told so, and the
plugin keeps its defaults). Override `migrate_state` to translate
them instead:

```rust
impl PluginLogic for Eq {
    type Params = EqParams;
    type DspState = EqDsp;
    fn migrate_state(foreign: &ForeignState) -> Option<MigratedState> {
        let ForeignState::Raw { bytes, .. } = foreign else {
            return None;
        };
        let payload = bytes.strip_prefix(b"EQS1")?;
        // ... parse the old format ...
        Some(MigratedState { params, extra: None })
    }
}
```

The hook is an associated function - no `self` - and runs
synchronously on the host thread, so parsing a big legacy blob with
an allocator-heavy library is fine here. Return `Some` and the
translated params + extra ride the normal load path above; return
`None` for bytes you don't recognize and the load fails exactly as
if the hook didn't exist. The next save writes a normal truce
envelope, so migration is a one-shot door per session or preset,
not a permanent dual-format reader.

`ForeignState` has two shapes:

- `Raw { format, source_key, bytes }` - bytes that aren't a truce
  envelope, exactly as the old build saved them. `format` says which
  wrapper found them; `source_key` is the container key for keyed
  formats (below).
- `MismatchedEnvelope { plugin_id_hash, params, extra }` - a valid
  truce envelope saved under a different plugin identity (you
  changed `bundle_id`). Params are already decoded; you only decide
  whether to accept them.

A truce envelope with a *future* version, and a current-version
envelope with corrupt contents, never reach the hook - both fail the
load outright.

### Keyed formats: declaring the old keys

CLAP, VST3, and VST2 state is one opaque stream, so the wrapper
already holds the foreign bytes when the envelope parse fails -
nothing to declare. AU, LV2, and AAX are keyed containers: the old
build stored its state under *its* dictionary key / property URI /
chunk ID, which truce never reads unless you say where to look:

```toml
[plugin.legacy_state]
# AU ClassInfo dictionary keys (e.g. a JUCE-era AU).
au_keys = ["jucePluginState"]
# LV2 state property URIs.
lv2_uris = ["https://oldvendor.example/oldplug#state"]
# AAX chunk fourccs (exactly 4 bytes each).
aax_chunk_ids = ["OLDS"]
```

Per format, the bytes offered to `migrate_state` come from:

| Format | Foreign bytes source |
| --- | --- |
| CLAP | the raw state stream |
| VST3 | the raw `setState` stream |
| VST2 | the raw `setChunk` blob |
| AU v2 / v3 | first present key from `au_keys` |
| LV2 | first present URI from `lv2_uris` |
| AAX | first present chunk from `aax_chunk_ids` |

For the keyed formats, probing happens only when truce's own entry
is absent, and the first key whose bytes your hook accepts wins.

On AAX the declared chunk ids stay advertised in every session -
that's what makes Pro Tools offer an old session's chunk at all - so
new sessions also carry a zero-size chunk under each legacy id
(truce saves nothing there, and the empty chunk loads back as a
no-op). Your hook only ever sees non-empty legacy bytes.

### Testing a migration

`truce-test` drives the same routing the wrappers use:

```rust
#[test]
fn legacy_state_migrates() {
    let migrated = truce_test::assert_state_migration::<Plugin>(
        PluginFormat::Clap,
        None,
        &legacy_blob(),
    );
    assert_eq!(migrated.params.len(), 10);
}
```

It panics if the hook refuses the bytes, if a migrated param id
isn't registered, or if the migrated extra fails `load_state`. The
[EQ example](../examples/eq.md) carries the reference
`migrate_state` implementation and this test.

One caveat: `--shell` hot-reload builds don't route the hook (the
logic type sits behind a dynamic-library boundary the associated
function can't cross). Test migration against static builds - the
shape every shipped plugin uses.

## Where next

- **[Chapter 10 → presets](presets.md)** - factory presets are this
  envelope in per-format containers.
- **[Chapter 12 → shipping](shipping.md)** - `bundle_id` and the
  identity hash are part of what your installer promises to keep
  stable.
