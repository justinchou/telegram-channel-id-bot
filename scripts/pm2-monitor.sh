#!/bin/bash

# PM2 Monitoring Script for Telegram Chat ID Bot
# This script provides monitoring and alerting capabilities

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
LOG_DIR="$PROJECT_DIR/logs"
MONITOR_LOG="$LOG_DIR/monitor.log"

# Thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
RESTART_THRESHOLD=5
UPTIME_THRESHOLD=300  # 5 minutes

# Logging functions
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}$message${NC}"
    echo "$message" >> "$MONITOR_LOG"
}

warn() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}$message${NC}"
    echo "$message" >> "$MONITOR_LOG"
}

error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}$message${NC}"
    echo "$message" >> "$MONITOR_LOG"
}

info() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}$message${NC}"
    echo "$message" >> "$MONITOR_LOG"
}

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed"
        exit 1
    fi
}

# Ensure logs directory exists
ensure_logs_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
    fi
}

# Get process information
get_process_info() {
    local app_name=$1
    
    # Get process info in JSON format
    pm2 jlist | jq -r ".[] | select(.name == \"$app_name\") | {
        name: .name,
        status: .pm2_env.status,
        cpu: .monit.cpu,
        memory: .monit.memory,
        restarts: .pm2_env.restart_time,
        uptime: .pm2_env.pm_uptime,
        pid: .pid
    }"
}

