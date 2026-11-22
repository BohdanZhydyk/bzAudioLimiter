# bzAudioLimiter

[English](README.md) | [Polski](README.pl.md) | [Українська](README.ua.md)

System-wide real-time audio peak limiter for Windows 10/11. Balances audio volume across movies, games, and music on any output (speakers, headphones, TV, soundbar) — without virtual audio cables or latency.

## Downloads (Windows)

* [bzAudioLimiter-Setup-x64.exe (64-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x64.exe)
* [bzAudioLimiter-Setup-x86.exe (32-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x86.exe)

## Features

* **Zero-latency:** Native VST2 DSP plugin integrated directly into Windows audio pipeline via Equalizer APO.
* **Shared Memory Telemetry:** Real-time gain reduction and peak meter readings streamed to GUI.
* **System Tray:** Runs silently in background with quick toggle and visual status indicator.
* **Hardware-style Controls:** Configurable ceiling limit, threshold fader, ratio, and response speed.

## Quick Start

### Helper Scripts (`scripts/`)
* `START-WINDOWS.cmd` — Launch Vite + Electron in development mode.
* `BUILD-x64.cmd` — Compile 64-bit installer (`release/`).
* `BUILD-x86.cmd` — Compile 32-bit installer (`release/`).

### NPM Commands
```bash
npm install              # Install dependencies
npm run dev              # Dev mode (Vite + Electron)
npm run test:integration  # Run integration tests
npm run dist:x64         # Build x64 installer
npm run dist:x86         # Build x86 installer
```

## Requirements

* Windows 10 / 11 (x64 / x86)
* Stereo PCM output (shared mode)
* [Equalizer APO](https://sourceforge.net/projects/equalizerapo/) installed
