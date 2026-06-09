# Reiss Robotization

<img src="/screenshots/reiss-mcpherson/robotization.png" class="screenshot-hero" width="415" height="113" alt="Reiss Robotization">

Phase-vocoder effect with two operating modes - robotization (flat
phase, retaining only magnitude) and whisperization (randomised
phase, retaining only magnitude).

Source: [`reiss-mcpherson-robotization/`](https://github.com/truce-audio/reiss-mcpherson-effects/tree/main/plugins/reiss-mcpherson-robotization).

## What it demonstrates

- An STFT-based phase vocoder (window, FFT, manipulate, IFFT,
  overlap-add)
- Two phase-treatment modes selected by `EnumParam`
- Latency reporting for the analysis window
