# Wtyczka VST (Windows)

Do zwykłego uruchomienia aplikacji **nie trzeba** kompilować silnika: gotowe pliki PE DLL x86/x64 v0.2.2 znajdują się w `native/bin`.

Jeżeli modyfikujesz źródła C++, zainstaluj Visual Studio Build Tools z komponentem Desktop development with C++, Windows SDK i CMake. W Developer Command Prompt:

```bat
cmake -S native -B native/build-x64 -A x64
cmake --build native/build-x64 --config Release
ctest --test-dir native/build-x64 -C Release --output-on-failure
```

Dla kompilacji 32-bit:

```bat
cmake -S native -B native/build-x86 -A Win32
cmake --build native/build-x86 --config Release
ctest --test-dir native/build-x86 -C Release --output-on-failure
```

Nowa nazwa pliku: `bzAudioLimiterVST-0.2.2.dll`. Nie nadpisuj uruchomionej DLL w katalogu Equalizer APO. Zamiast tego wybierz **Zaawansowane -> Podłącz silnik** po przejściu na nową wersję aplikacji.

**Uwaga:** komendy CMake/MSVC nie były weryfikowane na Windows w tym środowisku. Dostarczone DLL skompilowano oddzielnie przez clang-cl/lld-link, przetestowano kod DSP na Linux i sprawdzono importy/exporty PE.
