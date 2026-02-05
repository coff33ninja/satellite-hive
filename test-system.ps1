# Satellite Hive System Test Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Satellite Hive System Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Go installation
Write-Host "[1/5] Checking Go installation..." -ForegroundColor Yellow
try {
    $goVersion = go version 2>&1
    Write-Host "✓ $goVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Go not found. Please restart your terminal after installing Go." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Server health
Write-Host "[2/5] Checking server health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
    Write-Host "✓ Server is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Server not responding. Is it running?" -ForegroundColor Red
    Write-Host "  Start it with: cd central-server && npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 3: Login API
Write-Host "[3/5] Testing login API..." -ForegroundColor Yellow
try {
    $body = @{
        email = "admin@example.com"
        password = "admin123"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.success) {
        Write-Host "✓ Login successful! Token received." -ForegroundColor Green
        $token = $response.data.token
    } else {
        Write-Host "✗ Login failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Login API error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 4: Web UI
Write-Host "[4/5] Checking web UI..." -ForegroundColor Yellow
try {
    $webUI = Invoke-WebRequest -Uri "http://localhost:3000/" -Method Get
    if ($webUI.Content -match "Satellite Hive") {
        Write-Host "✓ Web UI is accessible!" -ForegroundColor Green
    } else {
        Write-Host "✗ Web UI loaded but content unexpected" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Web UI not loading: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 5: Go dependencies
Write-Host "[5/5] Installing Go dependencies for agent..." -ForegroundColor Yellow
try {
    Push-Location satellite-agent
    go mod download
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Go dependencies installed!" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to download Go dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
} catch {
    Write-Host "✗ Error installing Go dependencies: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ All checks passed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Keep the server running in this terminal" -ForegroundColor White
Write-Host "2. Open a NEW terminal and run:" -ForegroundColor White
Write-Host "   cd satellite-agent" -ForegroundColor Cyan
Write-Host "   go run . --server ws://localhost:3000/ws/agent --name `"test-agent`"" -ForegroundColor Cyan
Write-Host "3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "4. Login with: admin@example.com / admin123" -ForegroundColor White
Write-Host ""
Write-Host "Your JWT token for API testing:" -ForegroundColor Yellow
Write-Host $token -ForegroundColor Gray
Write-Host ""
