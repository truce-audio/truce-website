# GUI Zoo (slint)

<img src="/screenshots/examples/gui-zoo-slint.png" class="screenshot-hero" width="350" height="450" alt="gui-zoo-slint plugin">

The widget reference rendered through `truce-slint`. Mirrors the
built-in [gui-zoo](./gui-zoo)'s param set, with the UI defined in
a declarative `.slint` markup file rather than Rust code.

Source: [`crates/truce-slint/examples/truce-example-gui-zoo-slint/`](https://github.com/truce-audio/truce/tree/main/crates/truce-slint/examples/truce-example-gui-zoo-slint).

## What it demonstrates

- Slint markup composition for laying out the same widget set
- Build-time `.slint` compilation via `build.rs` + `truce-slint-build`

Lives in the `truce-slint` Cargo sub-workspace - see the [slint
integration guide](../guide/gui/slint).
