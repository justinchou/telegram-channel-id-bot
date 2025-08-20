#!/bin/bash

# PM2 Setup Script for Telegram Chat ID Bot
# This script installs and configures PM2 for the project

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    local node_version
    node_version=$(node --version | sed 's/v//')
    local major_version
    major_version=$(echo "$node_version" | cut -d. -f1)
    
    if [ "$major_version" -lt 18 ]; then
        error "Node.js version 18 or higher is required. Current version: $node_version"
        exit 1
    fi
    
    log "Node.js version check passed: $node_version"
}

# Install PM2
install_pm2() {
    if command -v pm2 &> /dev/null; then
        local pm2_version
        pm2_version=$(pm2 --version)
        log "PM2 is already installed: $pm2_version"
        return 0
    fi
    
    log "Installing PM2..."
    
    if command -v yarn &> /dev/null; then
        yarn global add pm2
    elif command -v npm &> /dev/null; then
        npm install -g pm2
    else
        error "Neither yarn nor npm found. Please install a package manager."
        exit 1
    fi
    
    # Verify installation
    if command -v pm2 &> /dev/null; then
        local pm2_version
        pm2_version=$(pm2 --version)
        log "PM2 installed successfully: $pm2_version"
    else
        error "PM2 installation failed"
        exit 1
    fi
}

# Install additional tools
install_tools() {
    log "Checking additional tools..."
    
    # Check jq (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        warn "jq is not installed. Some monitoring features may not work."
        info "Install jq with:"
        echo "  macOS: brew install jq"
        echo "  Ubuntu/Debian: sudo apt-get install jq"
        echo "  CentOS/RHEL: sudo yum install jq"
    else
        log "jq is available"
    fi
    
    # Check bc (for calculations)
    if ! command -v bc &> /dev/null; then
        warn "bc is not installed. Some calculations may not work."
        info "Install bc with:"
        echo "  macOS: brew install bc"
        echo "  Ubuntu/Debian: sudo apt-get install bc"
        echo "  CentOS/RHEL: sudo yum install bc"
    else
        log "bc is available"
    fi
}

# Setup project dependencies
setup_project() {
    log "Setting up project dependencies..."
    cd "$PROJECT_DIR"
    
    # Install project dependencies
    if [ -f "package.json" ]; then
        if command -v yarn &> /dev/null; then
            yarn install
        else
            npm install
        fi
        log "Project dependencies installed"
    else
        error "package.json not found in project directory"
        exit 1
    fi
}

