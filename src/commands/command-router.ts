import { TelegrafContext, ErrorContext } from "../types";
import { ErrorHandler } from "../utils/error-handler";
import { SecurityMiddleware } from "../middleware/security-middleware";
import { ChatIdCommandHandler } from "./chatid";
import { InfoCommandHandler } from "./info";
import { HelpCommandHandler } from "./help";

/**
 * Middleware function type for command processing
 */
export type CommandMiddleware = (ctx: TelegrafContext, next: () => Promise<void>) => Promise<void>;

/**
 * Command handler function type
 */
export type CommandHandler = (ctx: TelegrafContext) => Promise<void>;

/**
 * Command registration interface
 */
export interface CommandRegistration {
  /** Command name (without the / prefix) */
  command: string;
  /** Handler function for the command */
  handler: CommandHandler;
  /** Optional description for help text */
  description?: string;
  /** Optional aliases for the command */
  aliases?: string[];
  /** Whether the command requires admin permissions */
  requiresAdmin?: boolean;
  /** Allowed chat types for this command */
  allowedChatTypes?: string[];
}

/**
 * Command Router Class
 *
 * A comprehensive command routing system for Telegram bots that provides:
 * - Command registration and management
 * - Middleware support for cross-cutting concerns
 * - Context validation and chat type restrictions
 * - Error handling and unknown command management
 * - Built-in rate limiting, logging, and admin middleware factories
 *
 * Implements Requirements 2.1, 2.2, 2.3, 4.1, 4.2, 4.3:
 * - 2.1: Route /chatid command to appropriate handler
 * - 2.2: Route /info command to appropriate handler
 * - 2.3: Handle different chat types appropriately
 * - 4.1: Route /help command to help handler
 * - 4.2: Route /start command to help handler
 * - 4.3: Handle unknown commands with appropriate responses
 *
 * Features:
 * - Automatic command normalization (handles /command@botname format)
 * - Command aliases support
 * - Chat type validation
 * - Middleware pipeline execution
 * - Comprehensive error handling
 * - Built-in middleware factories for common use cases
 *
 * Usage:
 * ```typescript
 * const router = new CommandRouter();
 *
 * // Register custom command
 * router.registerCommand({
 *   command: 'mycommand',
 *   handler: async (ctx) => { await ctx.reply('Hello!'); },
 *   description: 'My custom command',
 *   allowedChatTypes: ['group', 'supergroup']
 * });
 *
 * // Add middleware
 * router.addMiddleware(CommandRouter.createLoggingMiddleware());
 *
 * // Route incoming messages
 * await router.routeCommand(ctx);
 * ```
 */
export class CommandRouter {
  private commands: Map<string, CommandRegistration> = new Map();
  private middlewares: CommandMiddleware[] = [];
  private errorHandler: ErrorHandler;
  private securityMiddleware: SecurityMiddleware;
  private chatIdHandler: ChatIdCommandHandler;
  private infoHandler: InfoCommandHandler;
  private helpHandler: HelpCommandHandler;

  constructor() {
    this.errorHandler = new ErrorHandler();
    this.securityMiddleware = new SecurityMiddleware();
    this.chatIdHandler = new ChatIdCommandHandler();
    this.infoHandler = new InfoCommandHandler();
    this.helpHandler = new HelpCommandHandler();

    // Register default commands
    this.registerDefaultCommands();

    // Add default security middleware
    this.addDefaultSecurityMiddleware();
  }

