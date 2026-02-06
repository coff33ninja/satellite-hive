#!/bin/bash
# Satellite Hive - Dependency Installation Script
# Bash version for Linux/macOS
# Run this script to install all dependencies for the project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print section header
print_section() {
    echo ""
    echo -e "${YELLOW}==== $1 ====${NC}"
    echo ""
}

# Function to print success message
print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

# Function to print error message
print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Function to print warning message
print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Satellite Hive - Dependency Installer${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

START_DIR=$(pwd)

# Check prerequisites
print_section "Checking Prerequisites"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Recommended version: 20.x LTS"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed!"
    echo "npm should come with Node.js. Please reinstall Node.js."
    exit 1
fi

HAS_GO=1
if ! command -v go &> /dev/null; then
    print_warning "Go is not installed!"
    echo "Go is required for the satellite agent."
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
        INSTALL_CMD="sudo installer -pkg"
    elif [ "$OS" = "Linux" ]; then
        GO_URL="https://go.dev/dl/go1.23.7.linux-amd64.tar.gz"
        GO_FILE="go1.23.7.linux-amd64.tar.gz"
        PLATFORM="Linux (AMD64)"
        INSTALL_CMD="tar.gz"
    else
        print_error "Unsupported platform: $OS"
        echo "Please download Go manually from: https://go.dev/dl/"
        echo ""
        echo "Continuing with Node.js components only..."
        HAS_GO=0
    fi
    
    if [ $HAS_GO -eq 1 ]; then
        echo "Would you like to download and install Go now?"
        echo "This will download Go 1.23.7 for $PLATFORM"
        echo ""
        read -p "Download Go installer? (y/n) " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${CYAN}Downloading Go installer...${NC}"
            
            if command -v curl &> /dev/null; then
                curl -L -o "/tmp/$GO_FILE" "$GO_URL"
            elif command -v wget &> /dev/null; then
                wget -O "/tmp/$GO_FILE" "$GO_URL"
            else
                print_error "Neither curl nor wget found. Cannot download Go."
                echo "Please download manually from: https://go.dev/dl/"
                HAS_GO=0
            fi
            
            if [ -f "/tmp/$GO_FILE" ]; then
                print_success "Go installer downloaded to: /tmp/$GO_FILE"
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
                    
                    print_success "Go installation complete!"
                    echo ""
                    echo -e "${YELLOW}Please run: source ~/.profile${NC}"
                    echo -e "${YELLOW}Then run this script again.${NC}"
                    exit 0
                else
                    # macOS installation
                    echo -e "${CYAN}Launching Go installer...${NC}"
                    echo "Please complete the installation, then run this script again."
                    sudo installer -pkg "/tmp/$GO_FILE" -target /
                    
                    print_success "Go installation complete!"
                    echo ""
                    echo -e "${YELLOW}Please restart your terminal and run this script again.${NC}"
                    exit 0
                fi
            else
                print_error "Failed to download Go installer"
                echo "Please download manually from: https://go.dev/dl/"
                HAS_GO=0
            fi
        else
            echo ""
            echo "Continuing with Node.js components only..."
            echo "To install Go later, download from: https://go.dev/dl/"
            HAS_GO=0
        fi
    fi
fi

# Display versions
echo -e "${CYAN}Node.js version: $(node --version)${NC}"
echo -e "${CYAN}npm version: $(npm --version)${NC}"
if [ $HAS_GO -eq 1 ]; then
    echo -e "${CYAN}Go version: $(go version)${NC}"
fi

# Install Central Server dependencies
print_section "Installing Central Server Dependencies"

cd "$START_DIR/central-server" || exit 1

if [ ! -f "package.json" ]; then
    print_error "package.json not found in central-server/"
    exit 1
fi

echo -e "${CYAN}Running npm install in central-server...${NC}"
npm install

if [ $? -eq 0 ]; then
    print_success "Central server dependencies installed successfully"
else
    print_error "Failed to install central server dependencies"
    exit 1
fi

# Install Web UI dependencies
print_section "Installing Web UI Dependencies"

cd "$START_DIR/web-ui" || exit 1

if [ ! -f "package.json" ]; then
    print_error "package.json not found in web-ui/"
    exit 1
fi

echo -e "${CYAN}Running npm install in web-ui...${NC}"
npm install

if [ $? -eq 0 ]; then
    print_success "Web UI dependencies installed successfully"
else
    print_error "Failed to install web UI dependencies"
    exit 1
fi

# Build Web UI
print_section "Building Web UI"

cd "$START_DIR/web-ui" || exit 1

echo -e "${CYAN}Running npm run build in web-ui...${NC}"
npm run build

if [ $? -eq 0 ]; then
    print_success "Web UI built successfully"
else
    print_error "Failed to build web UI"
    exit 1
fi

# Install Satellite Agent dependencies (Go modules)
if [ $HAS_GO -eq 1 ]; then
    print_section "Installing Satellite Agent Dependencies"
    
    cd "$START_DIR/satellite-agent" || exit 1
    
    if [ ! -f "go.mod" ]; then
        print_error "go.mod not found in satellite-agent/"
        exit 1
    fi
    
    echo -e "${CYAN}Running go mod download...${NC}"
    go mod download
    
    if [ $? -eq 0 ]; then
        echo -e "${CYAN}Running go mod tidy...${NC}"
        go mod tidy
        
        if [ $? -eq 0 ]; then
            print_success "Satellite agent dependencies installed successfully"
        else
            print_error "Failed to tidy Go modules"
            exit 1
        fi
    else
        print_error "Failed to download Go modules"
        exit 1
    fi
else
    print_section "Skipping Satellite Agent Dependencies"
    print_warning "Go is not installed, skipping agent dependencies"
fi

# Return to start directory
cd "$START_DIR" || exit 1

# Summary
print_section "Installation Summary"
print_success "Central Server: Dependencies installed"
print_success "Web UI: Dependencies installed and built"
if [ $HAS_GO -eq 1 ]; then
    print_success "Satellite Agent: Dependencies installed"
else
    print_warning "Satellite Agent: Skipped (Go not installed)"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Configure central-server/server.yaml"
echo "2. Start the central server: cd central-server && npm run dev"
echo "3. Start the web UI (optional): cd web-ui && npm run dev"
if [ $HAS_GO -eq 1 ]; then
    echo "4. Build the agent: cd satellite-agent && go build"
    echo "5. Run the agent: ./satellite-agent --server ws://localhost:3000/ws/agent --name my-agent"
else
    echo "4. Install Go to build the satellite agent"
fi
echo ""
