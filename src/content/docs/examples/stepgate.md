# Stepgate

A tempo-synced step gate: eight steps, each with a level and an on/off
switch, gate the audio in time with the host transport. With no
transport it free-runs at 120 BPM.

Source: [`examples/truce-example-stepgate/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-stepgate).

## What it demonstrates

- `#[nested]` arrays: one field typed `[StepParams; 8]` instantiates
  the same two-param group eight times, and the DSP and editor index
  into it (`params.step[i].level`)
- Stable ids under the default hash scheme: growing the array or adding
  a param to `StepParams` later moves no existing id, so hosts' saved
  automation stays put
- The static id resolver the derive generates per array field:
  `GateParams::step_id(i, StepParamsParamId::Level)`
- Array-derived names (`Step 1 Level` … `Step 8 Level`) for hosts and
  the GUI
- Reading the host beat position to pick the current step, with a
  one-pole slew so step edges don't click
- An `aax_category` from the recognized set (`"Dynamics"`)

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Step *n* Level (×8) | 0 to 1 (default 1) | % |
| Step *n* On (×8) | on / off (default on) | |
| Rate | quarter to 1/32 notes | step length |
| Slew | 0 to 50 (default 2) | ms |

See [parameters → arrays of groups](../reference/params.md#arrays-of-groups)
for the id layout and naming rules.
