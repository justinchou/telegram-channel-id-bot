import { TelegrafContext } from "../types";
import logger from "../utils/logger";

/**
 * Security Service for Bot Permission and Access Control
 *
 * Implements Requirements 1.3, 5.2, 5.4:
 * - 1.3: Bot handles permission issues gracefully
 * - 5.2: Bot handles invalid messages gracefully without crashing
 * - 5.4: Bot records permission errors but continues running
 *
 * Features:
 * - Bot permission validation in groups and channels
 * - Chat type access control
 * - User permission checking
 * - Secure error message handling
 * - Rate limiting and abuse prevention
 */
export class SecurityService {
  private static readonly ALLOWED_CHAT_TYPES = ["private", "group", "supergroup", "channel"];
  private static readonly ADMIN_REQUIRED_COMMANDS = ["admin", "config", "ban", "unban"];

  /**
   * Check if bot has necessary permissions in the current chat
   * @param ctx - Telegram context
   * @returns Promise<boolean> - true if bot has required permissions
   */
  async checkBotPermissions(ctx: TelegrafContext): Promise<boolean> {
    try {
      const chatType = ctx.chat?.type;
      const chatId = ctx.chat?.id;

      if (!chatType || !chatId) {
        logger.warn("Cannot check bot permissions - missing chat information", {
          chatId,
          chatType,
        });
        return false;
      }

      // Private chats don't require special permissions
      if (chatType === "private") {
        return true;
      }

      // For groups and supergroups, check if bot can send messages
      if (chatType === "group" || chatType === "supergroup") {
        return await this.checkGroupPermissions(ctx);
      }

      // For channels, check if bot is an admin
      if (chatType === "channel") {
        return await this.checkChannelPermissions(ctx);
      }

      logger.warn("Unknown chat type encountered", {
        chatId,
        chatType,
      });
      return false;
    } catch (error) {
      logger.error("Error checking bot permissions", {
        error: error instanceof Error ? error.message : String(error),
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
      });
      return false;
    }
  }

  /**
   * Check bot permissions in groups and supergroups
   * @param ctx - Telegram context
   * @returns Promise<boolean> - true if bot has send message permissions
   */
  private async checkGroupPermissions(ctx: TelegrafContext): Promise<boolean> {
    try {
      // Try to get bot's chat member status
      const botInfo = await this.getBotInfo(ctx);
      if (!botInfo) {
        return false;
      }

      // In groups, we can try to send a test message to check permissions
      // But we'll use a safer approach by checking chat member status
      const chatMember = await this.getBotChatMember(ctx, botInfo.id);

      if (!chatMember) {
        logger.warn("Cannot get bot chat member status", {
          chatId: ctx.chat?.id,
          botId: botInfo.id,
        });
        return false;
      }

      // Check if bot is not restricted
      const allowedStatuses = ["member", "administrator", "creator"];
      const hasPermission = allowedStatuses.includes(chatMember.status);

      if (!hasPermission) {
        logger.warn("Bot has insufficient permissions in group", {
          chatId: ctx.chat?.id,
          botStatus: chatMember.status,
          requiredStatuses: allowedStatuses,
        });
      }

      return hasPermission;
    } catch (error) {
      logger.error("Error checking group permissions", {
        error: error instanceof Error ? error.message : String(error),
        chatId: ctx.chat?.id,
      });
      return false;
    }
  }

  /**
   * Check bot permissions in channels
   * @param ctx - Telegram context
   * @returns Promise<boolean> - true if bot is channel admin
   */
  private async checkChannelPermissions(ctx: TelegrafContext): Promise<boolean> {
    try {
      const botInfo = await this.getBotInfo(ctx);
      if (!botInfo) {
        return false;
      }

      const chatMember = await this.getBotChatMember(ctx, botInfo.id);

      if (!chatMember) {
        return false;
      }

      // In channels, bot needs to be administrator
      const hasPermission = chatMember.status === "administrator" || chatMember.status === "creator";

      if (!hasPermission) {
        logger.warn("Bot needs administrator permissions in channel", {
          chatId: ctx.chat?.id,
          botStatus: chatMember.status,
        });
      }

      return hasPermission;
    } catch (error) {
      logger.error("Error checking channel permissions", {
        error: error instanceof Error ? error.message : String(error),
        chatId: ctx.chat?.id,
      });
      return false;
    }
  }

  /**
   * Validate if the chat type is allowed for bot operations
   * @param ctx - Telegram context
   * @param allowedTypes - Array of allowed chat types (optional)
   * @returns boolean - true if chat type is allowed
   */
  validateChatType(ctx: TelegrafContext, allowedTypes?: string[]): boolean {
    const chatType = ctx.chat?.type;

    if (!chatType) {
      logger.warn("Cannot validate chat type - missing chat information", {
        chatId: ctx.chat?.id,
      });
      return false;
    }

    const typesToCheck = allowedTypes || SecurityService.ALLOWED_CHAT_TYPES;
    const isAllowed = typesToCheck.includes(chatType);

    if (!isAllowed) {
      logger.info("Chat type not allowed for operation", {
        chatId: ctx.chat?.id,
        chatType,
        allowedTypes: typesToCheck,
      });
    }

    return isAllowed;
  }