# Create environment files
create_env_files() {
    log "Setting up environment files..."
    cd "$PROJECT_DIR"
    
    # Create environment files if they don't exist
    local env_files=(".env.production" ".env.development" ".env.staging")
    
    for env_file in "${env_files[@]}"; do
        if [ ! -f "$env_file" ]; then
            if [ -f ".env.example" ]; then
                cp ".env.example" "$env_file"
                log "Created $env_file from .env.example"
                warn "Please edit $env_file and set your TELEGRAM_BOT_TOKEN"
            else
                # Create basic environment file
                cat > "$env_file" << EOF
# ${env_file} - Auto-generated
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=${env_file#.env.}
LOG_LEVEL=info
PORT=3000
EOF
                log "Created basic $env_file"
                warn "Please edit $env_file and set your TELEGRAM_BOT_TOKEN"
            fi
        else
            log "$env_file already exists"
        fi
    done
}

# Create logs directory
create_logs_dir() {
    log "Creating logs directory..."
    cd "$PROJECT_DIR"
    
    if [ ! -d "logs" ]; then
        mkdir -p logs
        log "Created logs directory"
    else
        log "Logs directory already exists"
    fi
    
    # Create .gitkeep to ensure directory is tracked
    touch logs/.gitkeep
}

# Setup PM2 startup script
setup_pm2_startup() {
    log "Setting up PM2 startup script..."
    
    # Generate startup script
    if pm2 startup > /tmp/pm2_startup.txt 2>&1; then
        log "PM2 startup script generated"
        info "To enable PM2 startup, run the command shown above as root/sudo"
        cat /tmp/pm2_startup.txt
    else
        warn "Could not generate PM2 startup script automatically"
        info "You can set it up manually later with: pm2 startup"
    fi
}

# Validate ecosystem configuration
validate_ecosystem() {
    log "Validating ecosystem configuration..."
    cd "$PROJECT_DIR"
    
    if [ ! -f "ecosystem.config.js" ]; then
        error "ecosystem.config.js not found"
        exit 1
    fi
    
    # Test ecosystem configuration
    if pm2 ecosystem > /dev/null 2>&1; then
        log "Ecosystem configuration is valid"
    else
        error "Ecosystem configuration has errors"
        pm2 ecosystem
        exit 1
    fi
}

# Build project
build_project() {
    log "Building project..."
    cd "$PROJECT_DIR"
    
    if command -v yarn &> /dev/null; then
        yarn build
    else
        npm run build
    fi
    
    if [ -d "dist" ] && [ -f "dist/index.js" ]; then
        log "Project built successfully"
    else
        error "Build failed - dist/index.js not found"
        exit 1
    fi
}

# Run setup tests
run_setup_tests() {
    log "Running setup tests..."
    cd "$PROJECT_DIR"
    
    # Test PM2 manager script
    if [ -x "scripts/pm2-manager.sh" ]; then
        log "PM2 manager script is executable"
    else
        error "PM2 manager script is not executable"
        chmod +x scripts/pm2-manager.sh
        log "Fixed PM2 manager script permissions"
    fi
    
    # Test PM2 deploy script
    if [ -x "scripts/pm2-deploy.sh" ]; then
        log "PM2 deploy script is executable"
    else
        error "PM2 deploy script is not executable"
        chmod +x scripts/pm2-deploy.sh
        log "Fixed PM2 deploy script permissions"
    fi
    
    # Test PM2 monitor script
    if [ -x "scripts/pm2-monitor.sh" ]; then
        log "PM2 monitor script is executable"
    else
        error "PM2 monitor script is not executable"
        chmod +x scripts/pm2-monitor.sh
        log "Fixed PM2 monitor script permissions"
    fi
}

# Show setup summary
show_summary() {
    log "Setup completed successfully!"
    echo
    echo "==================== SETUP SUMMARY ===================="
    echo
    echo "✅ Node.js: $(node --version)"
    echo "✅ PM2: $(pm2 --version)"
    echo "✅ Project dependencies installed"
    echo "✅ Environment files created"
    echo "✅ Logs directory created"
    echo "✅ Scripts are executable"
    echo "✅ Project built successfully"
    echo
    echo "==================== NEXT STEPS ===================="
    echo
    echo "1. Configure your bot tokens in environment files:"
    echo "   - .env.production"
    echo "   - .env.development"
    echo "   - .env.staging"
    echo
    echo "2. Start your bot:"
    echo "   yarn pm2:start              # Production"
    echo "   yarn pm2:start:dev          # Development"
    echo "   yarn pm2:start:staging      # Staging"
    echo
    echo "3. Check status:"
    echo "   yarn pm2:status"
    echo
    echo "4. View logs:"
    echo "   yarn pm2:logs"
    echo
    echo "5. Setup PM2 startup (optional):"
    echo "   ./scripts/pm2-manager.sh setup"
    echo
    echo "==================== USEFUL COMMANDS ===================="
    echo
    echo "Management:"
    echo "  ./scripts/pm2-manager.sh start <env>     # Start bot"
    echo "  ./scripts/pm2-manager.sh stop <env>      # Stop bot"
    echo "  ./scripts/pm2-manager.sh restart <env>   # Restart bot"
    echo "  ./scripts/pm2-manager.sh status          # Show status"
    echo
    echo "Deployment:"
    echo "  ./scripts/pm2-deploy.sh deploy <env>     # Deploy"
    echo "  ./scripts/pm2-deploy.sh health <env>     # Health check"
    echo
    echo "Monitoring:"
    echo "  ./scripts/pm2-monitor.sh monitor         # Monitor all"
    echo "  ./scripts/pm2-monitor.sh continuous      # Continuous monitoring"
    echo
    echo "For more information, see: docs/PM2_GUIDE.md"
    echo "========================================================"
}

# Show help
show_help() {
    echo "PM2 Setup Script for Telegram Chat ID Bot"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  --skip-build        Skip building the project"
    echo "  --skip-startup      Skip PM2 startup setup"
    echo "  --help              Show this help"
    echo
    echo "This script will:"
    echo "  1. Check Node.js installation"
    echo "  2. Install PM2 if not present"
    echo "  3. Install additional tools (jq, bc)"
    echo "  4. Setup project dependencies"
    echo "  5. Create environment files"
    echo "  6. Create logs directory"
    echo "  7. Setup PM2 startup script"
    echo "  8. Validate ecosystem configuration"
    echo "  9. Build the project"
    echo "  10. Run setup tests"
}

# Parse command line arguments
parse_args() {
    local skip_build=false
    local skip_startup=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-startup)
                skip_startup=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Run setup steps
    log "Starting PM2 setup for Telegram Chat ID Bot..."
    
    check_nodejs
    install_pm2
    install_tools
    setup_project
    create_env_files
    create_logs_dir
    
    if [ "$skip_startup" != "true" ]; then
        setup_pm2_startup
    fi
    
    validate_ecosystem
    
    if [ "$skip_build" != "true" ]; then
        build_project
    fi
    
    run_setup_tests
    show_summary
}

# Main execution
if [ $# -eq 0 ]; then
    parse_args
else
    parse_args "$@"
fi