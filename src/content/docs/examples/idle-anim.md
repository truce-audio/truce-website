# Idle anim

A pass-through gain whose editor sweeps a knob back and forth from its
`Editor::idle` tick. Nothing in `process` touches the swept value, so
the knob moves only while the host drives `idle`.

Source: [`examples/truce-example-idle-anim/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-idle-anim).

## What it demonstrates

- `Editor::idle(dt)`: advancing an animation by the real elapsed time,
  so the sweep runs at the same speed however fast or unevenly the host
  ticks
- Wrapping the built-in editor in a custom `Editor` that adds idle work
  and delegates everything else; the wrapper keeps the default
  `wants_idle` (`true`) rather than forwarding the built-in editor's
  `false`
- Which formats drive `idle`: run it in each to see the knob move
  (all but AU v3's app extension; see
  [idle](../guide/gui/raw-window-handle.md#idle))

```sh
cargo truce run -p truce-example-idle-anim
```

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Gain | -60 to 6 | dB |
| Sweep | 0 to 1 (moved by the editor) | |
