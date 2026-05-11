# 1. Install

Set up your machine to build truce plugins. Three things: Rust, a system C/C++ compiler, and the `cargo truce` CLI.

> **First-timer path.** This chapter covers the minimum needed to build CLAP and VST3 — the two formats that work on every OS, that every modern host loads, and that scaffolded plugins enable by default. Other formats (AU, AAX, signed installers, hot-reload sccache) layer on top; their setup lives in [extra setup](#extra-setup) at the bottom and in the [reference](../reference/).

## Rust

Install Rust **1.88+** via [rustup.rs]. If you already have it, `rustup update`.

[rustup.rs]: https://rustup.rs

## Platform compiler

Pick the one for your OS — this is the only platform-specific step.

**macOS**

```sh
xcode-select --install
```

Installs the Xcode command-line tools (clang, system headers). All system frameworks (Cocoa, AudioToolbox, …) come with macOS — no package manager needed.

**Windows**

Install Visual Studio 2019+ with the **"Desktop development with C++"** workload. The Windows SDK and MSVC toolchain come with it. WSL users: install Rust on Windows itself, not in WSL — plugin hosts can't load ELF binaries from WSL paths.

**Linux**

```sh
# Ubuntu / Debian
sudo apt install build-essential pkg-config

# Fedora
sudo dnf install @development-tools pkgconf-pkg-config
```

That's enough for a *headless* CLAP/VST3 plugin. **For a plugin with a GUI**, also install the X11 + GL + Vulkan + font dev libraries (every truce GUI backend goes through `baseview`):

```sh
# Ubuntu / Debian
sudo apt install \
  libx11-dev libx11-xcb-dev libxcb1-dev libxcb-icccm4-dev libxcursor-dev \
  libxkbcommon-dev libxkbcommon-x11-dev libxrandr-dev \
  libgl1-mesa-dev libvulkan-dev mesa-vulkan-drivers \
  libfontconfig1-dev libfreetype-dev
```

(Standalone-host audio adds ALSA + JACK; see [extra setup](#extra-setup).)

## Install the CLI

```sh
cargo install cargo-truce
```

Pulls `cargo-truce` from crates.io. Cargo picks it up as the `cargo truce` subcommand. To upgrade later, run with `--force`.

## Sanity check

```sh
cargo truce doctor
```

Reports what's present and what's missing — Rust version, compiler, optional SDKs, validator binaries. Green rows are ready; yellow are optional; red block something. Run `doctor` any time a build behaves oddly — it's usually faster than reading the error.

You're ready for [chapter 2 → first-plugin](first-plugin.md).

---

## Extra setup

You don't need any of this to build CLAP+VST3 plugins. Pull these in only when you actually need them.

### Standalone host audio (Linux)

The `cargo truce run` standalone host needs ALSA + JACK headers (or the PipeWire JACK shim) on Linux. macOS and Windows have these in the OS:

```sh
# Ubuntu / Debian
sudo apt install libasound2-dev libjack-jackd2-dev pipewire-jack libspa-0.2-jack

# Fedora
sudo dnf install alsa-lib-devel jack-audio-connection-kit-devel
```

Modern PipeWire distros: install `pipewire-jack` and **don't** also run `jackd2` — they fight for the same socket. The shim replaces `libjack.so.0`.

### AU v2

Ships with macOS — no extra setup. Just opt in: `cargo truce install --au2`.

### AU v3 (macOS only)

Needs **full Xcode** (not just CLI tools) — `xcodebuild` builds the `.appex`. Switch the active developer directory once:

```sh
sudo xcode-select -s /Applications/Xcode.app
```

AU v3 also requires a real Developer ID for Apple to load the appex — see [`cargo-config`](../reference/cargo-config.md).

### AAX

Needs the Avid AAX SDK (point `AAX_SDK_PATH` at it) plus PACE/iLok for retail Pro Tools releases. macOS and Windows only. Details in [formats/aax](../formats/aax.md).

### Signed installers (`cargo truce package`)

- **macOS:** signing identities + Apple notary credentials. See [`cargo-config`](../reference/cargo-config.md).
- **Windows:** [Inno Setup 6](https://jrsoftware.org/isinfo.php) for `ISCC.exe`, plus an Authenticode source (Azure Trusted Signing, cert thumbprint, or `.pfx`). See [`cargo-config`](../reference/cargo-config.md).
- **Linux:** no signed-installer support yet.

### sccache

If [sccache](https://github.com/mozilla/sccache) is on `PATH`, `cargo truce` auto-uses it as `RUSTC_WRAPPER` — significant rebuild speed-up. `doctor` reports when it's active. Set `TRUCE_DISABLE_SCCACHE=1` to skip.

### Pin a specific CLI version

```sh
cargo install cargo-truce --version X.Y.Z              # exact version from crates.io
cargo install --git https://github.com/truce-audio/truce \
              --tag vX.Y.Z cargo-truce                 # exact git tag
```

## What's next

- **[Chapter 2 → first-plugin](first-plugin.md)** —
  `cargo truce new`, a tour of the generated files, install into
  your DAW, hear it work.
- **Format details** — per-format prerequisites, host coverage,
  and gotchas in [formats/](../formats/).
- **Environment variables** — every signing, SDK, notary, and
  hot-reload variable in [`cargo-config`](../reference/cargo-config.md).
