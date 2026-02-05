@echo off
REM Satellite Hive Demo Startup Script for Windows

echo.
echo Starting Satellite Hive Demo...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js 20+ first.
    exit /b 1
)

REM Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Go is not installed. Please install Go 1.21+ first.
    exit /b 1
)

echo Step 1: Setting up Central Server
cd central-server

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

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

echo Downloading Go dependencies...
go mod download

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
