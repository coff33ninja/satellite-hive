# Satellite Hive - Dependency Installation Script
# PowerShell version for Windows
# Run this script to install all dependencies for the project

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Satellite Hive - Dependency Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$startLocation = Get-Location

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

# Function to print section header
function Write-Section {
    param($Title)
    Write-Host ""
    Write-Host "==== $Title ====" -ForegroundColor Yellow
    Write-Host ""
}

# Function to print success message
function Write-Success {
    param($Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

# Function to print error message
function Write-Error-Message {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to print warning message
function Write-Warning-Message {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Check prerequisites
Write-Section "Checking Prerequisites"

$hasNode = Test-Command "node"
$hasNpm = Test-Command "npm"
$hasGo = Test-Command "go"

if (-not $hasNode) {
    Write-Error-Message "Node.js is not installed!"
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Recommended version: 20.x LTS" -ForegroundColor Yellow
    exit 1
}

if (-not $hasNpm) {
    Write-Error-Message "npm is not installed!"
    Write-Host "npm should come with Node.js. Please reinstall Node.js." -ForegroundColor Yellow
    exit 1
}

if (-not $hasGo) {
    Write-Warning-Message "Go is not installed!"
    Write-Host "Go is required for the satellite agent." -ForegroundColor Yellow
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
            Write-Success "Go installer downloaded to: $goInstaller"
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
            Write-Error-Message "Failed to download Go installer: $_"
            Write-Host "Please download manually from: https://go.dev/dl/" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host ""
        Write-Host "Continuing with Node.js components only..." -ForegroundColor Yellow
        Write-Host "To install Go later, download from: https://go.dev/dl/" -ForegroundColor Yellow
    }
}

# Display versions
Write-Host "Node.js version: $(node --version)" -ForegroundColor Cyan
Write-Host "npm version: $(npm --version)" -ForegroundColor Cyan
if ($hasGo) {
    Write-Host "Go version: $(go version)" -ForegroundColor Cyan
}

# Install Central Server dependencies
Write-Section "Installing Central Server Dependencies"
try {
    Set-Location "$startLocation\central-server"
    
    if (-not (Test-Path "package.json")) {
        Write-Error-Message "package.json not found in central-server/"
        throw "Missing package.json"
    }
    
    Write-Host "Running npm install in central-server..." -ForegroundColor Cyan
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Central server dependencies installed successfully"
    } else {
        throw "npm install failed"
    }
}
catch {
    Write-Error-Message "Failed to install central server dependencies: $_"
    Set-Location $startLocation
    exit 1
}

# Install Web UI dependencies
Write-Section "Installing Web UI Dependencies"
try {
    Set-Location "$startLocation\web-ui"
    
    if (-not (Test-Path "package.json")) {
        Write-Error-Message "package.json not found in web-ui/"
        throw "Missing package.json"
    }
    
    Write-Host "Running npm install in web-ui..." -ForegroundColor Cyan
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Web UI dependencies installed successfully"
    } else {
        throw "npm install failed"
    }
}
catch {
    Write-Error-Message "Failed to install web UI dependencies: $_"
    Set-Location $startLocation
    exit 1
}

# Build Web UI
Write-Section "Building Web UI"
try {
    Set-Location "$startLocation\web-ui"
    
    Write-Host "Running npm run build in web-ui..." -ForegroundColor Cyan
    npm run build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Web UI built successfully"
    } else {
        throw "npm run build failed"
    }
}
catch {
    Write-Error-Message "Failed to build web UI: $_"
    Set-Location $startLocation
    exit 1
}

# Install Satellite Agent dependencies (Go modules)
if ($hasGo) {
    Write-Section "Installing Satellite Agent Dependencies"
    try {
        Set-Location "$startLocation\satellite-agent"
        
        if (-not (Test-Path "go.mod")) {
            Write-Error-Message "go.mod not found in satellite-agent/"
            throw "Missing go.mod"
        }
        
        Write-Host "Running go mod download..." -ForegroundColor Cyan
        go mod download
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Running go mod tidy..." -ForegroundColor Cyan
            go mod tidy
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Satellite agent dependencies installed successfully"
            } else {
                throw "go mod tidy failed"
            }
        } else {
            throw "go mod download failed"
        }
    }
    catch {
        Write-Error-Message "Failed to install satellite agent dependencies: $_"
        Set-Location $startLocation
        exit 1
    }
} else {
    Write-Section "Skipping Satellite Agent Dependencies"
    Write-Warning-Message "Go is not installed, skipping agent dependencies"
}

# Return to start location
Set-Location $startLocation

# Summary
Write-Section "Installation Summary"
Write-Success "Central Server: Dependencies installed"
Write-Success "Web UI: Dependencies installed and built"
if ($hasGo) {
    Write-Success "Satellite Agent: Dependencies installed"
} else {
    Write-Warning-Message "Satellite Agent: Skipped (Go not installed)"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure central-server/server.yaml" -ForegroundColor White
Write-Host "2. Start the central server: cd central-server && npm run dev" -ForegroundColor White
Write-Host "3. Start the web UI (optional): cd web-ui && npm run dev" -ForegroundColor White
if ($hasGo) {
    Write-Host "4. Build the agent: cd satellite-agent && go build" -ForegroundColor White
    Write-Host "5. Run the agent: .\satellite-agent.exe --server ws://localhost:3000/ws/agent --name my-agent" -ForegroundColor White
} else {
    Write-Host "4. Install Go to build the satellite agent" -ForegroundColor White
}
Write-Host ""
