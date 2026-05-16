# 11. iOS

iOS is the one platform where your truce plug-in runs as something
other than a `.clap` / `.vst3` / `.component` in a desktop DAW: it
ships as an **AU v3** App Extension (`.appex`) wrapped inside a
container `.app`. Same Rust DSP, same params, same editor — but the
deployment shape, the signing model, and the GUI dimensions are
different enough to need their own chapter.

This chapter covers the iteration loop. The wire-format details
(host coverage, AU identifiers, the simulator's remote-VC quirks,
the iced gotcha) live in [formats/au-ios](../formats/au-ios.md);
return there once you're past the first install.

## Prerequisites

| What | Why |
|------|-----|
| Full Xcode (not just CLI tools) | `xcodebuild`, `swiftc`, the iPhoneOS / iPhoneSimulator SDKs |
| Booted iOS Simulator | Iteration target; `xcrun simctl boot 'iPhone 17 Pro'` |
| Apple Developer team ID + `.mobileprovision` | Required only for device installs and `.ipa` packaging — simulator installs ad-hoc sign with `-` |
| Paired & trusted iPhone / iPad | For `--ios-device`; `xcrun devicectl list devices` to verify |

`xcode-select -p` must point at a real `Xcode.app` bundle. The
CLI-tools-only install (`xcode-select --install`) doesn't carry the
iOS SDKs.

## Simulator workflow

This is where 90% of iteration happens. Sub-second install, no
signing, no device pairing.

```sh
xcrun simctl boot 'iPhone 17 Pro'             # one-time per session
cargo truce install --ios -p my-plugin        # build + install
xcrun simctl launch booted com.acme.my-plugin # launch container
```

The container app discovers the AU via
`AVAudioUnitComponentManager`, instantiates it, and hosts the editor
in-process. A Play button drives `cb.process` from the device's mic
(for effects) or a single test note (for instruments / MIDI
processors), so you can hear DSP changes without wiring the appex
into a real iOS DAW.

The container is built from a Swift template truce ships at install
time — title bar, embedded editor, Play button, status label, plus
a landscape sidebar overlay. **Custom container apps (your own
SwiftUI / UIKit shell with bespoke layout, branding, multi-screen
flows) aren't supported yet.** Plug-ins that need a richer
container hand-author one against the framework's C ABI, build it
outside the `cargo truce` pipeline, and load the same `.appex`
truce produces. Native first-class support for swapping the
container template is on the roadmap.

![Truce Gain in the iOS container on iPhone 17 Pro simulator: title bar, embedded knob editor, Play button, status label](/screenshots/ios/gain_container.png)

The `truce-example-gain` plug-in shown above is the same `impl
PluginLogic` you'd run as a CLAP on desktop, with no iOS-specific
code in the plug-in crate — the container chrome around it is
emitted entirely by `cargo truce install --ios`.

`cargo truce install --ios` with no `-p` installs every
`[[plugin]]` in `truce.toml` — useful in a multi-plugin workspace,
but each install runs a fresh `swiftc` + signing pass so 12
examples is several minutes. Pick a plugin with `-p` for iteration.

## Device workflow

```sh
cargo truce install --ios-device -p my-plugin
```

Same pipeline but signs against a real Apple Developer identity
and installs through `xcrun devicectl`. The device path needs three
environment variables — set them in `.cargo/config.toml` (gitignored;
never in `truce.toml`):

```toml
# .cargo/config.toml
[env]
TRUCE_IOS_TEAM_ID = "ABCD1234EF"
TRUCE_IOS_PROVISIONING_PROFILE = "/abs/path/to/MyPlugin.mobileprovision"
TRUCE_IOS_SIGNING_IDENTITY = "Apple Development: Your Name (TEAMID)"
```

Provisioning profile and team ID are per-developer secrets. The
signing identity defaults to `TRUCE_SIGNING_IDENTITY` if unset —
override only when device builds want a different identity than
your macOS desktop installs.

After a device install, the container `.app` shows up on the home
screen under "Apps from Developer *<your name>*" in Settings →
General → VPN & Device Management. Plug-in authors using an
individual Apple Developer account see their personal name there —
this is iOS's behaviour for personal-team certificates, nothing
truce sets.

## Per-plugin iOS knobs in `truce.toml`

The iOS-specific fields go on the `[[plugin]]` entry (not in a
separate `[ios]` block):

```toml
[[plugin]]
name = "My Plugin"
bundle_id = "my-plugin"
crate = "my-plugin"
category = "effect"
fourcc = "MyFx"

# iOS appearance
ios_icon_set = "static/MyPlugin.appiconset"     # Xcode-format .appiconset dir
ios_orientations = ["portrait", "landscape-left", "landscape-right"]
ios_scale_editor_to_fit = true                   # default true
ios_minimum_os_version = "17.0"                 # workspace floor is 16.0

# Optional: app-group entitlement for fullState round-trip
ios_app_group = "group.com.acme.my-plugin"

# Cross-platform but iOS-relevant: silence preview audio in
# standalone + the iOS container app. Use for analyzers / tuners
# that visualise an input signal — keeps process() ticking but
# refuses to close the mic → speakers loop.
mute_preview_output = false
```

