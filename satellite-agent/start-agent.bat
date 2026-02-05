@echo off
echo Starting Satellite Agent...
echo.
echo Connecting to: ws://localhost:3000/ws/agent
echo Agent name: %COMPUTERNAME%-agent
echo.
go run . --server ws://localhost:3000/ws/agent --name "%COMPUTERNAME%-agent"
