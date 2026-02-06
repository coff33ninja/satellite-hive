@echo off
REM Satellite Hive Demo Startup Script for Windows

echo.
echo ========================================
echo Starting Satellite Hive Demo
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 20+ first.
    echo Download from: https://nodejs.org/
    exit /b 1
)

REM Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Go is not installed. Please install Go 1.21+ first.
    echo.
    echo Would you like to download and install Go now?
    echo This will download Go 1.23.7 for Windows ^(AMD64^)
    echo.
    choice /C YN /M "Download Go installer"
    if errorlevel 2 (
        echo Download from: https://go.dev/dl/
        exit /b 1
    )
    
    echo.
    echo Downloading Go installer...
    set GO_URL=https://go.dev/dl/go1.23.7.windows-amd64.msi
    set GO_INSTALLER=%TEMP%\go1.23.7.windows-amd64.msi
    
    powershell -Command "Invoke-WebRequest -Uri '%GO_URL%' -OutFile '%GO_INSTALLER%' -UseBasicParsing"
    
    if exist "%GO_INSTALLER%" (
        echo [OK] Go installer downloaded
        echo.
        echo Launching Go installer...
        echo Please complete the installation, then run this script again.
        start /wait msiexec /i "%GO_INSTALLER%" /qb
        echo.
        echo Go installation complete!
        echo Please restart your terminal and run this script again.
        exit /b 0
    ) else (
        echo [ERROR] Failed to download Go installer
        echo Please download manually from: https://go.dev/dl/
        exit /b 1
    )
)

echo [INFO] Node.js version: 
node --version
echo [INFO] Go version:
go version
echo.

REM Check if dependencies are installed
set NEED_INSTALL=0

if not exist "central-server\node_modules" (
    echo [WARNING] Central server dependencies not found
    set NEED_INSTALL=1
)

if not exist "web-ui\node_modules" (
    echo [WARNING] Web UI dependencies not found
    set NEED_INSTALL=1
)

if not exist "satellite-agent\go.sum" (
    echo [WARNING] Satellite agent dependencies not found
    set NEED_INSTALL=1
)

if %NEED_INSTALL% EQU 1 (
    echo.
    echo Dependencies are missing. Would you like to install them now?
    echo This will run: install-dependencies.bat
    echo.
    choice /C YN /M "Install dependencies"
    if errorlevel 2 (
        echo.
        echo [ERROR] Cannot start without dependencies. Please run: install-dependencies.bat
        exit /b 1
    )
    echo.
    echo Installing dependencies...
    call install-dependencies.bat
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install dependencies
        exit /b 1
    )
    echo.
)

echo Step 1: Setting up Central Server
cd central-server

if not exist "data\hive.db" (
    echo Initializing database...
    call npm run db:migrate
)

echo.
echo Central Server ready
echo.

echo Step 2: Starting Central Server
start "Satellite Hive Server" cmd /k npm run dev

timeout /t 5 /nobreak >nul

echo.
echo Central Server running on http://localhost:3000
echo.

echo Step 3: Setting up Satellite Agent
cd ..\satellite-agent

echo.
echo Agent ready
echo.

echo Step 4: Starting Satellite Agent
start "Satellite Agent" cmd /k go run . --server ws://localhost:3000/ws/agent --name "demo-agent"

timeout /t 3 /nobreak >nul

echo.
echo ================================================================
echo Satellite Hive is running!
echo ================================================================
echo.
echo Web UI:      http://localhost:3000
echo Login:       admin@example.com / admin123
echo API:         http://localhost:3000/api/v1
echo WebSocket:   ws://localhost:3000/ws/agent
echo.
echo Press any key to stop all services...
pause >nul

taskkill /FI "WindowTitle eq Satellite Hive Server*" /T /F >nul 2>nul
taskkill /FI "WindowTitle eq Satellite Agent*" /T /F >nul 2>nul

echo.
echo All services stopped
