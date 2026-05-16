# Audio Unit v3 (iOS / iPadOS)

iOS only hosts **AU v3** plugins, delivered as an `.appex` App
Extension inside a container `.app`. Logic Pro for iPad,
GarageBand, AUM, Cubasis, BeatMaker, Loopy Pro all consume this
shape. Every other format truce supports — CLAP, VST3, VST2, LV2,
AAX, standalone host — is unviable on iOS by platform contract.

`cargo truce install --ios` drives the same Rust plugin code your
macOS / Windows / Linux build produces — same DSP, same params,
same editor — through the iOS Simulator. Add `--ios-device` for a
tethered iPhone / iPad. The build flow is identical apart from
signing identity.

## Enable

```toml
[features]
au = ["dep:truce-au"]
default = ["clap", "vst3", "au"]
```

Same `au` feature flag as macOS. The framework's `truce-au` crate
gates iOS-specific entry points via `#[cfg(target_os = "ios")]` —
no extra opt-in.

## Requirements

| Path | Toolchain | Signing |
|------|-----------|---------|
| Simulator | Xcode CLI tools + a booted iOS Simulator | Ad-hoc (`-`) works |
| Device    | Full Xcode + paired & trusted iPhone / iPad | Apple Development identity + `.mobileprovision` |
| `.ipa`    | Full Xcode | Apple Distribution identity + `.mobileprovision` (App Store / TestFlight) |

`xcode-select -p` must point at a real `Xcode.app`. The CLI tools
alone don't carry the iPhoneOS / iPhoneSimulator SDKs.

### Per-developer credentials

Put these in `.cargo/config.toml` `[env]` (gitignored — never in
`truce.toml`):

```toml
[env]
# Required for device + .ipa paths. Apple Developer team ID.
TRUCE_IOS_TEAM_ID = "ABCD1234EF"

# Required for device + .ipa paths. Path to a .mobileprovision
# downloaded from developer.apple.com — match the bundle ID + team
# you're signing with.
TRUCE_IOS_PROVISIONING_PROFILE = "/abs/path/to/MyPlugin.mobileprovision"

# Optional. Defaults to TRUCE_SIGNING_IDENTITY. For App Store
# distribution, set this to "Apple Distribution: …".
TRUCE_IOS_SIGNING_IDENTITY = "Apple Development: Your Name (TEAMID)"
```

Simulator installs ignore all three and ad-hoc sign with `-`.

## Per-plugin truce.toml fields

```toml
[ios]
# Workspace-wide default. Per-plugin `ios_minimum_os_version`
# overrides. Floor: 16.0 (the lowest officially supported by the
# Swift + AUv3 toolchain we drive).
minimum_os_version = "16.0"

[[plugin]]
# When set, both the container and the appex get the
# com.apple.security.application-groups entitlement so fullState
# blobs and preset files round-trip across the sandbox boundary.
# Convention: group.{vendor.id}.{bundle_id}
ios_app_group = "group.com.acme.myplugin"

# Path (relative to workspace root) to an Xcode-format
# `.appiconset` directory. When `xcrun actool` is on `$PATH` it's
# compiled into an `Assets.car` + matching `CFBundleIcons` plist
# additions (App-Store-compatible). When `actool` is missing or
# the directory isn't a real .appiconset, the build falls back to
# copying raw PNGs into the bundle root and emits a minimal
# `CFBundleIconFiles` array — good enough for simulator + ad-hoc,
# but App Store ingestion will reject. Absent → system stub icon.
ios_icon_set = "assets/MyPlugin.appiconset"

# Per-plugin override of the workspace floor.
ios_minimum_os_version = "17.0"
```

## Container app

`cargo truce install --ios` wraps the `.appex` in a container `.app`
built from a Swift template truce ships at install time
(`crates/cargo-truce/templates/au_ios/AppMain.swift`). The
container handles AU discovery, hosts the embedded editor, shows a
Play button that drives `cb.process` from mic input (effects) or
a test note (instruments / MIDI processors), and switches between
portrait chrome and a landscape hamburger sidebar.

**Custom container apps are not yet supported.** Plug-ins that
need a bespoke shell (custom branding, multi-screen flows, App
Store-grade marketing UI) currently hand-author one against the
framework's C ABI, build it outside `cargo truce`, and load the
same `.appex` artifact. Wiring the install pipeline to accept a
user-supplied container template is on the roadmap.

## Install

### Simulator (most iteration happens here)

```sh
xcrun simctl boot 'iPhone 17 Pro'                  # boot once
cargo truce install --ios -p truce-example-gain    # build + install
xcrun simctl launch booted audio.truce.gain        # launch container
```

The container app discovers the AU through
`AVAudioUnitComponentManager`, instantiates it, and hosts its
editor in-process. `process()` runs end-to-end (100 ms silent
buffer by default — pass `--mic-input` at launch for live audio).

### Device

```sh
cargo truce install --ios-device -p truce-example-gain
```

Needs `ios-deploy` on `$PATH` (`brew install ios-deploy`) or
Xcode 15+'s `xcrun devicectl`. Pair + trust the device first
(`xcrun devicectl list devices` to verify).

## Package

```sh
cargo truce package --ios -p truce-example-gain
```

