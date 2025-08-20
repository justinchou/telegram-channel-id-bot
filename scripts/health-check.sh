#!/bin/bash

# Health check script for Telegram Chat ID Bot
set -e

echo "🏥 Running health check..."

# Check if the application is running
if pgrep -f "node.*dist/index.js" > /dev/null; then
    echo "✅ Application process is running"
else
    echo "❌ Application process is not running"
    exit 1
fi

# Check if Docker container is running (if using Docker)
if command -v docker &> /dev/null; then
    if docker ps | grep -q telegram-channel-id-bot; then
        echo "✅ Docker container is running"
        
        # Check container health
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' telegram-channel-id-bot 2>/dev/null || echo "no-healthcheck")
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            echo "✅ Container health check passed"
        elif [ "$HEALTH_STATUS" = "no-healthcheck" ]; then
            echo "ℹ️  No health check configured for container"
        else
            echo "⚠️  Container health check status: $HEALTH_STATUS"
        fi
    fi
fi

# Check log files
if [ -f "logs/app.log" ]; then
    echo "✅ Application log file exists"
    
    # Check for recent errors
    RECENT_ERRORS=$(tail -n 100 logs/error.log 2>/dev/null | grep -c "ERROR" || echo "0")
    if [ "$RECENT_ERRORS" -gt 0 ]; then
        echo "⚠️  Found $RECENT_ERRORS recent errors in logs"
    else
        echo "✅ No recent errors in logs"
    fi
else
    echo "⚠️  Application log file not found"
fi

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "⚠️  Disk usage is high: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  Disk usage: ${DISK_USAGE}%"
else
    echo "✅ Disk usage: ${DISK_USAGE}%"
fi

# Check memory usage
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        echo "⚠️  Memory usage is high: ${MEMORY_USAGE}%"
    else
        echo "✅ Memory usage: ${MEMORY_USAGE}%"
    fi
fi

echo "🎉 Health check completed!"