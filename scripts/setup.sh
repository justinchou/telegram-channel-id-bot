#!/bin/bash

# Setup script for Telegram Chat ID Bot
set -e

echo "🔧 Setting up Telegram Chat ID Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18+ is required"
    echo "Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if Yarn is installed
if ! command -v yarn &> /dev/null; then
    echo "📦 Installing Yarn..."
    npm install -g yarn
fi

echo "✅ Yarn version: $(yarn --version)"

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your bot token"
fi

# Create logs directory
mkdir -p logs

# Build the project
echo "🏗️  Building project..."
yarn build

echo "🧪 Running tests to verify setup..."
yarn test

echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Telegram bot token"
echo "2. Run 'yarn dev' to start development server"
echo "3. Run 'yarn start' to start production server"
echo ""
echo "For more information, see README.md"