Produces `target/ios/ipa/MyPlugin.ipa`, signed with the
`TRUCE_IOS_SIGNING_IDENTITY` identity and the embedded
`.mobileprovision`. Upload through `xcrun altool` /
[Transporter](https://apps.apple.com/app/transporter/id1450874784)
to TestFlight or the App Store.

### xcframework redistribution

```sh
cargo truce package --ios --xcframework -p truce-example-gain
```

Produces `target/ios/xcframework/<Plugin>AU.xcframework/`
containing both device + simulator slices. Useful if you're
shipping the framework as a building block for someone else's
Xcode project; the `.ipa` path embeds the framework directly and
doesn't need this artifact.

## Identifiers

iOS uses the same AU manufacturer / subtype codes as macOS — they're
in the AU spec, not the platform:

```toml
[vendor]
au_manufacturer = "AcMe"      # 4-char code, shared with macOS

[[plugin]]
fourcc      = "MyFx"
au3_subtype = "MyF3"           # optional; iOS reuses au3_subtype
```

## Hosts

| Host | Status |
|------|--------|
| GarageBand for iPad | ✅ |
| Logic Pro for iPad | ✅ |
| AUM | ✅ |
| Cubasis | ✅ |
| BeatMaker 3 | ✅ |
| Loopy Pro | ✅ |

## Gotchas

- **No hot reload on iOS.** `--shell` mode relies on `dlopen`-ing
  freshly-built logic dylibs at runtime; iOS App Extensions reject
  `dlopen` of anything outside the signed bundle's
  `Frameworks/`. Shell mode stays macOS-only.
- **Simulator + remote-VC quirks.** Under ad-hoc signing, the iOS
  Simulator's remote view-controller bridge doesn't always fire
  `loadView` on the appex's `AUViewController`. The container app
  links the framework directly and calls
  `g_callbacks.gui_open(ctx, container_view)` itself — same
  rendering pipeline as a real AU host, just without the remote-VC
  indirection. Production hosts use the registered factory; this
  workaround is simulator-only.
- **Universal `.ipa` isn't a thing.** iOS device (`platform 2`) +
  simulator (`platform 7`) slices have distinct Mach-O platform
  IDs and aren't lipo-able. Use `xcframework` if you need both;
  the install / package paths build a single slice each.
- **MIDI 2.0 forwarding.** iOS 17+ / macOS 14+ AU hosts deliver
  MIDI via `AURenderEvent.MIDIEventList` (UMPs) rather than the
  legacy 3-byte `AURenderEvent.MIDI`. Truce decodes both. MIDI 2.0
  channel-voice messages (per-note expression, 32-bit
  resolution) land as the appropriate `EventBody` variant; MIDI 1.0
  UMPs are downconverted to the legacy `EventBody` shapes.
- **Single-pointer touch routing.** Multi-finger touches don't
  hijack an in-progress drag — the editor pins the gesture to the
  `UITouch` that started it and ignores other simultaneous
  touches. True multi-widget multi-touch (two knobs grabbed at
  once) is a framework-wide change queued for follow-up.
- **App Store review.** The container app must present a
  meaningful UI; Apple rejects "stub" container apps. Truce's
  default container shows the plugin name + a description label.
  Customize via `truce.toml` `ios_icon_set` for branding.
- **Alt-GUI backends:** `truce-egui` runs egui-wgpu on iOS through
  a CAMetalLayer-backed UIView with a CADisplayLink-driven repaint
  pump. `truce-slint` runs Slint's `MinimalSoftwareWindow`
  software renderer into an RGBA buffer that's blitted to the
  `UIView`'s `layer.contents` via `CGImage` (the same CPU path the
  built-in iOS editor uses). Both translate `UITouch` events into
  their backend's pointer-event shape. `truce-iced` is the lone
  hold-out (see the iced gotcha below).
- **`truce-iced` is desktop-only on iOS today, upstream blocker.**
  iced's `iced` umbrella crate has a non-optional dependency on
  `iced_winit`, and iced_winit calls
  `winit::platform::modifier_supplement::KeyEventExtModifierSupplement`
  methods inside a `cfg(not(target_arch = "wasm32"))` branch.
  winit only ships that trait on desktop, so the branch fires on
  iOS and fails to compile — and there's no feature flag to opt
  out of iced_winit. Plugins built on `truce-iced` skip the iOS
  build with a clear cfg gate until the upstream issue lands. Use
  the built-in editor, `truce-egui`, or `truce-slint` for iOS
  coverage in the meantime.

## iOS screenshot regression

```sh
cargo truce screenshot --ios --out screenshots/gain_default_ios.png -p truce-example-gain          # bake baseline
cargo truce screenshot --ios --check --out screenshots/gain_default_ios.png -p truce-example-gain  # regress against it
```

Builds + installs the plugin on the booted simulator, launches it,
and captures the simulator's rendered output via `xcrun simctl io
screenshot`. This is the only path that sees iOS-specific
compositing (the `BuiltinEditor`'s CGImage blit, UIView layer
contents swap, scale-factor application). The desktop dlopen-based
screenshot path can't reach into the iOS render pipeline.

`--check` compares byte-for-byte against the committed baseline
and fails non-zero on diff with the exact `cp` command to accept
the new render. Sim resolution depends on the booted device, so
bake the baseline on whichever simulator your CI matrix uses.

## Programmatic regression test

`cargo truce install --ios -p truce-example-gain && xcrun simctl
launch booted gain --probe-touch` synthesises a synthetic
down-drag on the editor's first knob via a hidden
`_truce_probe_touch:` selector, reads `param[0]` before and after,
and logs `PASS — touch dispatch routed through to set_param` when
the value changed. Useful as a smoke check after editor-pipeline
edits.
