# Telegram Chat ID Bot

A lightweight Telegram bot that helps you get chat ID information from groups, supergroups, channels, and private chats.

## Features

- Get chat ID with `/chatid` command
- Get detailed chat information with `/info` command
- Help and usage instructions with `/help` and `/start` commands
- Support for groups, supergroups, channels, and private chats
- Error handling and logging
- TypeScript implementation

## Setup

### Prerequisites

- Node.js 18+ (use nvm: `nvm use`)
- Yarn package manager
- Telegram Bot Token (get from @BotFather)

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   yarn install
   ```

3. Copy environment configuration:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file and add your bot token:

   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

### Development

```bash
# Run in development mode
yarn dev

# Build the project
yarn build

# Run tests
yarn test

# Run tests with coverage
yarn test:coverage

# Lint code
yarn lint
```

### Production

```bash
# Build and start
yarn build
yarn start
```

## Usage

1. Add the bot to your Telegram group or start a private chat
2. Use the following commands:
   - `/chatid` - Get the current chat ID
   - `/info` - Get detailed chat information
   - `/help` - Show available commands
   - `/start` - Show welcome message

## Project Structure

```
src/
├── bot/           # Bot handler and main logic
├── commands/      # Command handlers
├── services/      # Business logic services
├── utils/         # Utility functions
├── types/         # TypeScript type definitions
└── index.ts       # Application entry point
```

## License

MIT
