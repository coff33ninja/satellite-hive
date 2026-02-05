# Start Satellite Agent
Write-Host "🛰️  Starting Satellite Agent..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: ws://localhost:3000/ws/agent" -ForegroundColor Yellow
Write-Host "Agent name: $env:COMPUTERNAME-agent" -ForegroundColor Yellow
Write-Host ""

go run . --server ws://localhost:3000/ws/agent --name "$env:COMPUTERNAME-agent"
