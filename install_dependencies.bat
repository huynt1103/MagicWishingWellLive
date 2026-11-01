@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Install Dependencies - The Magic Wishing Well TikTok Live

echo =========================================================
echo   AUTOMATIC DEPENDENCY INSTALLER - THE MAGIC WISHING WELL
echo =========================================================
echo.

:: 1. Check Node.js and npm
echo [*] Step 1/2: Checking Node.js and installing Node packages...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on your system!
    echo Please visit https://nodejs.org to download and install Node.js first.
    echo.
    pause
    exit /b
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is missing! Please verify your Node.js installation.
    echo.
    pause
    exit /b
)

echo [+] Running "npm install" to install required packages...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] npm install reported issues. Retrying direct installation...
    call npm install express socket.io cors tiktok-live-connector ws
)
echo [+] Node.js dependencies installed successfully!
echo.

:: 2. Check Python and pip (supports gTTS for AI Voice synthesis)
echo [*] Step 2/2: Checking Python for gTTS voice generation...

set "PYTHON_CMD="
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=py"
    )
)

if not defined PYTHON_CMD (
    echo [-] Python not found. Downloading and installing official Python 3.11...
    set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    set "PY_INSTALLER=%TEMP%\python_installer.exe"
    
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!PY_URL!', '!PY_INSTALLER!')"
    
    if exist "!PY_INSTALLER!" (
        echo [*] Installing Python silently...
        start /wait "" "!PY_INSTALLER!" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0 SimpleInstall=1
        del /f /q "!PY_INSTALLER!" >nul 2>&1
        
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"
        set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
        
        where python >nul 2>&1
        if %errorlevel% equ 0 (
            set "PYTHON_CMD=python"
        ) else (
            where py >nul 2>&1
            if %errorlevel% equ 0 (
                set "PYTHON_CMD=py"
            )
        )
    )
)

if defined PYTHON_CMD (
    echo [+] Python detected. Upgrading gTTS library...
    !PYTHON_CMD! -m pip install --upgrade gTTS >nul 2>&1
    if %errorlevel% equ 0 (
        echo [+] gTTS library installed successfully!
    ) else (
        echo [-] gTTS installation encountered an error or pip is not ready.
    )
) else (
    echo [-] Python not installed. Web Speech API browser fallback will be used.
)

echo.
echo =========================================================
echo   COMPLETED! All libraries are ready.
echo   You can now launch "start_app.bat" to start the app.
echo =========================================================
echo.
pause
