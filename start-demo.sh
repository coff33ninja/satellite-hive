#!/bin/bash

# Satellite Hive Demo Startup Script

echo "🛰️  Starting Satellite Hive Demo..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+ first."
    exit 1
fi

echo "${BLUE}Step 1: Setting up Central Server${NC}"
cd central-server

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

if [ ! -f "data/hive.db" ]; then
    echo "Initializing database..."
    npm run db:migrate
fi

echo ""
echo "${GREEN}✅ Central Server ready${NC}"
echo ""

echo "${BLUE}Step 2: Starting Central Server${NC}"
npm run dev &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

echo ""
echo "${GREEN}✅ Central Server running on http://localhost:3000${NC}"
echo ""

echo "${BLUE}Step 3: Setting up Satellite Agent${NC}"
cd ../satellite-agent

if [ ! -d "vendor" ]; then
    echo "Downloading Go dependencies..."
    go mod download
fi

echo ""
echo "${GREEN}✅ Agent ready${NC}"
echo ""

echo "${BLUE}Step 4: Starting Satellite Agent${NC}"
go run . --server ws://localhost:3000/ws/agent --name "demo-agent" &
AGENT_PID=$!
echo "Agent PID: $AGENT_PID"

sleep 3

echo ""
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${GREEN}✅ Satellite Hive is running!${NC}"
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "${YELLOW}📊 Web UI:${NC}      http://localhost:3000"
echo "${YELLOW}🔑 Login:${NC}       admin@example.com / admin123"
echo "${YELLOW}📡 API:${NC}         http://localhost:3000/api/v1"
echo "${YELLOW}🔌 WebSocket:${NC}   ws://localhost:3000/ws/agent"
echo ""
echo "${YELLOW}Server PID:${NC}     $SERVER_PID"
echo "${YELLOW}Agent PID:${NC}      $AGENT_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap Ctrl+C and cleanup
trap cleanup INT

cleanup() {
    echo ""
    echo "${YELLOW}Stopping services...${NC}"
    kill $SERVER_PID 2>/dev/null
    kill $AGENT_PID 2>/dev/null
    echo "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Wait for processes
wait
