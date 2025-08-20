#!/bin/bash

# Deployment script for Telegram Chat ID Bot
set -e

echo "🚀 Starting deployment process..."

# Check if environment is specified
if [ -z "$1" ]; then
    echo "❌ Error: Environment not specified"
    echo "Usage: ./scripts/deploy.sh [development|production]"
    exit 1
fi

ENVIRONMENT=$1
echo "📦 Deploying to: $ENVIRONMENT"

# Validate environment
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "❌ Error: Invalid environment. Use 'development' or 'production'"
    exit 1
fi

# Check if required files exist
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ Error: .env.$ENVIRONMENT file not found"
    exit 1
fi

echo "🧹 Cleaning previous build..."
yarn clean

echo "🔍 Running type checking..."
yarn typecheck

echo "🧪 Running tests..."
yarn test:ci

echo "🔧 Running linting..."
yarn lint

echo "🏗️  Building application..."
yarn build

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🐳 Building Docker image..."
    docker build -t telegram-channel-id-bot:latest .
    
    echo "🔄 Stopping existing container (if any)..."
    docker stop telegram-channel-id-bot 2>/dev/null || true
    docker rm telegram-channel-id-bot 2>/dev/null || true
    
    echo "🚀 Starting new container..."
    docker run -d \
        --name telegram-channel-id-bot \
        --env-file .env.production \
        --restart unless-stopped \
        -p 3000:3000 \
        -v "$(pwd)/logs:/app/logs" \
        telegram-channel-id-bot:latest
    
    echo "✅ Production deployment completed!"
    echo "📊 Container status:"
    docker ps | grep telegram-channel-id-bot
    
elif [ "$ENVIRONMENT" = "development" ]; then
    echo "🔄 Starting development server..."
    NODE_ENV=development yarn start &
    
    echo "✅ Development deployment completed!"
    echo "🌐 Bot is running at http://localhost:3000"
fi

echo "📝 Deployment logs:"
echo "   - Application logs: ./logs/"
echo "   - Docker logs: docker logs telegram-channel-id-bot"

echo "🎉 Deployment completed successfully!"