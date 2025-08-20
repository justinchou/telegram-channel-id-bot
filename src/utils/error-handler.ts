// import { Context } from "telegraf";
import { TelegrafContext as Context } from "../types";
import logger from "./logger";
import { ErrorContext } from "../types";

/**
 * Centralized error handling class for the Telegram bot
 * Provides consistent error logging, user-friendly messages, and error recovery
 */
export class ErrorHandler {
  private logger = logger;

  /**
   * Handle errors that occur during command processing
   * @param ctx - Telegram context
   * @param error - The error that occurred
   * @param errorContext - Additional context about the error
   */
  async handleError(ctx: Context, error: Error, errorContext?: ErrorContext): Promise<void> {
    // Log the error with context
    this.logError(error, errorContext);

    // Send user-friendly error message
    await this.sendErrorMessage(ctx, error);
  }

  /**
   * Log error with structured information
   * @param error - The error to log
   * @param errorContext - Additional context about the error
   */
  logError(error: Error, errorContext?: ErrorContext): void {
    const logData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...errorContext,
    };

    this.logger.error("Bot error occurred", logData);
  }

  /**
   * Send appropriate error message to user based on error type
   * @param ctx - Telegram context
   * @param error - The error that occurred
   */
  private async sendErrorMessage(ctx: Context, error: Error): Promise<void> {
    try {
      let userMessage = this.getUserFriendlyMessage(error);

      await ctx.reply(userMessage, {
        parse_mode: "Markdown",
      });
    } catch (replyError) {
      // If we can't send a reply, log it but don't throw
      this.logger.error("Failed to send error message to user", {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : "Unknown error",
        chatId: ctx.chat?.id,
      });
    }
  }

  /**
   * Convert technical errors to user-friendly messages
   * @param error - The error to convert
   * @returns User-friendly error message
   */
  private getUserFriendlyMessage(error: Error): string {
    // Handle specific error types
    if (error.name === "TelegramError") {
      return this.handleTelegramError(error);
    }

    if (error.message.includes("network") || error.message.includes("timeout")) {
      return "🔌 网络连接出现问题，请稍后再试。";
    }

    if (error.message.includes("permission") || error.message.includes("forbidden")) {
      return "❌ Bot 没有足够的权限执行此操作。请检查 Bot 的权限设置。";
    }

    if (error.message.includes("rate limit")) {
      return "⏰ 请求过于频繁，请稍后再试。";
    }

    // Generic error message
    return "❌ 抱歉，处理您的请求时出现了问题。请稍后再试或联系管理员。";
  }

  /**
   * Handle Telegram-specific errors
   * @param error - Telegram error
   * @returns User-friendly message
   */
  private handleTelegramError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("bot was blocked")) {
      return "🚫 Bot 已被阻止。请解除阻止后重试。";
    }

    if (message.includes("chat not found")) {
      return "❌ 找不到指定的聊天。";
    }

    if (message.includes("message is too long")) {
      return "📝 消息太长，请尝试较短的内容。";
    }

    if (message.includes("bad request")) {
      return "❌ 请求格式不正确，请检查命令格式。";
    }

    return "❌ Telegram API 出现问题，请稍后再试。";
  }

  /**
   * Handle critical errors that might require bot restart
   * @param error - Critical error
   * @param context - Error context
   */
  handleCriticalError(error: Error, context?: string): void {
    this.logger.error("Critical error occurred", {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // In production, you might want to send alerts or restart the bot
    if ((globalThis as any).process?.env?.NODE_ENV === "production") {
      this.logger.error("Bot may need to be restarted due to critical error");
    }
  }

  /**
   * Create error context from Telegram context
   * @param ctx - Telegram context
   * @param command - Command being executed
   * @returns Error context object
   */
  createErrorContext(ctx: Context, command?: string): ErrorContext {
    return {
      command,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      metadata: {
        chatType: ctx.chat?.type,
        messageId: ctx.message?.message_id,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
