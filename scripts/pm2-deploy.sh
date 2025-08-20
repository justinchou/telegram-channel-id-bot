#!/bin/bash

# PM2 Deployment Script for Telegram Chat ID Bot
# This script handles deployment to different environments

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

# Check prerequisites
check_prerequisites() {
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Installing PM2..."
        if command -v yarn &> /dev/null; then
            yarn global add pm2
        elif command -v npm &> /dev/null; then
            npm install -g pm2
        else
            error "Neither yarn nor npm found. Please install Node.js first."
            exit 1
        fi
    fi
    
    # Check if ecosystem file exists
    if [ ! -f "$ECOSYSTEM_FILE" ]; then
        error "Ecosystem file not found: $ECOSYSTEM_FILE"
        exit 1
    fi
    
    # Check if project has package.json
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        error "package.json not found in project directory"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    cd "$PROJECT_DIR"
    
    if command -v yarn &> /dev/null; then
        yarn install --production=false
    else
        npm install
    fi
    
    log "Dependencies installed successfully"
}

# Build project
build_project() {
    log "Building project..."
    cd "$PROJECT_DIR"
    
    if command -v yarn &> /dev/null; then
        yarn build:clean
    else
        npm run build:clean
    fi
    
    log "Project built successfully"
}

# Run tests
run_tests() {
    local skip_tests=${1:-false}
    
    if [ "$skip_tests" = "true" ]; then
        warn "Skipping tests as requested"
        return 0
    fi
    
    log "Running tests..."
    cd "$PROJECT_DIR"
    
    if command -v yarn &> /dev/null; then
        yarn test:ci
    else
        npm run test:ci
    fi
    
    log "All tests passed"
}

# Check environment file
check_env_file() {
    local env=$1
    local env_file="$PROJECT_DIR/.env.$env"
    
    if [ ! -f "$env_file" ]; then
        error "Environment file not found: $env_file"
        echo "Please create the environment file with required variables:"
        echo "  TELEGRAM_BOT_TOKEN=your_bot_token"
        echo "  NODE_ENV=$env"
        echo "  LOG_LEVEL=info"
        exit 1
    fi
    
    # Check if TELEGRAM_BOT_TOKEN is set
    if ! grep -q "TELEGRAM_BOT_TOKEN=" "$env_file" || grep -q "TELEGRAM_BOT_TOKEN=your_.*_token" "$env_file"; then
        error "TELEGRAM_BOT_TOKEN not properly configured in $env_file"
        echo "Please set a valid bot token from @BotFather"
        exit 1
    fi
    
    log "Environment file validated: $env_file"
}

# Deploy to environment
deploy_to_env() {
    local env=$1
    local skip_tests=${2:-false}
    local force_restart=${3:-false}
    
    log "Starting deployment to $env environment..."
    
    # Check prerequisites
    check_prerequisites
    
    # Check environment file
    check_env_file "$env"
    
    # Install dependencies
    install_dependencies
    
    # Run tests (unless skipped)
    run_tests "$skip_tests"
    
    # Build project
    build_project
    
    # Ensure logs directory exists
    mkdir -p "$PROJECT_DIR/logs"
    
    # Deploy based on environment
    case $env in
        "production"|"prod")
            deploy_production "$force_restart"
            ;;
        "staging")
            deploy_staging "$force_restart"
            ;;
        "development"|"dev")
            deploy_development "$force_restart"
            ;;
        *)
            error "Unknown environment: $env"
            echo "Available environments: production, staging, development"
            exit 1
            ;;
    esac
    
    log "Deployment to $env completed successfully!"
}

# Deploy to production
deploy_production() {
    local force_restart=$1
    
    log "Deploying to production..."
    
    # Check if bot is already running
    if pm2 list | grep -q "telegram-bot-prod"; then
        if [ "$force_restart" = "true" ]; then
            log "Force restarting production bot..."
            pm2 restart telegram-bot-prod
        else
            log "Gracefully reloading production bot..."
            pm2 reload telegram-bot-prod
        fi
    else
        log "Starting production bot..."
        pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-prod
    fi
    
    # Save PM2 process list
    pm2 save
    
    log "Production deployment completed"
    pm2 list
}

# Deploy to staging
deploy_staging() {
    local force_restart=$1
    
    log "Deploying to staging..."
    
    # Check if bot is already running
    if pm2 list | grep -q "telegram-bot-staging"; then
        if [ "$force_restart" = "true" ]; then
            log "Force restarting staging bot..."
            pm2 restart telegram-bot-staging
        else
            log "Gracefully reloading staging bot..."
            pm2 reload telegram-bot-staging
        fi
    else
        log "Starting staging bot..."
        pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-staging
    fi
    
    log "Staging deployment completed"
    pm2 list
}

