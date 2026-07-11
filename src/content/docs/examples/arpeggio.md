# Arpeggio

<img src="/screenshots/examples/arpeggio.png" class="screenshot-hero" width="139" height="182" alt="arpeggio plugin">

Tempo-synced arpeggiator that sequences held notes in configurable
patterns.

[`truce-example-arpeggio`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio)
rebuilds its sequence into reused, pre-sized buffers so `process` never
allocates on the audio thread - its test uses the
[rt-paranoid](../guide/rt-paranoid.md) checker to assert it stays
allocation-free.

## What it demonstrates

- Tempo-synced MIDI processing using `context.transport.tempo`
- Enum parameter (`EnumParam<ArpPattern>`) with dropdown widget
- Stateful MIDI effect: tracks held notes, manages step counter and
  gate timing
- Octave stacking and directional patterns (Up, Down, Up/Down,
  Random)
- Rebuilding per-block DSP state without allocating on the audio thread

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Rate | 1 to 8 | -- | Note divisions (1=whole, 4=quarter, 8=eighth) |
| Gate | 0.1 to 1.0 | % | Note length as fraction of step |
| Octaves | 1 to 4 | -- | Octaves to stack above held notes |
| Pattern | Up/Down/Up-Down/Random | -- | Arp direction |
