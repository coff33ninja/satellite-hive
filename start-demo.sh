#!/bin/bash

# Satellite Hive Demo Startup Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🛰️  Starting Satellite Hive Demo${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+ first.${NC}"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed. Please install Go 1.21+ first.${NC}"
    echo ""
    
    # Detect platform
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    if [ "$OS" = "Darwin" ]; then
        if [ "$ARCH" = "arm64" ]; then
            GO_URL="https://go.dev/dl/go1.23.7.darwin-arm64.pkg"
            GO_FILE="go1.23.7.darwin-arm64.pkg"
            PLATFORM="macOS (ARM64/Apple Silicon)"
        else
            GO_URL="https://go.dev/dl/go1.23.7.darwin-amd64.pkg"
            GO_FILE="go1.23.7.darwin-amd64.pkg"
            PLATFORM="macOS (AMD64/Intel)"
        fi
        INSTALL_CMD="pkg"
    elif [ "$OS" = "Linux" ]; then
        GO_URL="https://go.dev/dl/go1.23.7.linux-amd64.tar.gz"
        GO_FILE="go1.23.7.linux-amd64.tar.gz"
        PLATFORM="Linux (AMD64)"
        INSTALL_CMD="tar.gz"
    else
        echo "Unsupported platform: $OS"
        echo "Please download Go manually from: https://go.dev/dl/"
        exit 1
    fi
    
    echo "Would you like to download and install Go now?"
    echo "This will download Go 1.23.7 for $PLATFORM"
    echo ""
    read -p "Download Go installer? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Download from: https://go.dev/dl/"
        exit 1
    fi
    
    echo ""
    echo -e "${CYAN}Downloading Go installer...${NC}"
    
    if command -v curl &> /dev/null; then
        curl -L -o "/tmp/$GO_FILE" "$GO_URL"
    elif command -v wget &> /dev/null; then
        wget -O "/tmp/$GO_FILE" "$GO_URL"
    else
        echo -e "${RED}Neither curl nor wget found. Cannot download Go.${NC}"
        echo "Please download manually from: https://go.dev/dl/"
        exit 1
    fi
    
    if [ -f "/tmp/$GO_FILE" ]; then
        echo -e "${GREEN}[OK] Go installer downloaded${NC}"
        echo ""
        
        if [ "$INSTALL_CMD" = "tar.gz" ]; then
            # Linux installation
            echo -e "${CYAN}Installing Go...${NC}"
            echo "This requires sudo privileges to install to /usr/local"
            sudo rm -rf /usr/local/go
            sudo tar -C /usr/local -xzf "/tmp/$GO_FILE"
            
            # Add to PATH if not already there
            if ! grep -q "/usr/local/go/bin" ~/.profile 2>/dev/null; then
                echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
                echo "Added Go to PATH in ~/.profile"
            fi
            
            echo -e "${GREEN}Go installation complete!${NC}"
            echo ""
            echo -e "${YELLOW}Please run: source ~/.profile${NC}"
            echo -e "${YELLOW}Then run this script again.${NC}"
            exit 0
        else
            # macOS installation
            echo -e "${CYAN}Launching Go installer...${NC}"
            echo "Please complete the installation, then run this script again."
            sudo installer -pkg "/tmp/$GO_FILE" -target /
            
            echo -e "${GREEN}Go installation complete!${NC}"
            echo ""
            echo -e "${YELLOW}Please restart your terminal and run this script again.${NC}"
            exit 0
        fi
    else
        echo -e "${RED}Failed to download Go installer${NC}"
        echo "Please download manually from: https://go.dev/dl/"
        exit 1
    fi
fi

echo -e "${CYAN}[INFO] Node.js version: $(node --version)${NC}"
echo -e "${CYAN}[INFO] Go version: $(go version | awk '{print $3}')${NC}"
echo ""

# Check if dependencies are installed
NEED_INSTALL=0

if [ ! -d "central-server/node_modules" ]; then
    echo -e "${YELLOW}[WARNING] Central server dependencies not found${NC}"
    NEED_INSTALL=1
fi

if [ ! -d "web-ui/node_modules" ]; then
    echo -e "${YELLOW}[WARNING] Web UI dependencies not found${NC}"
    NEED_INSTALL=1
fi

if [ ! -f "satellite-agent/go.sum" ]; then
    echo -e "${YELLOW}[WARNING] Satellite agent dependencies not found${NC}"
    NEED_INSTALL=1
fi

if [ $NEED_INSTALL -eq 1 ]; then
    echo ""
    echo "Dependencies are missing. Would you like to install them now?"
    echo "This will run: ./install-dependencies.sh"
    echo ""
    read -p "Install dependencies? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${RED}[ERROR] Cannot start without dependencies. Please run: ./install-dependencies.sh${NC}"
        exit 1
    fi
    echo ""
    echo "Installing dependencies..."
    ./install-dependencies.sh
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}[ERROR] Failed to install dependencies${NC}"
        exit 1
    fi
    echo ""
fi

echo -e "${BLUE}Step 1: Setting up Central Server${NC}"
cd central-server

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

echo -e "${BLUE}Step 3: Setting up Satellite Agent${NC}"
cd ../satellite-agent

echo ""
echo -e "${GREEN}✅ Agent ready${NC}"
echo ""

echo -e "${BLUE}Step 4: Starting Satellite Agent${NC}"
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
