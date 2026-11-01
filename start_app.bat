@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title The Magic Wishing Well - TikTok Live Interactive

echo =========================================================
echo   STARTING THE MAGIC WISHING WELL TIKTOK LIVE
echo =========================================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on your system!
    echo Please visit https://nodejs.org to download and install Node.js first.
    echo.
    pause
    exit /b
)

:: Auto install packages if node_modules is missing
if not exist "node_modules\" (
    echo [*] Installing required npm packages...
    call npm install
    echo [+] Packages installed successfully!
    echo.
)

:: 2. Release port 3000 if occupied
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. URLs
echo [*] Live Overlay (OBS / TikTok Live Studio): http://localhost:3000/index.html
echo [*] Admin Controller Panel:                  http://localhost:3000/admin.html
echo.
echo [*] Starting server and opening browser...

:: 4. Launch browser after 2 seconds
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/admin.html & start http://localhost:3000/index.html"

:: 5. Start Node Server
echo.
echo =========================================================
echo   SERVER IS LIVE. KEEP THIS WINDOW OPEN WHILE STREAMING.
echo   Press Ctrl+C or close this window to stop server.
echo =========================================================
echo.
node server.js
echo.
pause >nul
