# Reiss Delay

<img src="/screenshots/reiss-mcpherson/delay.png" class="screenshot-hero" width="208" height="113" alt="Reiss Delay">

Circular-buffer delay line with feedback and dry/wet mix.

Source: [`reiss-mcpherson-delay/`](https://github.com/truce-audio/reiss-mcpherson-effects/tree/main/plugins/reiss-mcpherson-delay).

## What it demonstrates

- Per-channel circular buffer indexed by read / write pointers
- Sub-sample delay times via interpolated read
- A smoothed time parameter to avoid pitch artifacts