  /**
   * Register a command with the router
   * @param registration - Command registration details
   */
  registerCommand(registration: CommandRegistration): void {
    // Validate command registration
    if (!registration.command || !registration.handler) {
      throw new Error("Command and handler are required for registration");
    }

    // Normalize command name (remove leading slash if present)
    const commandName = registration.command.toLowerCase().replace(/^\//, "");

    // Store the registration
    this.commands.set(commandName, {
      ...registration,
      command: commandName,
    });

    // Register aliases if provided
    if (registration.aliases) {
      registration.aliases.forEach((alias) => {
        const normalizedAlias = alias.toLowerCase().replace(/^\//, "");
        this.commands.set(normalizedAlias, {
          ...registration,
          command: normalizedAlias,
        });
      });
    }
  }

  /**
   * Add middleware to the command processing pipeline
   * @param middleware - Middleware function to add
   */
  addMiddleware(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Route and execute a command
   * @param ctx - Telegraf context object
   */
  async routeCommand(ctx: TelegrafContext): Promise<void> {
    try {
      // Extract command from message
      const command = this.extractCommand(ctx);

      if (!command) {
        // Not a command, ignore
        return;
      }

      // Find command registration
      const registration = this.commands.get(command.toLowerCase());

      if (!registration) {
        // Handle unknown command
        await this.handleUnknownCommand(ctx, command);
        return;
      }

      // Validate command context
      if (!this.validateCommandContext(ctx, registration)) {
        await this.handleInvalidContext(ctx, registration);
        return;
      }

      // Execute middleware chain and command
      await this.executeWithMiddleware(ctx, registration);
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: this.extractCommand(ctx) || "unknown",
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        metadata: {
          chatType: ctx.chat?.type,
          timestamp: new Date().toISOString(),
        },
      };

      // Handle error using centralized error handler
      await this.errorHandler.handleError(ctx, error instanceof Error ? error : new Error(String(error)), errorContext);
    }
  }

  /**
   * Get list of registered commands
   * @returns Array of command registrations
   */
  getRegisteredCommands(): CommandRegistration[] {
    // Return unique commands (excluding aliases)
    const uniqueCommands = new Map<string, CommandRegistration>();

    for (const [_, registration] of this.commands) {
      if (!uniqueCommands.has(registration.command)) {
        uniqueCommands.set(registration.command, registration);
      }
    }

    return Array.from(uniqueCommands.values());
  }

  /**
   * Check if a command is registered
   * @param command - Command name to check
   * @returns true if command is registered, false otherwise
   */
  isCommandRegistered(command: string): boolean {
    const normalizedCommand = command.toLowerCase().replace(/^\//, "");
    return this.commands.has(normalizedCommand);
  }

  /**
   * Register default commands for the bot
   */
  private registerDefaultCommands(): void {
    // Register /chatid command
    this.registerCommand({
      command: "chatid",
      handler: async (ctx: TelegrafContext) => await this.chatIdHandler.handle(ctx),
      description: "获取当前聊天的 Chat ID",
      aliases: ["id", "chatid"],
      allowedChatTypes: ["private", "group", "supergroup", "channel"],
    });

    // Register /info command
    this.registerCommand({
      command: "info",
      handler: async (ctx: TelegrafContext) => await this.infoHandler.handle(ctx),
      description: "获取当前聊天的详细信息",
      allowedChatTypes: ["private", "group", "supergroup", "channel"],
    });

    // Register /help command
    this.registerCommand({
      command: "help",
      handler: async (ctx: TelegrafContext) => await this.helpHandler.handleHelp(ctx),
      description: "显示帮助信息和可用命令",
      aliases: ["h"],
      allowedChatTypes: ["private", "group", "supergroup", "channel"],
    });

    // Register /start command
    this.registerCommand({
      command: "start",
      handler: async (ctx: TelegrafContext) => await this.helpHandler.handleStart(ctx),
      description: "开始使用 Bot 并显示欢迎信息",
      allowedChatTypes: ["private", "group", "supergroup", "channel"],
    });
  }

  /**
   * Extract command from the message text
   * @param ctx - Telegraf context object
   * @returns Command name without slash, or null if not a command
   */
  private extractCommand(ctx: TelegrafContext): string | null {
    const message = (ctx.message as any)?.text;

    if (!message || !message.startsWith("/")) {
      return null;
    }

    // Extract command (handle bot username mentions like /command@botname)
    const commandMatch = message.match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?/);
    return commandMatch ? commandMatch[1].toLowerCase() : null;
  }

  /**
   * Validate if command can be executed in the current context
   * @param ctx - Telegraf context object
   * @param registration - Command registration
   * @returns true if command can be executed, false otherwise
   */
  private validateCommandContext(ctx: TelegrafContext, registration: CommandRegistration): boolean {
    // Check if chat type is allowed
    if (registration.allowedChatTypes && ctx.chat) {
      if (!registration.allowedChatTypes.includes(ctx.chat.type)) {
        return false;
      }
    }

    // Check admin requirements (placeholder for future implementation)
    if (registration.requiresAdmin) {
      // TODO: Implement admin check logic
      // For now, assume all users can use admin commands
    }

    return true;
  }

  /**
   * Execute command with middleware chain
   * @param ctx - Telegraf context object
   * @param registration - Command registration
   */
  private async executeWithMiddleware(ctx: TelegrafContext, registration: CommandRegistration): Promise<void> {
    let middlewareIndex = 0;

    const next = async (): Promise<void> => {
      if (middlewareIndex < this.middlewares.length) {
        const middleware = this.middlewares[middlewareIndex++];
        if (middleware) {
          await middleware(ctx, next);
        }
      } else {
        // Execute the actual command handler
        await registration.handler(ctx);
      }
    };

    await next();
  }

  /**
   * Handle unknown commands
   * @param ctx - Telegraf context object
   * @param command - The unknown command
   */
  private async handleUnknownCommand(ctx: TelegrafContext, command: string): Promise<void> {
    await this.helpHandler.handleUnknownCommand(ctx, command);
  }

  /**
   * Handle invalid command context (e.g., wrong chat type)
   * @param ctx - Telegraf context object
   * @param registration - Command registration
   */
  private async handleInvalidContext(ctx: TelegrafContext, registration: CommandRegistration): Promise<void> {
    let errorMessage = `❌ 命令 /${registration.command} 不能在当前聊天类型中使用。\n\n`;

    if (registration.allowedChatTypes) {
      const allowedTypes = registration.allowedChatTypes
        .map((type) => {
          const typeNames: Record<string, string> = {
            private: "私聊",
            group: "群组",
            supergroup: "超级群组",
            channel: "频道",
          };
          return typeNames[type] || type;
        })
        .join("、");

      errorMessage += `💡 此命令只能在以下聊天类型中使用：${allowedTypes}`;
    }

    await ctx.reply(errorMessage, { parse_mode: "Markdown" });
  }

  /**
   * Create logging middleware for command usage analytics
   * @returns Middleware function for logging
   */
  static createLoggingMiddleware(): CommandMiddleware {
    return async (ctx: TelegrafContext, next: () => Promise<void>) => {
      const startTime = Date.now();
      const command = (ctx.message as any)?.text?.split(" ")[0];

      try {
        await next();

        // Log successful command execution
        const duration = Date.now() - startTime;
        // eslint-disable-next-line no-console
        console.log(`Command executed: ${command} in ${duration}ms`, {
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          userId: ctx.from?.id,
          duration,
        });
      } catch (error) {
        // Log command execution error
        const duration = Date.now() - startTime;
        // eslint-disable-next-line no-console
        console.error(`Command failed: ${command} after ${duration}ms`, {
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          userId: ctx.from?.id,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw to maintain error handling chain
      }
    };
  }

  /**
   * Create rate limiting middleware to prevent spam
   * @param maxRequests - Maximum requests per time window
   * @param timeWindow - Time window in milliseconds
   * @returns Middleware function for rate limiting
   */
  static createRateLimitMiddleware(maxRequests: number = 10, timeWindow: number = 60000): CommandMiddleware {
    const userRequests = new Map<number, { count: number; resetTime: number }>();

    return async (ctx: TelegrafContext, next: () => Promise<void>) => {
      const userId = ctx.from?.id;

      if (!userId) {
        await next();
        return;
      }

      const now = Date.now();
      const userLimit = userRequests.get(userId);

      if (!userLimit || now > userLimit.resetTime) {
        // Reset or initialize user limit
        userRequests.set(userId, {
          count: 1,
          resetTime: now + timeWindow,
        });
        await next();
        return;
      }

      if (userLimit.count >= maxRequests) {
        // Rate limit exceeded
        const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000);
        await ctx.reply(`⚠️ 请求过于频繁，请等待 ${remainingTime} 秒后再试。`, { parse_mode: "Markdown" });
        return;
      }

      // Increment request count and proceed
      userLimit.count++;
      await next();
    };
  }

  /**
   * Create admin check middleware
   * @param adminUserIds - Array of admin user IDs
   * @returns Middleware function for admin checking
   */
  static createAdminMiddleware(adminUserIds: number[]): CommandMiddleware {
    return async (ctx: TelegrafContext, next: () => Promise<void>) => {
      const userId = ctx.from?.id;

      if (!userId || !adminUserIds.includes(userId)) {
        await ctx.reply("❌ 此命令需要管理员权限。", { parse_mode: "Markdown" });
        return;
      }

      await next();
    };
  }

  /**
   * Add default security middleware to the router
   */
  private addDefaultSecurityMiddleware(): void {
    // Add basic security middleware with default configuration
    this.addMiddleware(
      this.securityMiddleware.createMiddleware({
        rateLimiting: {
          maxRequests: 10,
          timeWindow: 60000, // 1 minute
          penaltyTime: 300000, // 5 minutes
          useProgressivePenalty: true,
        },
        checkBotPermissions: true,
        validateChatTypes: true,
        allowedChatTypes: ["private", "group", "supergroup", "channel"],
        requireAdmin: false,
        logSecurityEvents: true,
      })
    );
  }

  /**
   * Add security middleware with custom configuration
   * @param config - Security middleware configuration
   */
  addSecurityMiddleware(config?: Partial<import("../middleware/security-middleware").SecurityMiddlewareConfig>): void {
    this.addMiddleware(this.securityMiddleware.createMiddleware(config));
  }

  /**
   * Get security statistics
   * @returns Security middleware statistics
   */
  getSecurityStatistics() {
    return this.securityMiddleware.getStatistics();
  }

  /**
   * Stop the command router and cleanup resources
   */
  stop(): void {
    this.securityMiddleware.stop();
  }
}
