@echo off
setlocal EnableExtensions

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [bzAudioLimiter] Uruchamianie jako Administrator...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0.."
where node.exe >nul 2>nul
if errorlevel 1 (
  echo BRAK NODE.JS. Zainstaluj Node.js LTS.
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  echo Instalacja zaleznosci aplikacji...
  call npm install
  if errorlevel 1 (
    echo BLAD: npm install
    pause
    exit /b 1
  )
)
echo Start bzAudioLimiter (GUI + VST DSP przez Equalizer APO)...
call npm run dev
if errorlevel 1 pause