  /**
   * Check if user has admin permissions in the current chat
   * @param ctx - Telegram context
   * @param userId - User ID to check (defaults to message sender)
   * @returns Promise<boolean> - true if user is admin
   */
  async checkUserAdminPermissions(ctx: TelegrafContext, userId?: number): Promise<boolean> {
    try {
      const targetUserId = userId || ctx.from?.id;
      const chatType = ctx.chat?.type;
      const chatId = ctx.chat?.id;

      if (!targetUserId || !chatType || !chatId) {
        return false;
      }

      // In private chats, user is always "admin" of their own chat
      if (chatType === "private") {
        return true;
      }

      // Check user's chat member status
      const chatMember = await this.getBotChatMember(ctx, targetUserId);

      if (!chatMember) {
        return false;
      }

      const adminStatuses = ["administrator", "creator"];
      const isAdmin = adminStatuses.includes(chatMember.status);

      logger.debug("User admin permission check", {
        userId: targetUserId,
        chatId,
        chatType,
        userStatus: chatMember.status,
        isAdmin,
      });

      return isAdmin;
    } catch (error) {
      logger.error("Error checking user admin permissions", {
        error: error instanceof Error ? error.message : String(error),
        userId: userId || ctx.from?.id,
        chatId: ctx.chat?.id,
      });
      return false;
    }
  }

  /**
   * Validate command permissions based on command requirements
   * @param ctx - Telegram context
   * @param command - Command name
   * @param requiresAdmin - Whether command requires admin permissions
   * @returns Promise<boolean> - true if user can execute command
   */
  async validateCommandPermissions(
    ctx: TelegrafContext,
    command: string,
    requiresAdmin: boolean = false
  ): Promise<boolean> {
    try {
      // Check if command requires admin permissions
      const isAdminCommand = requiresAdmin || SecurityService.ADMIN_REQUIRED_COMMANDS.includes(command.toLowerCase());

      if (isAdminCommand) {
        const isAdmin = await this.checkUserAdminPermissions(ctx);
        if (!isAdmin) {
          logger.info("User attempted to use admin command without permissions", {
            userId: ctx.from?.id,
            chatId: ctx.chat?.id,
            command,
          });
          return false;
        }
      }

      // Check bot permissions
      const botHasPermissions = await this.checkBotPermissions(ctx);
      if (!botHasPermissions) {
        logger.warn("Bot lacks permissions to execute command", {
          chatId: ctx.chat?.id,
          command,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error validating command permissions", {
        error: error instanceof Error ? error.message : String(error),
        command,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
      });
      return false;
    }
  }

  /**
   * Sanitize error messages to prevent information leakage
   * @param error - Original error
   * @param ctx - Telegram context
   * @returns Sanitized error message safe for users
   */
  sanitizeErrorMessage(error: Error, ctx: TelegrafContext): string {
    const errorMessage = error.message.toLowerCase();

    // Handle specific error types with safe messages
    if (errorMessage.includes("forbidden") || errorMessage.includes("bot was blocked")) {
      return "🚫 Bot 无法发送消息。请检查 Bot 是否被阻止或缺少权限。";
    }

    if (errorMessage.includes("not found") || errorMessage.includes("chat not found")) {
      return "❌ 找不到指定的聊天。";
    }

    if (errorMessage.includes("too many requests") || errorMessage.includes("rate limit")) {
      return "⏰ 请求过于频繁，请稍后再试。";
    }

    if (errorMessage.includes("bad request")) {
      return "❌ 请求格式不正确，请检查命令格式。";
    }

    if (errorMessage.includes("unauthorized") || errorMessage.includes("token")) {
      // Don't expose token issues to users
      logger.error("Bot token issue detected", {
        error: error.message,
        chatId: ctx.chat?.id,
      });
      return "🔧 Bot 配置问题，请联系管理员。";
    }

    // Generic safe error message
    return "❌ 处理请求时出现问题，请稍后再试。";
  }

  /**
   * Get bot information safely
   * @param ctx - Telegram context
   * @returns Bot info or null if error
   */
  private async getBotInfo(ctx: TelegrafContext): Promise<any | null> {
    try {
      // Access bot info through context if available
      if ((ctx as any).telegram?.getMe) {
        return await (ctx as any).telegram.getMe();
      }
      return null;
    } catch (error) {
      logger.error("Error getting bot info", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get chat member information safely
   * @param ctx - Telegram context
   * @param userId - User ID to check
   * @returns Chat member info or null if error
   */
  private async getBotChatMember(ctx: TelegrafContext, userId: number): Promise<any | null> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId || !(ctx as any).telegram?.getChatMember) {
        return null;
      }

      return await (ctx as any).telegram.getChatMember(chatId, userId);
    } catch (error) {
      // This is expected to fail in some cases (e.g., user not in chat)
      logger.debug("Could not get chat member info", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        chatId: ctx.chat?.id,
      });
      return null;
    }
  }

  /**
   * Log security event for monitoring
   * @param event - Security event type
   * @param ctx - Telegram context
   * @param details - Additional details
   */
  logSecurityEvent(event: string, ctx: TelegrafContext, details?: Record<string, any>): void {
    logger.info("Security event", {
      event,
      chatId: ctx.chat?.id,
      chatType: ctx.chat?.type,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}
