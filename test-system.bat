@echo off
echo ========================================
echo Satellite Hive System Test
echo ========================================
echo.

echo [1/5] Checking Go installation...
go version
if %errorlevel% neq 0 (
    echo ERROR: Go not found. Please restart your terminal after installing Go.
    exit /b 1
)
echo.

echo [2/5] Checking server health...
curl -s http://localhost:3000/health
if %errorlevel% neq 0 (
    echo ERROR: Server not responding. Is it running?
    exit /b 1
)
echo.
echo.

echo [3/5] Testing login API...
curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"
echo.
echo.

echo [4/5] Checking web UI...
curl -s http://localhost:3000/ | findstr "Satellite Hive"
if %errorlevel% neq 0 (
    echo ERROR: Web UI not loading properly
    exit /b 1
)
echo Web UI is accessible!
echo.

echo [5/5] Installing Go dependencies for agent...
cd satellite-agent
go mod download
if %errorlevel% neq 0 (
    echo ERROR: Failed to download Go dependencies
    exit /b 1
)
echo.

echo ========================================
echo All checks passed!
echo ========================================
echo.
echo Next steps:
echo 1. Keep the server running in one terminal
echo 2. In a new terminal, run: cd satellite-agent
echo 3. Then run: go run . --server ws://localhost:3000/ws/agent --name "test-agent"
echo 4. Open http://localhost:3000 in your browser
echo.
