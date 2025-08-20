// @ts-ignore - Telegraf types may not be available in all environments
const { Telegraf } = require("telegraf");
import { TelegrafContext, BotConfig } from "../types";
import { CommandRouter } from "../commands/command-router";
import { ErrorHandler } from "../utils/error-handler";
import logger from "../utils/logger";

/**
 * Main Telegram Bot Handler
 *
 * Implements Requirements 1.1, 1.2, 1.3, 5.1, 5.2:
 * - 1.1: Bot successfully joins groups and remains active
 * - 1.2: Bot sends welcome message when added to groups
 * - 1.3: Bot handles permission issues gracefully
 * - 5.1: Bot automatically retries on network issues and logs errors
 * - 5.2: Bot handles invalid messages gracefully without crashing
 *
 * Features:
 * - Telegraf instance configuration and management
 * - Command router integration
 * - Global error handling middleware
 * - Bot lifecycle management (start/stop)
 * - Welcome message handling for new group additions
 * - Graceful shutdown handling
 */
export class TelegramBot {
  private bot: any;
  private commandRouter: CommandRouter;
  private errorHandler: ErrorHandler;
  private config: BotConfig;
  private isRunning: boolean = false;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Telegraf(config.token);
    this.commandRouter = new CommandRouter();
    this.errorHandler = new ErrorHandler();

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Start the bot
   * Implements requirement 1.1: Bot successfully joins groups and remains active
   */
  async start(): Promise<void> {
    try {
      logger.info("Starting Telegram bot...", {
        botToken: this.config.token.substring(0, 10) + "...",
        logLevel: this.config.logLevel,
      });

      // Verify bot token and get bot info
      const botInfo = await this.bot.telegram.getMe();
      logger.info("Bot authenticated successfully", {
        botId: botInfo.id,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
      });

      // Start polling for updates
      await this.bot.launch();
      this.isRunning = true;

      logger.info("Bot started successfully and is now listening for messages", {
        botUsername: botInfo.username,
      });

      // Set up graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to start bot", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Handle specific startup errors
      if (errorMessage.includes("401")) {
        throw new Error("Invalid bot token. Please check your TELEGRAM_BOT_TOKEN environment variable.");
      }

      if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
        throw new Error("Network connection failed. Please check your internet connection and try again.");
      }

      throw new Error(`Bot startup failed: ${errorMessage}`);
    }
  }

  /**
   * Stop the bot gracefully
   * Implements requirement 5.1: Proper error handling and logging
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.warn("Bot is not running, nothing to stop");
        return;
      }

      logger.info("Stopping bot gracefully...");

      // Stop command router and cleanup security resources
      this.commandRouter.stop();

      // Stop the bot
      this.bot.stop();
      this.isRunning = false;

      logger.info("Bot stopped successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Error occurred while stopping bot", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Check if bot is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get bot information
   */
  async getBotInfo() {
    try {
      return await this.bot.telegram.getMe();
    } catch (error) {
      logger.error("Failed to get bot info", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get security statistics from command router
   */
  getSecurityStatistics() {
    return this.commandRouter.getSecurityStatistics();
  }

  /**
   * Setup middleware for the bot
   * Implements requirement 5.2: Bot handles invalid messages gracefully
   */
  private setupMiddleware(): void {
    // Global error handling middleware
    this.bot.catch(async (err: any, ctx: any) => {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorContext = this.errorHandler.createErrorContext(ctx as TelegrafContext);

      logger.error("Unhandled bot error", {
        error: error.message,
        stack: error.stack,
        ...errorContext,
      });

      await this.errorHandler.handleError(ctx as TelegrafContext, error, errorContext);
    });

    // Logging middleware for all updates
    this.bot.use(async (ctx: any, next: () => Promise<void>) => {
      const startTime = Date.now();

      try {
        await next();

        const duration = Date.now() - startTime;
        logger.debug("Update processed successfully", {
          updateType: ctx.updateType,
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          userId: ctx.from?.id,
          duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("Error processing update", {
          updateType: ctx.updateType,
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          userId: ctx.from?.id,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    // Add command router middleware with enhanced security
    this.commandRouter.addMiddleware(CommandRouter.createLoggingMiddleware());

    // Route all text messages through command router
    this.bot.on("text", async (ctx: any) => {
      await this.commandRouter.routeCommand(ctx as TelegrafContext);
    });
  }

  /**
   * Setup event handlers for bot lifecycle events
   * Implements requirements 1.2, 1.3: Welcome messages and permission handling
   */
  private setupEventHandlers(): void {
    // Handle bot being added to groups
    // Implements requirement 1.2: Bot sends welcome message when added to groups
    this.bot.on("my_chat_member", async (ctx: any) => {
      try {
        const update = ctx.myChatMember;
        const newStatus = update.new_chat_member.status;
        const oldStatus = update.old_chat_member.status;

        // Bot was added to a group
        if (
          (oldStatus === "left" || oldStatus === "kicked") &&
          (newStatus === "member" || newStatus === "administrator")
        ) {
          logger.info("Bot added to new chat", {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            chatTitle: (ctx.chat as any).title,
            newStatus,
          });

          // Send welcome message
          await this.sendWelcomeMessage(ctx as TelegrafContext);
        }

        // Bot was removed from group
        if (
          (newStatus === "left" || newStatus === "kicked") &&
          (oldStatus === "member" || oldStatus === "administrator")
        ) {
          logger.info("Bot removed from chat", {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            chatTitle: (ctx.chat as any).title,
            newStatus,
          });
        }

        // Bot permissions changed
        if (newStatus === "restricted") {
          logger.warn("Bot permissions restricted", {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            permissions: update.new_chat_member,
          });
        }
      } catch (error) {
        logger.error("Error handling chat member update", {
          error: error instanceof Error ? error.message : String(error),
          chatId: ctx.chat?.id,
        });
      }
    });

    // Handle new members (including bot) being added to groups
    this.bot.on("new_chat_members", async (ctx: any) => {
      try {
        const botInfo = await this.bot.telegram.getMe();
        const newMembers = ctx.message.new_chat_members;

        // Check if bot was added
        const botAdded = newMembers?.some((member: any) => member.id === botInfo.id);

        if (botAdded) {
          logger.info("Bot added to group via new_chat_members", {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            chatTitle: (ctx.chat as any).title,
          });

          await this.sendWelcomeMessage(ctx as TelegrafContext);
        }
      } catch (error) {
        logger.error("Error handling new chat members", {
          error: error instanceof Error ? error.message : String(error),
          chatId: ctx.chat?.id,
        });
      }
    });

    // Handle inline queries (optional feature)
    this.bot.on("inline_query", async (ctx: any) => {
      try {
        // Provide inline query results for chat ID lookup
        await ctx.answerInlineQuery([
          {
            type: "article",
            id: "chatid",
            title: "获取当前聊天 ID",
            description: "点击获取当前聊天的 Chat ID",
            input_message_content: {
              message_text: `当前聊天 ID: \`${ctx.chat?.id || "未知"}\``,
              parse_mode: "Markdown",
            },
          },
        ]);
      } catch (error) {
        logger.error("Error handling inline query", {
          error: error instanceof Error ? error.message : String(error),
          queryId: ctx.inlineQuery.id,
        });
      }
    });
  }

  /**
   * Send welcome message when bot is added to a group
   * Implements requirement 1.2: Bot sends welcome message when added to groups
   */
  private async sendWelcomeMessage(ctx: TelegrafContext): Promise<void> {
    try {
      const chatType = ctx.chat?.type;
      let welcomeMessage = "";

      if (chatType === "group" || chatType === "supergroup") {
        welcomeMessage = `🎉 **欢迎使用 Chat ID Bot！**

我已成功加入这个${chatType === "supergroup" ? "超级群组" : "群组"}！

**可用命令：**
• \`/chatid\` - 获取当前群组的 Chat ID
• \`/info\` - 获取群组的详细信息
• \`/help\` - 查看所有可用命令

**使用提示：**
• 在群组中直接发送命令即可使用
• 所有成员都可以使用这些命令
• 如需帮助，请发送 \`/help\` 命令

开始使用吧！发送 \`/chatid\` 获取这个群组的 ID。`;
      } else if (chatType === "private") {
        welcomeMessage = `👋 **欢迎使用 Chat ID Bot！**

**可用命令：**
• \`/chatid\` - 获取当前私聊的 Chat ID
• \`/info\` - 获取聊天的详细信息
• \`/help\` - 查看所有可用命令
• \`/start\` - 显示欢迎信息

将我添加到群组中，我可以帮助您获取群组的 Chat ID！`;
      } else {
        welcomeMessage = `🤖 **Chat ID Bot 已就绪**

发送 \`/help\` 查看可用命令。`;
      }

      await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
    } catch (error) {
      // Implements requirement 1.3: Handle permission issues gracefully
      if (error instanceof Error && error.message.includes("forbidden")) {
        logger.warn("Cannot send welcome message - insufficient permissions", {
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          error: error.message,
        });
      } else {
        logger.error("Failed to send welcome message", {
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Setup graceful shutdown handlers
   * Implements requirement 5.1: Proper error handling and logging
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await this.stop();
        (globalThis as any).process?.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown", {
          error: error instanceof Error ? error.message : String(error),
        });
        (globalThis as any).process?.exit(1);
      }
    };

    // Handle various shutdown signals
    const proc = (globalThis as any).process;
    if (proc) {
      proc.once("SIGINT", () => shutdownHandler("SIGINT"));
      proc.once("SIGTERM", () => shutdownHandler("SIGTERM"));

      // Handle uncaught exceptions
      proc.on("uncaughtException", (error: any) => {
        logger.error("Uncaught exception", {
          error: error.message,
          stack: error.stack,
        });

        // Try to shutdown gracefully
        this.stop().finally(() => {
          proc.exit(1);
        });
      });

      // Handle unhandled promise rejections
      proc.on("unhandledRejection", (reason: any, promise: any) => {
        logger.error("Unhandled promise rejection", {
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
          promise: promise.toString(),
        });
      });
    }
  }
}
