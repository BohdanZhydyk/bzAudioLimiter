# bzAudioLimiter

[English](README.md) | [Polski](README.pl.md) | [Українська](README.ua.md)

Системний обмежувач піків звуку в реальному часі для Windows 10/11. Вирівнює гучність фільмів, ігор та музики на будь-якому виході (динаміки, навушники, ТВ, саундбар) без віртуальних кабелів і затримок.

## Інсталятори (Windows)

* [bzAudioLimiter-Setup-x64.exe (64-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x64.exe)
* [bzAudioLimiter-Setup-x86.exe (32-bit)](https://github.com/BohdanZhydyk/bzAudioLimiter/raw/main/release/bzAudioLimiter-Setup-x86.exe)

## Можливості

* **Нульова затримка:** Нативний VST2 DSP плагін, інтегрований безпосередньо в аудіотракт Windows через Equalizer APO.
* **Телеметрія через спільну пам'ять:** Реальний моніторинг зниження гучності та піків у GUI.
* **Системний трей:** Робота у фоні зі швидким керуванням та кольоровим індикатором.
* **Апаратні повзунки:** Зручне налаштування стелі гучності, порогу спрацювання, ступеня стиснення та швидкості реакції.

## Швидкий запуск

### Допоміжні скрипти (`scripts/`)
* `START-WINDOWS.cmd` — Запуск режиму розробки (Vite + Electron).
* `BUILD-x64.cmd` — Збірка 64-бітного інсталятора (`release/`).
* `BUILD-x86.cmd` — Збірка 32-бітного інсталятора (`release/`).

### Команди NPM
```bash
npm install              # Встановлення залежностей
npm run dev              # Режим розробки
npm run test:integration  # Інтеграційні тести
npm run dist:x64         # Збірка інсталятора x64
npm run dist:x86         # Збірка інсталятора x86
```

## Вимоги

* Windows 10 / 11 (x64 / x86)
* Вихід stereo PCM (shared mode)
* Встановлений [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)
