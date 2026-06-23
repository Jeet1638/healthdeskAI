@echo off
cd /d "%~dp0"
npm.cmd run dev
echo.
echo Frontend server stopped. Press any key to close this window.
pause >nul
