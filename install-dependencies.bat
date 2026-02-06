@echo off
REM Satellite Hive - Dependency Installation Script
REM Batch version for Windows
REM Run this script to install all dependencies for the project

setlocal enabledelayedexpansion

echo ========================================
echo Satellite Hive - Dependency Installer
echo ========================================
echo.

REM Check prerequisites
echo ==== Checking Prerequisites ====
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: 20.x LTS
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    echo npm should come with Node.js. Please reinstall Node.js.
    exit /b 1
)

where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Go is not installed!
    echo Go is required for the satellite agent.
    echo.
    echo Would you like to download and install Go now?
    echo This will download Go 1.23.7 for Windows ^(AMD64^)
    echo.
    choice /C YN /M "Download Go installer"
    if errorlevel 2 (
        echo.
        echo Continuing with Node.js components only...
        echo To install Go later, download from: https://go.dev/dl/
        set HAS_GO=0
    ) else (
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
            set HAS_GO=0
        )
    )
) else (
    set HAS_GO=1
)

REM Display versions
echo Node.js version:
node --version
echo npm version:
npm --version
if !HAS_GO! EQU 1 (
    echo Go version:
    go version
)
echo.

REM Install Central Server dependencies
echo ==== Installing Central Server Dependencies ====
echo.

cd central-server
if not exist package.json (
    echo [ERROR] package.json not found in central-server/
    cd ..
    exit /b 1
)

echo Running npm install in central-server...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install central server dependencies
    cd ..
    exit /b 1
)
echo [OK] Central server dependencies installed successfully
cd ..

REM Install Web UI dependencies
echo.
echo ==== Installing Web UI Dependencies ====
echo.

cd web-ui
if not exist package.json (
    echo [ERROR] package.json not found in web-ui/
    cd ..
    exit /b 1
)

echo Running npm install in web-ui...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install web UI dependencies
    cd ..
    exit /b 1
)
echo [OK] Web UI dependencies installed successfully
cd ..

REM Install Satellite Agent dependencies (Go modules)
if !HAS_GO! EQU 1 (
    echo.
    echo ==== Installing Satellite Agent Dependencies ====
    echo.
    
    cd satellite-agent
    if not exist go.mod (
        echo [ERROR] go.mod not found in satellite-agent/
        cd ..
        exit /b 1
    )
    
    echo Running go mod download...
    go mod download
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to download Go modules
        cd ..
        exit /b 1
    )
    
    echo Running go mod tidy...
    go mod tidy
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to tidy Go modules
        cd ..
        exit /b 1
    )
    echo [OK] Satellite agent dependencies installed successfully
    cd ..
) else (
    echo.
    echo ==== Skipping Satellite Agent Dependencies ====
    echo [WARNING] Go is not installed, skipping agent dependencies
)

REM Summary
echo.
echo ==== Installation Summary ====
echo [OK] Central Server: Dependencies installed
echo [OK] Web UI: Dependencies installed
if !HAS_GO! EQU 1 (
    echo [OK] Satellite Agent: Dependencies installed
) else (
    echo [WARNING] Satellite Agent: Skipped ^(Go not installed^)
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure central-server/server.yaml
echo 2. Start the central server: cd central-server ^&^& npm run dev
echo 3. Start the web UI ^(optional^): cd web-ui ^&^& npm run dev
if !HAS_GO! EQU 1 (
    echo 4. Build the agent: cd satellite-agent ^&^& go build
    echo 5. Run the agent: satellite-agent.exe --server ws://localhost:3000/ws/agent --name my-agent
) else (
    echo 4. Install Go to build the satellite agent
)
echo.

endlocal
