#!/bin/bash

# PM2 Manager Script for Telegram Chat ID Bot
# This script provides convenient commands for managing the bot with PM2

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
ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"

# Logging function
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

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Please install it first:"
        echo "  npm install -g pm2"
        echo "  # or"
        echo "  yarn global add pm2"
        exit 1
    fi
}

# Check if ecosystem file exists
check_ecosystem() {
    if [ ! -f "$ECOSYSTEM_FILE" ]; then
        error "Ecosystem file not found: $ECOSYSTEM_FILE"
        exit 1
    fi
}

# Ensure logs directory exists
ensure_logs_dir() {
    if [ ! -d "$PROJECT_DIR/logs" ]; then
        log "Creating logs directory..."
        mkdir -p "$PROJECT_DIR/logs"
    fi
}

# Build the project
build_project() {
    log "Building project..."
    cd "$PROJECT_DIR"
    
    if [ -f "package.json" ]; then
        if command -v yarn &> /dev/null; then
            yarn build
        else
            npm run build
        fi
    else
        error "package.json not found in project directory"
        exit 1
    fi
    
    log "Build completed successfully"
}

# Start bot in specified environment
start_bot() {
    local env=${1:-production}
    
    check_pm2
    check_ecosystem
    ensure_logs_dir
    
    # Build project for production/staging
    if [ "$env" != "dev" ] && [ "$env" != "development" ]; then
        build_project
    fi
    
    log "Starting bot in $env environment..."
    
    case $env in
        "prod"|"production")
            pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-prod
            ;;
        "dev"|"development")
            pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-dev
            ;;
        "staging")
            pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-staging
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging"
            exit 1
            ;;
    esac
    
    log "Bot started successfully in $env environment"
    pm2 list
}

# Stop bot in specified environment
stop_bot() {
    local env=${1:-production}
    
    check_pm2
    
    log "Stopping bot in $env environment..."
    
    case $env in
        "prod"|"production")
            pm2 stop telegram-bot-prod 2>/dev/null || warn "Bot was not running"
            ;;
        "dev"|"development")
            pm2 stop telegram-bot-dev 2>/dev/null || warn "Bot was not running"
            ;;
        "staging")
            pm2 stop telegram-bot-staging 2>/dev/null || warn "Bot was not running"
            ;;
        "all")
            pm2 stop all 2>/dev/null || warn "No processes were running"
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging, all"
            exit 1
            ;;
    esac
    
    log "Bot stopped successfully"
}

# Restart bot in specified environment
restart_bot() {
    local env=${1:-production}
    
    check_pm2
    check_ecosystem
    
    # Build project for production/staging
    if [ "$env" != "dev" ] && [ "$env" != "development" ]; then
        build_project
    fi
    
    log "Restarting bot in $env environment..."
    
    case $env in
        "prod"|"production")
            pm2 restart telegram-bot-prod 2>/dev/null || {
                warn "Bot was not running, starting it..."
                start_bot prod
                return
            }
            ;;
        "dev"|"development")
            pm2 restart telegram-bot-dev 2>/dev/null || {
                warn "Bot was not running, starting it..."
                start_bot dev
                return
            }
            ;;
        "staging")
            pm2 restart telegram-bot-staging 2>/dev/null || {
                warn "Bot was not running, starting it..."
                start_bot staging
                return
            }
            ;;
        "all")
            pm2 restart all
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging, all"
            exit 1
            ;;
    esac
    
    log "Bot restarted successfully"
    pm2 list
}

# Reload bot (graceful restart)
reload_bot() {
    local env=${1:-production}
    
    check_pm2
    
    log "Reloading bot in $env environment..."
    
    case $env in
        "prod"|"production")
            pm2 reload telegram-bot-prod
            ;;
        "dev"|"development")
            pm2 reload telegram-bot-dev
            ;;
        "staging")
            pm2 reload telegram-bot-staging
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging"
            exit 1
            ;;
    esac
    
    log "Bot reloaded successfully"
}

# Show bot status
status() {
    check_pm2
    
    log "Bot status:"
    pm2 list
    echo
    pm2 prettylist
}

