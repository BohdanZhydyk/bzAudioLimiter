# bzAudioLimiter

[English](README.md) | [Polski](README.pl.md) | [Українська](README.ua.md)

Systemowy limiter szczytowy w czasie rzeczywistym dla Windows 10/11. Wyrównuje głośność filmów, gier i muzyki na dowolnym wyjściu (głośniki, słuchawki, TV, soundbar) bez wirtualnych kabli i opóźnień.

## Instalatory (Windows)

* [bzAudioLimiter-Setup-x64.exe (64-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x64.exe)
* [bzAudioLimiter-Setup-x86.exe (32-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x86.exe)

## Funkcje

* **Zero opóźnień:** Natywna wtyczka VST2 DSP wpięta bezpośrednio w potok audio Windows przez Equalizer APO.
* **Telemetria w pamięci współdzielonej:** Odczyt redukcji i poziomu szczytowego na żywo w GUI.
* **Zasobnik systemowy (tray):** Praca w tle z szybkim przełącznikiem i kolorowym statusem.
* **Sprzętowe suwaki:** Płynna regulacja limitu maksymalnego, progu działania, siły kompresji i szybkości reakcji.

## Szybki start

### Skrypty pomocnicze (`scripts/`)
* `START-WINDOWS.cmd` — Uruchomienie trybu deweloperskiego (Vite + Electron).
* `BUILD-x64.cmd` — Budowa instalatora 64-bit (`release/`).
* `BUILD-x86.cmd` — Budowa instalatora 32-bit (`release/`).

### Polecenia NPM
```bash
npm install              # Instalacja zależności
npm run dev              # Tryb deweloperski
npm run test:integration  # Testy integracyjne
npm run dist:x64         # Budowa instalatora x64
npm run dist:x86         # Budowa instalatora x86
```

## Wymagania

* Windows 10 / 11 (x64 / x86)
* Wyjście stereo PCM (tryb współdzielony)
* Zainstalowany [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)