`ios_orientations` controls which orientations the container app
rotates into. First entry is the launch orientation. Default
`["portrait", "landscape-left", "landscape-right"]`. Landscape-only
plug-ins (e.g. MIDI effects designed for a wide knob row) pin the
container to landscape and the editor never sees portrait bounds.

![Truce State plug-in in landscape: editor fills the screen, container chrome collapsed into a hamburger icon in the top-right corner](/screenshots/ios/state_container.png)

In landscape the container collapses its chrome (title bar, Play
button, status label) into a hamburger menu in the top-right so the
editor gets the full screen. Tapping the icon slides the chrome out
as an overlay. Plug-ins that support both orientations switch
between the portrait layout (chrome above + below) and this
hamburger layout automatically on rotation.

`ios_scale_editor_to_fit = true` uniformly shrinks an oversize
editor to fit the container's hero region while preserving aspect
ratio. The framework default is `true`; opt out for plug-ins whose
editor is already iPhone-sized or that ship per-orientation
layouts.

`ios_app_group` is required if the plug-in needs to round-trip
fullState blobs or preset files between the appex sandbox and the
container app. Convention: `group.{vendor.id}.{bundle_id}`.

## GUI considerations on iOS

The same `Editor` impl that drives your desktop window paints into
a `UIView` on iOS, but two things shift:

**Touch instead of pointer.** The framework translates `UITouch`
events into the backend's pointer-event shape and pins each drag
to the originating touch's identity, so multi-finger taps don't
hijack an in-progress knob drag. The desktop pointer code paths
are unaffected.

**Narrower canvas.** iPhone portrait gives the container a ~370 pt
wide hero region; iPad landscape gives ~700 pt. An editor sized
for a desktop window (often 800–1000 pt wide) overflows. Three
ways to handle it:

1. **Leave it.** `ios_scale_editor_to_fit = true` uniformly shrinks
   the rendered bitmap to fit. Cheap and preserves layout exactly.
2. **Cap the iOS dimensions.** Custom editors can branch on
   `cfg(target_os = "ios")` and report a different `(width, height)`
   to `EguiEditor::with_ui` / `Editor::size`:
   ```rust
   #[cfg(target_os = "ios")]
   let size = (400, 400);
   #[cfg(not(target_os = "ios"))]
   let size = (800, 400);
   ```
3. **Reshape the layout.** `BuiltinEditor` grids can take
   `.with_cols(6)` on iOS to halve the row count for a more
   landscape-friendly aspect.

## Preview-audio mute

`truce-standalone` (the desktop preview host) and the iOS container
app both drive `process()` themselves so the editor can render
without a DAW. For analyzer-style plug-ins (FFT visualisers,
tuners, spectrum displays) you want `process()` to run on mic
input but **not** route the plug-in's output back to the speakers
— otherwise mic → analyzer → speaker forms a feedback loop.

Set `mute_preview_output = true` in the plug-in's `[[plugin]]`
entry. The standalone and iOS container then call `process()`
each block as usual and zero the output buffer. Real DAW hosts
ignore the flag — they own their own output graph.

## Screenshot regression

```sh
cargo truce screenshot --ios \
    --out screenshots/my-plugin_default_ios.png -p my-plugin    # bake
cargo truce screenshot --ios --check \
    --out screenshots/my-plugin_default_ios.png -p my-plugin    # regress
```

Captures the simulator's rendered output via `simctl io
screenshot`. This is the only path that sees iOS-specific
compositing (the `BuiltinEditor`'s CGImage blit, UIView layer
contents swap). `--crop-mode container` keeps the full container
chrome (title bar, editor, Play button) for framework-level
regressions; `--crop-mode editor` (the default) trims to just the
plug-in's UIView.

The tool is orientation-aware: landscape-only plug-ins get their
captured framebuffer rotated to match the rendered UI before the
crop runs, so the editor-frame coords line up. Sim resolution
depends on the booted device — bake the baseline on whichever
simulator your CI matrix uses.

## What doesn't ship on iOS

| Feature | Why |
|---------|-----|
| `--shell` hot reload | iOS App Extensions reject `dlopen` of anything outside the signed bundle's `Frameworks/` |
| `truce-iced` | iced's `iced_winit` dependency calls a desktop-only `winit` trait inside a non-iOS-gated branch — blocked upstream |
| CLAP / VST3 / VST2 / LV2 / AAX | Platform contract — iOS only hosts AU v3 |
| Universal `.ipa` | Device + simulator slices have distinct Mach-O platform IDs and can't lipo together; use `--xcframework` packaging if you need both slices in one artifact |

## What's next

- **[formats/au-ios](../formats/au-ios.md)** — host coverage matrix,
  AU manufacturer / subtype identifiers, the AVAudioEngine source-
  node render-callback contract, MIDI 2.0 UMP forwarding details,
  the simulator remote-VC workaround.
- **[Chapter 12 → hot reload](hot-reload.md)** — macOS / Windows /
  Linux dev-loop tool. iOS sits this one out (platform constraint).
