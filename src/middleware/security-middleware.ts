import { TelegrafContext } from "../types";
import { SecurityService } from "../services/security-service";
import { RateLimiter, RateLimitConfig } from "../utils/rate-limiter";
import logger from "../utils/logger";

/**
 * Security middleware configuration
 */
export interface SecurityMiddlewareConfig {
  /** Rate limiting configuration */
  rateLimiting?: RateLimitConfig;
  /** Whether to check bot permissions */
  checkBotPermissions?: boolean;
  /** Whether to validate chat types */
  validateChatTypes?: boolean;
  /** Allowed chat types */
  allowedChatTypes?: string[];
  /** Whether to require admin permissions */
  requireAdmin?: boolean;
  /** Whether to log security events */
  logSecurityEvents?: boolean;
}

/**
 * Security Middleware for Telegram Bot
 *
 * Implements Requirements 1.3, 5.2, 5.4:
 * - 1.3: Bot handles permission issues gracefully
 * - 5.2: Bot handles invalid messages gracefully without crashing
 * - 5.4: Bot records permission errors but continues running
 *
 * Features:
 * - Comprehensive rate limiting
 * - Permission validation
 * - Chat type restrictions
 * - Security event logging
 * - Graceful error handling
 */
export class SecurityMiddleware {
  private securityService: SecurityService;
  private rateLimiter: RateLimiter;
  private config: SecurityMiddlewareConfig;

  constructor(config: SecurityMiddlewareConfig = {}) {
    this.config = {
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
      ...config,
    };

    this.securityService = new SecurityService();
    this.rateLimiter = new RateLimiter(this.config.rateLimiting!);
  }

  /**
   * Create security middleware function
   * @param customConfig - Custom configuration for this middleware instance
   * @returns Middleware function
   */
  createMiddleware(customConfig?: Partial<SecurityMiddlewareConfig>) {
    const middlewareConfig = { ...this.config, ...customConfig };

    return async (ctx: TelegrafContext, next: () => Promise<void>) => {
      try {
        // 1. Rate limiting check
        if (middlewareConfig.rateLimiting) {
          const rateLimitResult = await this.checkRateLimit(ctx, middlewareConfig);
          if (rateLimitResult.blocked) {
            return; // Request was blocked and user was notified
          }
        }

        // 2. Chat type validation
        if (middlewareConfig.validateChatTypes) {
          const chatTypeResult = await this.validateChatType(ctx, middlewareConfig);
          if (!chatTypeResult.valid) {
            return; // Request was blocked and user was notified
          }
        }

        // 3. Bot permission check
        if (middlewareConfig.checkBotPermissions) {
          const permissionResult = await this.checkBotPermissions(ctx, middlewareConfig);
          if (!permissionResult.hasPermission) {
            return; // Request was blocked and user was notified
          }
        }

        // 4. Admin permission check (if required)
        if (middlewareConfig.requireAdmin) {
          const adminResult = await this.checkAdminPermissions(ctx, middlewareConfig);
          if (!adminResult.isAdmin) {
            return; // Request was blocked and user was notified
          }
        }

        // 5. Log security event if enabled
        if (middlewareConfig.logSecurityEvents) {
          this.logSecurityEvent(ctx, "command_allowed");
        }

        // All security checks passed, proceed to next middleware/handler
        await next();
      } catch (error) {
        // Handle security middleware errors gracefully
        await this.handleSecurityError(ctx, error, middlewareConfig);
      }
    };
  }

  /**
   * Check rate limiting for the request
   * @param ctx - Telegram context
   * @param config - Middleware configuration
   * @returns Rate limit check result
   */
  private async checkRateLimit(ctx: TelegrafContext, config: SecurityMiddlewareConfig): Promise<{ blocked: boolean }> {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!userId) {
      logger.warn("Cannot apply rate limiting - missing user ID", {
        chatId,
      });
      return { blocked: false };
    }

    const rateLimitResult = this.rateLimiter.checkRateLimit(userId, chatId, config.rateLimiting);

    if (rateLimitResult.isLimited) {
      const remainingTime = rateLimitResult.remainingTime || 0;
      let message = "";

      switch (rateLimitResult.reason) {
        case "penalty":
          message = `🚫 您因频繁请求被暂时限制。请等待 ${remainingTime} 秒后再试。`;
          break;
        case "rate_limit":
          message = `⏰ 请求过于频繁，请等待 ${remainingTime} 秒后再试。`;
          break;
        case "chat_limit":
          message = `⚠️ 此聊天的请求过于频繁，请等待 ${remainingTime} 秒后再试。`;
          break;
        default:
          message = `⏰ 请求被限制，请等待 ${remainingTime} 秒后再试。`;
      }

      try {
        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (replyError) {
        logger.error("Failed to send rate limit message", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          userId,
          chatId,
        });
      }

      // Log rate limit event
      this.securityService.logSecurityEvent("rate_limit_exceeded", ctx, {
        reason: rateLimitResult.reason,
        remainingTime,
      });

      return { blocked: true };
    }

