@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo [bzAudioLimiter] Przygotowanie srodowiska...
taskkill /F /IM bzAudioLimiter.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
(call )

if exist "release\win-ia32-unpacked" rd /s /q "release\win-ia32-unpacked" >nul 2>&1
if exist "release\win-unpacked" rd /s /q "release\win-unpacked" >nul 2>&1
(call )

if not exist "node_modules\electron" (
  echo [bzAudioLimiter] Instalacja brakujacych zaleznosci...
  call npm install
  if errorlevel 1 goto fail
)

echo [bzAudioLimiter] Kompilacja instalatora x86...
call npm run dist:x86
if errorlevel 1 goto fail

echo.
echo ========================================================
echo Instalator x86 zapisany pomyslnie w release\
echo ========================================================
pause
exit /b 0

:fail
echo.
echo BLAD KOMPILACJI
pause
exit /b 1