# Check process health
check_process_health() {
    local app_name=$1
    local issues=()
    
    # Get process info
    local process_info
    process_info=$(get_process_info "$app_name" 2>/dev/null)
    
    if [ -z "$process_info" ]; then
        error "Process $app_name not found"
        return 1
    fi
    
    # Parse process info
    local status cpu memory restarts uptime pid
    status=$(echo "$process_info" | jq -r '.status')
    cpu=$(echo "$process_info" | jq -r '.cpu')
    memory=$(echo "$process_info" | jq -r '.memory')
    restarts=$(echo "$process_info" | jq -r '.restarts')
    uptime=$(echo "$process_info" | jq -r '.uptime')
    pid=$(echo "$process_info" | jq -r '.pid')
    
    # Convert memory from bytes to MB
    memory_mb=$((memory / 1024 / 1024))
    
    # Calculate uptime in seconds
    current_time=$(date +%s)
    uptime_seconds=$(((current_time - uptime / 1000)))
    
    info "Checking health for $app_name (PID: $pid)"
    info "Status: $status, CPU: ${cpu}%, Memory: ${memory_mb}MB, Restarts: $restarts, Uptime: ${uptime_seconds}s"
    
    # Check if process is running
    if [ "$status" != "online" ]; then
        issues+=("Process is not online (status: $status)")
    fi
    
    # Check CPU usage
    if (( $(echo "$cpu > $CPU_THRESHOLD" | bc -l) )); then
        issues+=("High CPU usage: ${cpu}% (threshold: ${CPU_THRESHOLD}%)")
    fi
    
    # Check memory usage
    if [ "$memory_mb" -gt "$MEMORY_THRESHOLD" ]; then
        issues+=("High memory usage: ${memory_mb}MB (threshold: ${MEMORY_THRESHOLD}MB)")
    fi
    
    # Check restart count
    if [ "$restarts" -gt "$RESTART_THRESHOLD" ]; then
        issues+=("High restart count: $restarts (threshold: $RESTART_THRESHOLD)")
    fi
    
    # Check uptime (if process is online)
    if [ "$status" = "online" ] && [ "$uptime_seconds" -lt "$UPTIME_THRESHOLD" ]; then
        issues+=("Low uptime: ${uptime_seconds}s (threshold: ${UPTIME_THRESHOLD}s)")
    fi
    
    # Report issues
    if [ ${#issues[@]} -eq 0 ]; then
        log "Health check passed for $app_name"
        return 0
    else
        warn "Health check failed for $app_name:"
        for issue in "${issues[@]}"; do
            warn "  - $issue"
        done
        return 1
    fi
}

# Monitor all bot processes
monitor_all() {
    local apps=("telegram-bot-prod" "telegram-bot-staging" "telegram-bot-dev")
    local failed_checks=0
    
    log "Starting health monitoring for all bot processes..."
    
    for app in "${apps[@]}"; do
        if pm2 list | grep -q "$app"; then
            if ! check_process_health "$app"; then
                failed_checks=$((failed_checks + 1))
            fi
        else
            info "Process $app is not running"
        fi
        echo
    done
    
    if [ $failed_checks -eq 0 ]; then
        log "All health checks passed"
    else
        warn "$failed_checks health check(s) failed"
    fi
    
    return $failed_checks
}

# Monitor specific process
monitor_process() {
    local app_name=$1
    
    if [ -z "$app_name" ]; then
        error "Process name required"
        exit 1
    fi
    
    log "Monitoring process: $app_name"
    check_process_health "$app_name"
}

# Show process statistics
show_stats() {
    local app_name=${1:-"all"}
    
    log "Process statistics:"
    
    if [ "$app_name" = "all" ]; then
        pm2 list
        echo
        pm2 prettylist
    else
        pm2 show "$app_name"
    fi
}

# Show system resources
show_system_resources() {
    log "System resources:"
    
    # CPU usage
    local cpu_usage
    cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    echo "CPU Usage: ${cpu_usage}%"
    
    # Memory usage
    local memory_info
    memory_info=$(vm_stat | grep -E "(free|active|inactive|wired)" | awk '{print $3}' | sed 's/\.//')
    local page_size=4096
    local free_pages active_pages inactive_pages wired_pages
    free_pages=$(echo "$memory_info" | sed -n '1p')
    active_pages=$(echo "$memory_info" | sed -n '2p')
    inactive_pages=$(echo "$memory_info" | sed -n '3p')
    wired_pages=$(echo "$memory_info" | sed -n '4p')
    
    local total_memory used_memory
    total_memory=$(((free_pages + active_pages + inactive_pages + wired_pages) * page_size / 1024 / 1024))
    used_memory=$(((active_pages + inactive_pages + wired_pages) * page_size / 1024 / 1024))
    
    echo "Memory Usage: ${used_memory}MB / ${total_memory}MB"
    
    # Disk usage
    local disk_usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    echo "Disk Usage: $disk_usage"
    
    # Load average
    local load_avg
    load_avg=$(uptime | awk -F'load averages:' '{print $2}')
    echo "Load Average:$load_avg"
}

# Continuous monitoring
continuous_monitor() {
    local interval=${1:-60}  # Default 60 seconds
    local app_name=${2:-"all"}
    
    log "Starting continuous monitoring (interval: ${interval}s, process: $app_name)"
    
    while true; do
        echo "==================== $(date) ===================="
        
        if [ "$app_name" = "all" ]; then
            monitor_all
        else
            monitor_process "$app_name"
        fi
        
        echo
        show_system_resources
        echo
        
        sleep "$interval"
    done
}

# Generate monitoring report
generate_report() {
    local output_file=${1:-"$LOG_DIR/monitoring-report-$(date +%Y%m%d-%H%M%S).txt"}
    
    log "Generating monitoring report: $output_file"
    
    {
        echo "Telegram Bot Monitoring Report"
        echo "Generated: $(date)"
        echo "========================================"
        echo
        
        echo "Process Status:"
        pm2 list
        echo
        
        echo "System Resources:"
        show_system_resources
        echo
        
        echo "Process Details:"
        local apps=("telegram-bot-prod" "telegram-bot-staging" "telegram-bot-dev")
        for app in "${apps[@]}"; do
            if pm2 list | grep -q "$app"; then
                echo "--- $app ---"
                pm2 show "$app"
                echo
            fi
        done
        
        echo "Recent Logs (last 50 lines):"
        echo "--- Combined Logs ---"
        tail -n 50 "$LOG_DIR/pm2-combined.log" 2>/dev/null || echo "No combined logs found"
        echo
        
        echo "--- Error Logs ---"
        tail -n 50 "$LOG_DIR/pm2-error.log" 2>/dev/null || echo "No error logs found"
        
    } > "$output_file"
    
    log "Report generated: $output_file"
}

# Setup monitoring alerts (basic email notification)
setup_alerts() {
    local email=${1:-""}
    
    if [ -z "$email" ]; then
        error "Email address required for alerts"
        echo "Usage: $0 setup-alerts your-email@example.com"
        exit 1
    fi
    
    log "Setting up monitoring alerts for: $email"
    
    # Create alert script
    local alert_script="$SCRIPT_DIR/pm2-alert.sh"
    cat > "$alert_script" << EOF
#!/bin/bash
# Auto-generated alert script

EMAIL="$email"
SUBJECT="Telegram Bot Alert - \$(hostname)"

# Check if mail command is available
if ! command -v mail &> /dev/null; then
    echo "mail command not available. Please install mailutils or similar."
    exit 1
fi

# Send alert
send_alert() {
    local message="\$1"
    echo "\$message" | mail -s "\$SUBJECT" "\$EMAIL"
    echo "Alert sent to \$EMAIL: \$message"
}

# Monitor and alert
while true; do
    if ! $0 monitor all > /dev/null 2>&1; then
        send_alert "Health check failed for Telegram Bot processes. Please check the logs."
    fi
    sleep 300  # Check every 5 minutes
done
EOF
    
    chmod +x "$alert_script"
    
    log "Alert script created: $alert_script"
    log "To start monitoring with alerts, run: nohup $alert_script &"
}

# Show help
show_help() {
    echo "PM2 Monitoring Script for Telegram Chat ID Bot"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  monitor [process]       Monitor specific process or all processes"
    echo "  stats [process]         Show process statistics"
    echo "  system                  Show system resources"
    echo "  continuous [interval] [process]"
    echo "                         Continuous monitoring (default: 60s)"
    echo "  report [output_file]    Generate monitoring report"
    echo "  setup-alerts <email>   Setup email alerts"
    echo "  help                    Show this help"
    echo
    echo "Examples:"
    echo "  $0 monitor                          # Monitor all processes"
    echo "  $0 monitor telegram-bot-prod        # Monitor production bot"
    echo "  $0 continuous 30                    # Monitor every 30 seconds"
    echo "  $0 continuous 60 telegram-bot-prod  # Monitor specific process"
    echo "  $0 report /tmp/bot-report.txt       # Generate report to file"
    echo "  $0 setup-alerts admin@example.com   # Setup email alerts"
    echo
    echo "Available processes:"
    echo "  telegram-bot-prod      Production bot"
    echo "  telegram-bot-staging   Staging bot"
    echo "  telegram-bot-dev       Development bot"
}

# Main command handler
main() {
    check_pm2
    ensure_logs_dir
    
    case "${1:-help}" in
        "monitor")
            if [ -n "$2" ]; then
                monitor_process "$2"
            else
                monitor_all
            fi
            ;;
        "stats")
            show_stats "$2"
            ;;
        "system")
            show_system_resources
            ;;
        "continuous")
            continuous_monitor "$2" "$3"
            ;;
        "report")
            generate_report "$2"
            ;;
        "setup-alerts")
            setup_alerts "$2"
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
}

# Check if jq is available (required for JSON parsing)
if ! command -v jq &> /dev/null; then
    warn "jq is not installed. Some features may not work properly."
    warn "Install jq with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
fi

# Check if bc is available (required for calculations)
if ! command -v bc &> /dev/null; then
    warn "bc is not installed. Some calculations may not work properly."
    warn "Install bc with: brew install bc (macOS) or apt-get install bc (Ubuntu)"
fi

main "$@"