    return { blocked: false };
  }

  /**
   * Validate chat type for the request
   * @param ctx - Telegram context
   * @param config - Middleware configuration
   * @returns Chat type validation result
   */
  private async validateChatType(ctx: TelegrafContext, config: SecurityMiddlewareConfig): Promise<{ valid: boolean }> {
    const isValid = this.securityService.validateChatType(ctx, config.allowedChatTypes);

    if (!isValid) {
      const chatType = ctx.chat?.type;
      const allowedTypes = config.allowedChatTypes || [];

      const typeNames: Record<string, string> = {
        private: "私聊",
        group: "群组",
        supergroup: "超级群组",
        channel: "频道",
      };

      const allowedTypeNames = allowedTypes.map((type) => typeNames[type] || type).join("、");

      const message =
        `❌ 此功能不能在当前聊天类型（${typeNames[chatType || "未知"]}）中使用。\n\n` +
        `💡 支持的聊天类型：${allowedTypeNames}`;

      try {
        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (replyError) {
        logger.error("Failed to send chat type validation message", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          chatId: ctx.chat?.id,
          chatType,
        });
      }

      // Log chat type validation failure
      this.securityService.logSecurityEvent("invalid_chat_type", ctx, {
        chatType,
        allowedTypes: config.allowedChatTypes,
      });

      return { valid: false };
    }

    return { valid: true };
  }

  /**
   * Check bot permissions for the request
   * @param ctx - Telegram context
   * @param config - Middleware configuration
   * @returns Bot permission check result
   */
  private async checkBotPermissions(
    ctx: TelegrafContext,
    _config: SecurityMiddlewareConfig
  ): Promise<{ hasPermission: boolean }> {
    const hasPermission = await this.securityService.checkBotPermissions(ctx);

    if (!hasPermission) {
      const chatType = ctx.chat?.type;
      let message = "❌ Bot 没有足够的权限执行此操作。\n\n";

      if (chatType === "group" || chatType === "supergroup") {
        message += "💡 请确保：\n" + "• Bot 是群组成员\n" + "• Bot 有发送消息的权限\n" + "• Bot 没有被限制";
      } else if (chatType === "channel") {
        message += "💡 请确保：\n" + "• Bot 是频道管理员\n" + "• Bot 有发送消息的权限";
      } else {
        message += "💡 请检查 Bot 的权限设置。";
      }

      try {
        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (replyError) {
        // If we can't send a message, it confirms the permission issue
        logger.error("Failed to send permission error message (confirms permission issue)", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          chatId: ctx.chat?.id,
          chatType,
        });
      }

      // Log permission issue
      this.securityService.logSecurityEvent("insufficient_bot_permissions", ctx, {
        chatType,
      });

      return { hasPermission: false };
    }

    return { hasPermission: true };
  }

  /**
   * Check admin permissions for the request
   * @param ctx - Telegram context
   * @param config - Middleware configuration
   * @returns Admin permission check result
   */
  private async checkAdminPermissions(
    ctx: TelegrafContext,
    _config: SecurityMiddlewareConfig
  ): Promise<{ isAdmin: boolean }> {
    const isAdmin = await this.securityService.checkUserAdminPermissions(ctx);

    if (!isAdmin) {
      const message = "❌ 此命令需要管理员权限。\n\n" + "💡 只有群组管理员或创建者可以使用此功能。";

      try {
        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (replyError) {
        logger.error("Failed to send admin permission error message", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          chatId: ctx.chat?.id,
          userId: ctx.from?.id,
        });
      }

      // Log admin permission denial
      this.securityService.logSecurityEvent("admin_permission_denied", ctx, {
        userId: ctx.from?.id,
      });

      return { isAdmin: false };
    }

    return { isAdmin: true };
  }

  /**
   * Log security event
   * @param ctx - Telegram context
   * @param event - Event type
   */
  private logSecurityEvent(ctx: TelegrafContext, event: string): void {
    this.securityService.logSecurityEvent(event, ctx, {
      command: this.extractCommand(ctx),
    });
  }

  /**
   * Extract command from context
   * @param ctx - Telegram context
   * @returns Command name or null
   */
  private extractCommand(ctx: TelegrafContext): string | null {
    const message = (ctx.message as any)?.text;
    if (!message || !message.startsWith("/")) {
      return null;
    }

    const commandMatch = message.match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?/);
    return commandMatch ? commandMatch[1].toLowerCase() : null;
  }

  /**
   * Handle security middleware errors
   * @param ctx - Telegram context
   * @param error - Error that occurred
   * @param config - Middleware configuration
   */
  private async handleSecurityError(
    ctx: TelegrafContext,
    error: unknown,
    config: SecurityMiddlewareConfig
  ): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    logger.error("Security middleware error", {
      error: errorObj.message,
      stack: errorObj.stack,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });

    // Send sanitized error message to user
    const sanitizedMessage = this.securityService.sanitizeErrorMessage(errorObj, ctx);

    try {
      await ctx.reply(sanitizedMessage, { parse_mode: "Markdown" });
    } catch (replyError) {
      logger.error("Failed to send security error message", {
        originalError: errorObj.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
        chatId: ctx.chat?.id,
      });
    }

    // Log security error event
    if (config.logSecurityEvents) {
      this.securityService.logSecurityEvent("security_middleware_error", ctx, {
        error: errorObj.message,
      });
    }
  }

  /**
   * Get rate limiter statistics
   * @returns Rate limiter statistics
   */
  getStatistics() {
    return this.rateLimiter.getStatistics();
  }

  /**
   * Stop the security middleware and cleanup resources
   */
  stop(): void {
    this.rateLimiter.stop();
    logger.info("Security middleware stopped");
  }
}
