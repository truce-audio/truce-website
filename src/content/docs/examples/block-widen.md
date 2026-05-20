# Block Widen

<img src="/screenshots/examples/block-widen.png" style="max-width: 400px; max-height: 300px;" alt="block-widen plugin">

Stereo widener via mid-side recombination. Decomposes input
into `mid = (L+R)/2` and `side = (L-R)/2`, then recombines as
`L = mid + side * width`, `R = mid - side * width`. `width =
1.0` recovers the input; `0.0` collapses to mono; `> 1.0`
exaggerates the stereo image.

Source: [`examples/truce-example-block-widen/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-widen).

## What it demonstrates

- `truce_simd::ops::mac_block` for the mid-side recombination:
  lay down the mid into the output (`copy_block`), then add a
  scaled side (`mac_block`).
- No other example in the tree uses `mac_block`; this is the
  cleanest demo of "additive blend with a scalar coefficient".

## Parameters

| Name | Range | Default |
|------|-------|---------|
| Width | 0 to 2 | 1.0 |

## Build and test

```bash
cargo build -p truce-example-block-widen
cargo test -p truce-example-block-widen
cargo truce install -p truce-example-block-widen
```
