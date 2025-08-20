import { TelegrafContext, ErrorContext } from "../types";
import { HelpService } from "../services/help-service";
import { ErrorHandler } from "../utils/error-handler";

/**
 * Help Command Handler
 *
 * Implements Requirements 4.1, 4.2, 4.3:
 * - 4.1: 用户发送 "/help" 命令时回复可用命令列表和使用说明
 * - 4.2: 用户发送 "/start" 命令时回复欢迎消息和基本使用指南
 * - 4.3: 用户发送未知命令时提示使用 "/help" 查看可用命令
 */
export class HelpCommandHandler {
  private helpService: HelpService;
  private errorHandler: ErrorHandler;

  constructor() {
    this.helpService = new HelpService();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Handle the /help command
   * @param ctx - Telegraf context object
   */
  async handleHelp(ctx: TelegrafContext): Promise<void> {
    try {
      // Get help message from service
      const helpMessage = this.helpService.getHelpMessage();

      // Send help message to user
      await ctx.reply(helpMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "help",
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
   * Handle the /start command
   * @param ctx - Telegraf context object
   */
  async handleStart(ctx: TelegrafContext): Promise<void> {
    try {
      // Get start message from service
      const startMessage = this.helpService.getStartMessage();

      // Send welcome message to user
      await ctx.reply(startMessage, {
        parse_mode: "Markdown",
      });

      // Log successful start command for analytics
      this.logStartCommand(ctx);
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "start",
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
   * Handle unknown commands
   * @param ctx - Telegraf context object
   * @param unknownCommand - The unknown command that was sent
   */
  async handleUnknownCommand(ctx: TelegrafContext, unknownCommand?: string): Promise<void> {
    try {
      // Get unknown command message from service
      let unknownMessage = this.helpService.getUnknownCommandMessage();

      // Add the specific unknown command if provided
      if (unknownCommand) {
        unknownMessage = `❓ *未知命令: ${unknownCommand}*\n\n` + unknownMessage;
      }

      // Send unknown command message to user
      await ctx.reply(unknownMessage, {
        parse_mode: "Markdown",
      });

      // Log unknown command for analytics and improvement
      this.logUnknownCommand(ctx, unknownCommand);
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "unknown",
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        metadata: {
          chatType: ctx.chat?.type,
          unknownCommand: unknownCommand,
          timestamp: new Date().toISOString(),
        },
      };

      // Handle error using centralized error handler
      await this.errorHandler.handleError(ctx, error instanceof Error ? error : new Error(String(error)), errorContext);
    }
  }

  /**
   * Handle bot being added to a group
   * @param ctx - Telegraf context object
   */
  async handleBotAddedToGroup(ctx: TelegrafContext): Promise<void> {
    try {
      // Check if this is a group or supergroup
      if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
        return;
      }

      // Create welcome message for groups
      const groupWelcomeMessage = this.createGroupWelcomeMessage(ctx);

      // Send welcome message to the group
      await ctx.reply(groupWelcomeMessage, {
        parse_mode: "Markdown",
      });

      // Log bot addition for analytics
      this.logBotAddedToGroup(ctx);
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "bot_added",
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
   * Create a welcome message specifically for when bot is added to groups
   * @param ctx - Telegraf context object
   * @returns Formatted welcome message for groups
   */
  private createGroupWelcomeMessage(ctx: TelegrafContext): string {
    const chatTitle = (ctx.chat as any)?.title || "群组";

    return `👋 *欢迎！我已加入 ${chatTitle}*

🤖 我是 Chat ID Bot，可以帮助您获取群组的 Chat ID 和详细信息。

🚀 *快速开始：*
• /chatid - 获取当前群组的 Chat ID
• /info - 获取群组的详细信息
• /help - 查看所有可用命令

💡 *提示：* Chat ID 是群组的唯一标识符，开发者可以使用它来配置 Bot 向群组发送消息。

如有任何问题，请使用 /help 命令查看详细说明。`;
  }

  /**
   * Validate if the command can be executed in the current context
   * @param _ctx - Telegraf context object (unused for help commands)
   * @returns true if command can be executed, false otherwise
   */
  validateContext(_ctx: TelegrafContext): boolean {
    // Help commands can be used in all contexts
    return true;
  }

  /**
   * Log start command usage for analytics
   * @param ctx - Telegraf context object
   */
  private logStartCommand(ctx: TelegrafContext): void {
    // In a production environment, you might want to log this to analytics
    // For now, we'll use the error handler's logger
    this.errorHandler.logError(
      new Error("Start command used"), // Using Error for logging, not an actual error
      {
        command: "start",
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        metadata: {
          chatType: ctx.chat?.type,
          level: "info", // This is informational, not an error
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Log unknown command for analytics and improvement
   * @param ctx - Telegraf context object
   * @param unknownCommand - The unknown command that was sent
   */
  private logUnknownCommand(ctx: TelegrafContext, unknownCommand?: string): void {
    // Log unknown commands to help improve the bot
    this.errorHandler.logError(
      new Error("Unknown command used"), // Using Error for logging, not an actual error
      {
        command: "unknown",
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        metadata: {
          chatType: ctx.chat?.type,
          unknownCommand: unknownCommand,
          level: "info", // This is informational, not an error
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Log bot being added to group for analytics
   * @param ctx - Telegraf context object
   */
  private logBotAddedToGroup(ctx: TelegrafContext): void {
    // Log bot additions to track growth and usage
    this.errorHandler.logError(
      new Error("Bot added to group"), // Using Error for logging, not an actual error
      {
        command: "bot_added",
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        metadata: {
          chatType: ctx.chat?.type,
          chatTitle: (ctx.chat as any)?.title,
          level: "info", // This is informational, not an error
          timestamp: new Date().toISOString(),
        },
      }
    );
  }
}
