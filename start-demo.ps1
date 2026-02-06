# Satellite Hive Demo Startup Script for Windows (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🛰️  Starting Satellite Hive Demo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
}

# Check if Node.js is installed
if (-not (Test-Command "node")) {
    Write-Host "[ERROR] Node.js is not installed. Please install Node.js 20+ first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if Go is installed
if (-not (Test-Command "go")) {
    Write-Host "[ERROR] Go is not installed. Please install Go 1.21+ first." -ForegroundColor Red
    Write-Host ""
    Write-Host "Would you like to download and install Go now?" -ForegroundColor Yellow
    Write-Host "This will download Go 1.23.7 for Windows (AMD64)" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Download Go installer? (y/n)"
    
    if ($response -match '^[Yy]') {
        $goUrl = "https://go.dev/dl/go1.23.7.windows-amd64.msi"
        $goInstaller = "$env:TEMP\go1.23.7.windows-amd64.msi"
        
        Write-Host ""
        Write-Host "Downloading Go installer..." -ForegroundColor Cyan
        try {
            Invoke-WebRequest -Uri $goUrl -OutFile $goInstaller -UseBasicParsing
            Write-Host "[OK] Go installer downloaded" -ForegroundColor Green
            Write-Host ""
            Write-Host "Launching Go installer..." -ForegroundColor Cyan
            Write-Host "Please complete the installation, then run this script again." -ForegroundColor Yellow
            Start-Process -FilePath $goInstaller -Wait
            Write-Host ""
            Write-Host "Go installation complete!" -ForegroundColor Green
            Write-Host "Please restart your terminal and run this script again." -ForegroundColor Yellow
            exit 0
        }
        catch {
            Write-Host "[ERROR] Failed to download Go installer: $_" -ForegroundColor Red
            Write-Host "Please download manually from: https://go.dev/dl/" -ForegroundColor Yellow
            exit 1
        }
    }
    else {
        Write-Host "Download from: https://go.dev/dl/" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[INFO] Node.js version: $(node --version)" -ForegroundColor Cyan
Write-Host "[INFO] Go version: $(go version)" -ForegroundColor Cyan
Write-Host ""

# Check if dependencies are installed
$needInstall = $false

if (-not (Test-Path "central-server\node_modules")) {
    Write-Host "[WARNING] Central server dependencies not found" -ForegroundColor Yellow
    $needInstall = $true
}

if (-not (Test-Path "web-ui\node_modules")) {
    Write-Host "[WARNING] Web UI dependencies not found" -ForegroundColor Yellow
    $needInstall = $true
}

if (-not (Test-Path "satellite-agent\go.sum")) {
    Write-Host "[WARNING] Satellite agent dependencies not found" -ForegroundColor Yellow
    $needInstall = $true
}

if ($needInstall) {
    Write-Host ""
    Write-Host "Dependencies are missing. Would you like to install them now?" -ForegroundColor Yellow
    Write-Host "This will run: .\install-dependencies.ps1" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Install dependencies? (y/n)"
    
    if ($response -notmatch '^[Yy]') {
        Write-Host ""
        Write-Host "[ERROR] Cannot start without dependencies. Please run: .\install-dependencies.ps1" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & ".\install-dependencies.ps1"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

Write-Host "Step 1: Setting up Central Server" -ForegroundColor Blue
Set-Location "central-server"

if (-not (Test-Path "data\hive.db")) {
    Write-Host "Initializing database..." -ForegroundColor Cyan
    npm run db:migrate
}

Write-Host ""
Write-Host "✅ Central Server ready" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Starting Central Server" -ForegroundColor Blue
$serverJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm run dev" -PassThru -WindowStyle Normal
Write-Host "Server PID: $($serverJob.Id)" -ForegroundColor Cyan

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ Central Server running on http://localhost:3000" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Setting up Satellite Agent" -ForegroundColor Blue
Set-Location "..\satellite-agent"

Write-Host ""
Write-Host "✅ Agent ready" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Starting Satellite Agent" -ForegroundColor Blue
$agentJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "go run . --server ws://localhost:3000/ws/agent --name demo-agent" -PassThru -WindowStyle Normal
Write-Host "Agent PID: $($agentJob.Id)" -ForegroundColor Cyan

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Satellite Hive is running!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Web UI:      http://localhost:3000" -ForegroundColor Yellow
Write-Host "🔑 Login:       admin@example.com / admin123" -ForegroundColor Yellow
Write-Host "📡 API:         http://localhost:3000/api/v1" -ForegroundColor Yellow
Write-Host "🔌 WebSocket:   ws://localhost:3000/ws/agent" -ForegroundColor Yellow
Write-Host ""
Write-Host "Server PID:     $($serverJob.Id)" -ForegroundColor Cyan
Write-Host "Agent PID:      $($agentJob.Id)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to stop all services..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Stopping services..." -ForegroundColor Yellow

# Stop the processes
try {
    Stop-Process -Id $serverJob.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $agentJob.Id -Force -ErrorAction SilentlyContinue
    
    # Also kill any child processes
    Get-Process | Where-Object { $_.ProcessName -eq "node" -or $_.ProcessName -eq "go" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
catch {
    # Ignore errors
}

Write-Host "✅ All services stopped" -ForegroundColor Green
Write-Host ""

# Return to original directory
Set-Location ".."