# Deploy to development
deploy_development() {
    local force_restart=$1
    
    log "Deploying to development..."
    
    # Stop existing development bot if running
    pm2 stop telegram-bot-dev 2>/dev/null || true
    pm2 delete telegram-bot-dev 2>/dev/null || true
    
    # Start development bot
    log "Starting development bot..."
    pm2 start "$ECOSYSTEM_FILE" --only telegram-bot-dev
    
    log "Development deployment completed"
    pm2 list
}

# Rollback deployment
rollback() {
    local env=$1
    
    log "Rolling back $env environment..."
    
    case $env in
        "production"|"prod")
            pm2 restart telegram-bot-prod
            ;;
        "staging")
            pm2 restart telegram-bot-staging
            ;;
        "development"|"dev")
            pm2 restart telegram-bot-dev
            ;;
        *)
            error "Unknown environment: $env"
            exit 1
            ;;
    esac
    
    log "Rollback completed for $env environment"
}

# Health check
health_check() {
    local env=$1
    local timeout=${2:-30}
    
    log "Performing health check for $env environment..."
    
    local app_name
    case $env in
        "production"|"prod")
            app_name="telegram-bot-prod"
            ;;
        "staging")
            app_name="telegram-bot-staging"
            ;;
        "development"|"dev")
            app_name="telegram-bot-dev"
            ;;
        *)
            error "Unknown environment: $env"
            exit 1
            ;;
    esac
    
    # Wait for app to start
    local count=0
    while [ $count -lt $timeout ]; do
        if pm2 list | grep -q "$app_name.*online"; then
            log "Health check passed - bot is running"
            return 0
        fi
        
        sleep 1
        count=$((count + 1))
    done
    
    error "Health check failed - bot is not running after $timeout seconds"
    pm2 logs "$app_name" --lines 20
    exit 1
}

# Show deployment status
show_status() {
    log "Current deployment status:"
    pm2 list
    echo
    pm2 prettylist
}

# Show help
show_help() {
    echo "PM2 Deployment Script for Telegram Chat ID Bot"
    echo
    echo "Usage: $0 <command> [environment] [options]"
    echo
    echo "Commands:"
    echo "  deploy <env> [--skip-tests] [--force-restart]"
    echo "                      Deploy to environment (prod, staging, dev)"
    echo "  rollback <env>      Rollback deployment"
    echo "  health <env> [timeout]"
    echo "                      Perform health check (default timeout: 30s)"
    echo "  status              Show deployment status"
    echo "  help                Show this help"
    echo
    echo "Options:"
    echo "  --skip-tests        Skip running tests during deployment"
    echo "  --force-restart     Force restart instead of graceful reload"
    echo
    echo "Examples:"
    echo "  $0 deploy prod                    # Deploy to production"
    echo "  $0 deploy staging --skip-tests    # Deploy to staging without tests"
    echo "  $0 deploy prod --force-restart    # Deploy with force restart"
    echo "  $0 rollback prod                  # Rollback production"
    echo "  $0 health prod 60                 # Health check with 60s timeout"
    echo
    echo "Prerequisites:"
    echo "  - PM2 installed globally"
    echo "  - Environment files (.env.production, .env.staging, .env.development)"
    echo "  - Valid TELEGRAM_BOT_TOKEN in environment files"
}

# Parse command line arguments
parse_args() {
    local cmd=$1
    shift
    
    local env=""
    local skip_tests=false
    local force_restart=false
    local timeout=30
    
    # Parse environment and options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --force-restart)
                force_restart=true
                shift
                ;;
            --timeout=*)
                timeout="${1#*=}"
                shift
                ;;
            prod|production|staging|dev|development)
                env=$1
                shift
                ;;
            [0-9]*)
                timeout=$1
                shift
                ;;
            *)
                if [ -z "$env" ]; then
                    env=$1
                else
                    error "Unknown option: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Execute command
    case $cmd in
        "deploy")
            if [ -z "$env" ]; then
                error "Environment required for deploy command"
                echo "Usage: $0 deploy <env> [options]"
                exit 1
            fi
            deploy_to_env "$env" "$skip_tests" "$force_restart"
            ;;
        "rollback")
            if [ -z "$env" ]; then
                error "Environment required for rollback command"
                echo "Usage: $0 rollback <env>"
                exit 1
            fi
            rollback "$env"
            ;;
        "health")
            if [ -z "$env" ]; then
                error "Environment required for health command"
                echo "Usage: $0 health <env> [timeout]"
                exit 1
            fi
            health_check "$env" "$timeout"
            ;;
        "status")
            show_status
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            error "Unknown command: $cmd"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Main execution
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

parse_args "$@"