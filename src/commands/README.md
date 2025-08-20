# Command Router System

The CommandRouter is a comprehensive command routing system for Telegram bots that provides command registration, middleware support, and context validation.

## Features

- **Command Registration**: Register commands with handlers, descriptions, and aliases
- **Middleware Support**: Add middleware for logging, rate limiting, authentication, etc.
- **Context Validation**: Restrict commands to specific chat types
- **Error Handling**: Comprehensive error handling with logging
- **Built-in Commands**: Pre-registered commands for chatid, info, help, and start
- **Command Normalization**: Handles `/command@botname` format automatically

## Usage

### Basic Usage

```typescript
import { CommandRouter } from "./command-router";

const router = new CommandRouter();

// Route incoming messages
await router.routeCommand(ctx);
```

### Registering Custom Commands

```typescript
router.registerCommand({
  command: "weather",
  handler: async (ctx) => {
    await ctx.reply("☀️ It's sunny today!");
  },
  description: "Get weather information",
  aliases: ["w", "clima"],
  allowedChatTypes: ["group", "supergroup", "private"],
});
```

### Adding Middleware

```typescript
// Add logging middleware
router.addMiddleware(CommandRouter.createLoggingMiddleware());

// Add rate limiting (10 requests per minute)
router.addMiddleware(CommandRouter.createRateLimitMiddleware(10, 60000));

// Add admin-only middleware
router.addMiddleware(CommandRouter.createAdminMiddleware([123456789]));

// Custom middleware
router.addMiddleware(async (ctx, next) => {
  console.log("Processing command...");
  await next();
  console.log("Command completed");
});
```

### Command Registration Options

```typescript
interface CommandRegistration {
  command: string; // Command name (without /)
  handler: CommandHandler; // Handler function
  description?: string; // Help text description
  aliases?: string[]; // Alternative command names
  requiresAdmin?: boolean; // Admin-only command
  allowedChatTypes?: string[]; // Allowed chat types
}
```

### Built-in Middleware Factories

#### Logging Middleware

Logs command execution time and errors:

```typescript
router.addMiddleware(CommandRouter.createLoggingMiddleware());
```

#### Rate Limiting Middleware

Prevents spam by limiting requests per user:

```typescript
// 10 requests per minute
router.addMiddleware(CommandRouter.createRateLimitMiddleware(10, 60000));
```

#### Admin Middleware

Restricts commands to specific user IDs:

```typescript
router.addMiddleware(CommandRouter.createAdminMiddleware([123456789, 987654321]));
```

## Default Commands

The router comes with these pre-registered commands:

- `/chatid` - Get current chat ID
- `/info` - Get detailed chat information
- `/help` - Show help message
- `/start` - Show welcome message

## Error Handling

The router automatically handles:

- Unknown commands
- Invalid chat types
- Middleware errors
- Handler exceptions

All errors are logged and user-friendly messages are sent to the chat.

## Chat Type Validation

Commands can be restricted to specific chat types:

```typescript
router.registerCommand({
  command: "adminonly",
  handler: adminHandler,
  allowedChatTypes: ["group", "supergroup"], // Only in groups
});
```

Available chat types:

- `private` - Direct messages
- `group` - Regular groups
- `supergroup` - Supergroups
- `channel` - Channels

## Command Aliases

Commands can have multiple aliases:

```typescript
router.registerCommand({
  command: "help",
  handler: helpHandler,
  aliases: ["h", "?", "ayuda"], // Multiple ways to call the command
});
```

## Middleware Execution Order

Middleware executes in the order it was added:

1. First middleware added
2. Second middleware added
3. ...
4. Command handler

Each middleware can:

- Execute code before the next middleware/handler
- Call `next()` to continue the chain
- Skip calling `next()` to stop execution
- Handle errors and exceptions

## Best Practices

1. **Register commands early**: Register all commands during bot initialization
2. **Use middleware for cross-cutting concerns**: Logging, authentication, rate limiting
3. **Validate input in handlers**: Check command parameters and context
4. **Handle errors gracefully**: Use try-catch in handlers for specific error handling
5. **Use chat type restrictions**: Prevent commands from running in inappropriate contexts
6. **Provide good descriptions**: Help users understand what commands do
