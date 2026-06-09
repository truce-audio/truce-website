# Reiss Compressor

<img src="/screenshots/reiss-mcpherson/compressor.png" class="screenshot-hero" width="277" height="182" alt="Reiss Compressor">

Three-mode dynamics processor - compressor, expander, or gate -
sharing a common envelope detector and gain computer.

Source: [`reiss-mcpherson-compressor/`](https://github.com/truce-audio/reiss-mcpherson-effects/tree/main/plugins/reiss-mcpherson-compressor).

## What it demonstrates

- Envelope detection with separate attack / release time constants
- A gain computer with soft-knee curvature
- Mode switch (`EnumParam`) that flips the gain-computer shape
  without changing the envelope path