# Show bot logs
logs() {
    local env=${1:-production}
    local lines=${2:-50}
    
    check_pm2
    
    case $env in
        "prod"|"production")
            pm2 logs telegram-bot-prod --lines "$lines"
            ;;
        "dev"|"development")
            pm2 logs telegram-bot-dev --lines "$lines"
            ;;
        "staging")
            pm2 logs telegram-bot-staging --lines "$lines"
            ;;
        "all")
            pm2 logs --lines "$lines"
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging, all"
            exit 1
            ;;
    esac
}

# Monitor bot
monitor() {
    check_pm2
    
    log "Opening PM2 monitor..."
    pm2 monit
}

# Show bot information
info_bot() {
    local env=${1:-production}
    
    check_pm2
    
    case $env in
        "prod"|"production")
            pm2 info telegram-bot-prod
            ;;
        "dev"|"development")
            pm2 info telegram-bot-dev
            ;;
        "staging")
            pm2 info telegram-bot-staging
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging"
            exit 1
            ;;
    esac
}

# Delete bot process
delete_bot() {
    local env=${1:-production}
    
    check_pm2
    
    log "Deleting bot process in $env environment..."
    
    case $env in
        "prod"|"production")
            pm2 delete telegram-bot-prod 2>/dev/null || warn "Process was not found"
            ;;
        "dev"|"development")
            pm2 delete telegram-bot-dev 2>/dev/null || warn "Process was not found"
            ;;
        "staging")
            pm2 delete telegram-bot-staging 2>/dev/null || warn "Process was not found"
            ;;
        "all")
            pm2 delete all 2>/dev/null || warn "No processes found"
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: prod, dev, staging, all"
            exit 1
            ;;
    esac
    
    log "Process deleted successfully"
}

# Setup PM2 startup script
setup_startup() {
    check_pm2
    
    log "Setting up PM2 startup script..."
    
    # Generate startup script
    pm2 startup
    
    log "PM2 startup script configured"
    log "To save current process list, run: pm2 save"
}

# Save current PM2 process list
save_processes() {
    check_pm2
    
    log "Saving current PM2 process list..."
    pm2 save
    log "Process list saved successfully"
}

# Update PM2
update_pm2() {
    log "Updating PM2..."
    pm2 update
    log "PM2 updated successfully"
}

# Show help
show_help() {
    echo "PM2 Manager for Telegram Chat ID Bot"
    echo
    echo "Usage: $0 <command> [environment] [options]"
    echo
    echo "Commands:"
    echo "  start <env>     Start bot (env: prod, dev, staging)"
    echo "  stop <env>      Stop bot (env: prod, dev, staging, all)"
    echo "  restart <env>   Restart bot (env: prod, dev, staging, all)"
    echo "  reload <env>    Graceful reload (env: prod, dev, staging)"
    echo "  status          Show bot status"
    echo "  logs <env> [n]  Show logs (env: prod, dev, staging, all) [last n lines]"
    echo "  monitor         Open PM2 monitor"
    echo "  info <env>      Show detailed bot info"
    echo "  delete <env>    Delete bot process (env: prod, dev, staging, all)"
    echo "  setup           Setup PM2 startup script"
    echo "  save            Save current process list"
    echo "  update          Update PM2"
    echo "  help            Show this help"
    echo
    echo "Examples:"
    echo "  $0 start prod           # Start production bot"
    echo "  $0 restart dev          # Restart development bot"
    echo "  $0 logs prod 100        # Show last 100 lines of production logs"
    echo "  $0 stop all             # Stop all bots"
    echo
    echo "Environment files:"
    echo "  Production: .env.production"
    echo "  Development: .env.development"
    echo "  Staging: .env.staging"
}

# Main command handler
case "${1:-help}" in
    "start")
        start_bot "${2:-production}"
        ;;
    "stop")
        stop_bot "${2:-production}"
        ;;
    "restart")
        restart_bot "${2:-production}"
        ;;
    "reload")
        reload_bot "${2:-production}"
        ;;
    "status")
        status
        ;;
    "logs")
        logs "${2:-production}" "${3:-50}"
        ;;
    "monitor")
        monitor
        ;;
    "info")
        info_bot "${2:-production}"
        ;;
    "delete")
        delete_bot "${2:-production}"
        ;;
    "setup")
        setup_startup
        ;;
    "save")
        save_processes
        ;;
    "update")
        update_pm2
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        error "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac