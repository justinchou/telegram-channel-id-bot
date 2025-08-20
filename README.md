# Telegram Chat ID Bot

A lightweight Telegram bot designed to help you quickly get chat ID information from groups, channels, and private chats. This bot is particularly useful for developers who need to obtain chat IDs for other Telegram bot projects.

## Features

- 🆔 Get chat ID with `/chatid` command
- 📊 Get detailed chat information with `/info` command
- 🆘 Built-in help system with `/help` and `/start` commands
- 🔒 Secure error handling and logging
- 🌐 Support for groups, supergroups, channels, and private chats
- 📝 Comprehensive logging with Winston
- 🧪 Full test coverage with Jest
- 🐳 Docker support for easy deployment

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- Yarn package manager
- A Telegram Bot Token (get one from [@BotFather](https://t.me/botfather))

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd telegram-channel-id-bot
```

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your bot token
```

4. Build and start the bot:

```bash
yarn build
yarn start
```

For development:

```bash
yarn dev
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
WEBHOOK_URL=https://your-domain.com/webhook
```

### Environment Files

- `.env.development` - Development configuration
- `.env.production` - Production configuration
- `.env.test` - Test configuration

## Usage

### Bot Commands

- `/start` - Welcome message and basic instructions
- `/help` - List of available commands and usage guide
- `/chatid` - Get the current chat ID
- `/info` - Get detailed information about the current chat

### Adding to Groups

1. Add the bot to your Telegram group
2. Send `/chatid` to get the group's chat ID
3. Send `/info` for detailed group information

## Development

### Available Scripts

```bash
# Development
yarn dev                 # Start in development mode
yarn dev:watch          # Start with file watching
yarn build:watch        # Build with file watching

# Building
yarn build              # Build for production
yarn build:clean        # Clean build (removes dist folder first)

# Testing
yarn test               # Run all tests
yarn test:watch         # Run tests in watch mode
yarn test:coverage      # Run tests with coverage report
yarn test:unit          # Run unit tests only
yarn test:integration   # Run integration tests only
yarn test:ci            # Run tests in CI mode

# Code Quality
yarn lint               # Lint code
yarn lint:fix           # Fix linting issues
yarn typecheck          # Type checking without emitting

# Utilities
yarn clean              # Clean build artifacts
```

### Project Structure

```
telegram-channel-id-bot/
├── src/
│   ├── bot/                 # Bot handler and main logic
│   ├── commands/            # Command handlers
│   ├── services/            # Business logic services
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript type definitions
│   └── index.ts             # Application entry point
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── setup.ts             # Test setup configuration
├── dist/                    # Compiled JavaScript (generated)
├── coverage/                # Test coverage reports (generated)
├── logs/                    # Application logs (generated)
└── docs/                    # Additional documentation
```

### Testing

The project uses Jest for testing with TypeScript support:

```bash
# Run all tests
yarn test

# Run with coverage
yarn test:coverage

# Run specific test file
yarn test ChatInfoService

# Run tests in watch mode
yarn test:watch
```

### Code Quality

- **TypeScript**: Full type safety and modern JavaScript features
- **ESLint**: Code linting with TypeScript support
- **Jest**: Comprehensive testing framework
- **Winston**: Professional logging
- **Prettier**: Code formatting (configured via ESLint)

## Deployment

### PM2 Deployment (Recommended)

PM2 is a production process manager for Node.js applications with built-in load balancer, monitoring, and auto-restart capabilities.

#### Quick Setup

```bash
# Install and setup PM2
./scripts/pm2-setup.sh

# Configure your bot token in environment files
# Edit .env.production, .env.development, .env.staging

# Start production bot
yarn pm2:start

# Check status
yarn pm2:status
```

#### PM2 Commands

```bash
# Management
yarn pm2:start              # Start production bot
yarn pm2:start:dev          # Start development bot
yarn pm2:stop               # Stop production bot
yarn pm2:restart            # Restart production bot
yarn pm2:status             # Show status

# Deployment
yarn pm2:deploy             # Deploy to production
yarn pm2:deploy:staging     # Deploy to staging
yarn pm2:health             # Health check

# Monitoring
yarn pm2:logs               # View logs
yarn pm2:monitor            # Open monitoring interface
```

For detailed PM2 usage, see [PM2 Guide](docs/PM2_GUIDE.md).

### Local Deployment

```bash
# Production build
yarn build

# Start in production mode
yarn start:prod
```

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Production deployment
docker-compose up -d

# Development deployment
docker-compose --profile dev up -d
```

#### Using Docker directly

```bash
# Build image
docker build -t telegram-channel-id-bot .

# Run container
docker run -d \
  --name telegram-channel-id-bot \
  --env-file .env.production \
  -p 3000:3000 \
  telegram-channel-id-bot
```

### Cloud Deployment

The bot can be deployed to various cloud platforms:

- **Heroku**: Use the included `Procfile`
- **Railway**: Direct deployment from Git
- **DigitalOcean App Platform**: Container deployment
- **AWS ECS/Fargate**: Container deployment
- **Google Cloud Run**: Serverless container deployment

### Environment-Specific Deployment

```bash
# Development
NODE_ENV=development yarn start

# Production
NODE_ENV=production yarn start:prod
```

## Monitoring and Logging

### Logging

The bot uses Winston for structured logging:

- **Development**: Console output with colors
- **Production**: File-based logging with rotation
- **Test**: Minimal error-only logging

Log files are stored in the `logs/` directory:

- `app.log` - General application logs
- `error.log` - Error logs only

### Health Checks

The bot includes health check endpoints for monitoring:

```bash
# Docker health check
docker ps  # Check container health status
```

## API Reference

### Bot Commands

| Command   | Description            | Usage     |
| --------- | ---------------------- | --------- |
| `/start`  | Welcome message        | `/start`  |
| `/help`   | Show help information  | `/help`   |
| `/chatid` | Get current chat ID    | `/chatid` |
| `/info`   | Get detailed chat info | `/info`   |

### Response Format

#### Chat ID Response

```
Chat ID: -1001234567890
```

#### Chat Info Response

```
📊 Chat Information:
🆔 Chat ID: -1001234567890
📝 Title: My Awesome Group
👥 Type: supergroup
👤 Members: 42
📄 Description: A great group for discussions
```

## Troubleshooting

### Common Issues

1. **Bot Token Invalid**

   - Verify your bot token in the `.env` file
   - Ensure the token is from [@BotFather](https://t.me/botfather)

2. **Permission Errors**

   - Make sure the bot has necessary permissions in the group
   - Check if the bot is an admin (if required)

3. **Network Issues**

   - Check internet connectivity
   - Verify firewall settings for outbound HTTPS traffic

4. **Build Errors**
   - Run `yarn clean` and `yarn install`
   - Check Node.js version compatibility

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug yarn dev
```

### Getting Help

- Check the [Issues](../../issues) page for known problems
- Review logs in the `logs/` directory
- Use `yarn test` to verify functionality

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `yarn test`
5. Run linting: `yarn lint:fix`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow TypeScript best practices
- Use conventional commit messages
- Maintain test coverage above 90%
- Update documentation for new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Modern Telegram Bot API framework
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [Jest](https://jestjs.io/) - Testing framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript

## Support

If you find this project helpful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting new features
- 🤝 Contributing to the code

---

Made with ❤️ for the Telegram Bot development community.
