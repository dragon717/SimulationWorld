@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-windows.ps1" Start -OpenBrowser %*
if errorlevel 1 (
    pause
    exit /b 1
)
