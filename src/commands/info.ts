import { TelegrafContext, ErrorContext, ChatInfo } from "../types";
import { ChatInfoService } from "../services/chat-info-service";
import { ErrorHandler } from "../utils/error-handler";

/**
 * Chat Info Command Handler
 *
 * Implements Requirements 2.2, 2.3:
 * - 2.2: 用户在群组中发送 "/info" 命令时回复群组的详细信息（包括 chat ID、群组名称、成员数量等）
 * - 2.3: 正确识别不同类型的聊天环境（群组、私聊、频道等）
 */
export class InfoCommandHandler {
  private chatInfoService: ChatInfoService;
  private errorHandler: ErrorHandler;

  constructor() {
    this.chatInfoService = new ChatInfoService();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Handle the /info command
   * @param ctx - Telegraf context object
   */
  async handle(ctx: TelegrafContext): Promise<void> {
    try {
      // Validate context and permissions
      if (!this.validateContext(ctx)) {
        await ctx.reply("❌ 无法获取聊天信息。请确保 Bot 有足够的权限。", { parse_mode: "Markdown" });
        return;
      }

      // Check if bot has necessary permissions
      if (!(await this.checkPermissions(ctx))) {
        await ctx.reply(
          "⚠️ Bot 权限不足，可能无法获取完整的聊天信息。\n\n" +
            "💡 请确保 Bot 是群组管理员或有足够的权限查看群组信息。",
          { parse_mode: "Markdown" }
        );
      }

      // Get comprehensive chat information
      const chatInfo = await this.chatInfoService.getChatInfo(ctx);

      // Format detailed response
      const response = this.formatDetailedChatInfo(chatInfo);

      // Send response to user
      await ctx.reply(response, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "info",
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
   * Format comprehensive chat information into a detailed response
   * @param chatInfo - The chat information to format
   * @returns Formatted detailed response string
   */
  private formatDetailedChatInfo(chatInfo: ChatInfo): string {
    let response = "📊 *详细聊天信息*\n\n";

    // Basic information section
    response += "🔍 *基本信息*\n";
    response += `🆔 **Chat ID:** \`${chatInfo.chatId}\`\n`;

    // Chat type with appropriate emoji and description
    const typeInfo = this.getChatTypeInfo(chatInfo.chatType);
    response += `${typeInfo.emoji} **类型:** ${typeInfo.description}\n`;

    // Title (for groups, supergroups, channels)
    if (chatInfo.title) {
      response += `📝 **标题:** ${chatInfo.title}\n`;
    }

    // Username (if available)
    if (chatInfo.username) {
      response += `🔗 **用户名:** @${chatInfo.username}\n`;
    }

    response += "\n";

    // Additional information section
    response += "📋 *附加信息*\n";

    // Member count (for groups and supergroups)
    if (chatInfo.memberCount !== undefined && chatInfo.memberCount > 0) {
      response += `👥 **成员数量:** ${chatInfo.memberCount}\n`;
    }

    // Description (if available)
    if (chatInfo.description) {
      response += `📄 **描述:** ${chatInfo.description}\n`;
    }

    // Chat type specific information
    response += this.getChatTypeSpecificInfo(chatInfo);

    // Usage tips section
    response += "\n💡 *使用提示*\n";
    response += `• 使用 Chat ID \`${chatInfo.chatId}\` 可以向此聊天发送消息\n`;

    if (chatInfo.chatType === "private") {
      response += "• 这是私聊，只有您和 Bot 可以看到消息\n";
    } else if (chatInfo.chatType === "group" || chatInfo.chatType === "supergroup") {
      response += "• 这是群组聊天，所有成员都可以看到消息\n";
      response += "• 可以使用此 Chat ID 配置其他 Bot 向群组发送消息\n";
    } else if (chatInfo.chatType === "channel") {
      response += "• 这是频道，只有管理员可以发送消息\n";
      response += "• 订阅者可以查看频道内容\n";
    }

    response += "\n🔧 使用 /chatid 命令仅获取 Chat ID。";

    return response;
  }

  /**
   * Get chat type information with emoji and description
   * @param chatType - The type of chat
   * @returns Object with emoji and description
   */
  private getChatTypeInfo(chatType: ChatInfo["chatType"]): { emoji: string; description: string } {
    const typeMap = {
      private: { emoji: "👤", description: "私聊" },
      group: { emoji: "👥", description: "群组" },
      supergroup: { emoji: "👥", description: "超级群组" },
      channel: { emoji: "📢", description: "频道" },
    };

    return typeMap[chatType] || { emoji: "💬", description: "未知类型" };
  }

  /**
   * Get chat type specific information
   * @param chatInfo - The chat information
   * @returns Additional information specific to the chat type
   */
  private getChatTypeSpecificInfo(chatInfo: ChatInfo): string {
    let info = "";

    switch (chatInfo.chatType) {
      case "private":
        info += "🔒 **隐私级别:** 私密聊天\n";
        info += "📱 **访问方式:** 仅限直接消息\n";
        break;

      case "group":
        info += "👥 **群组类型:** 普通群组\n";
        info += "📊 **成员限制:** 最多 200 人\n";
        if (chatInfo.memberCount) {
          const percentage = Math.round((chatInfo.memberCount / 200) * 100);
          info += `📈 **容量使用:** ${percentage}%\n`;
        }
        break;

      case "supergroup":
        info += "👥 **群组类型:** 超级群组\n";
        info += "📊 **成员限制:** 最多 200,000 人\n";
        info += "🔧 **高级功能:** 支持管理员、置顶消息等\n";
        break;

      case "channel":
        info += "📢 **频道类型:** 广播频道\n";
        info += "📊 **订阅者:** 无限制\n";
        info += "📝 **发布权限:** 仅管理员\n";
        break;
    }

    return info;
  }

  /**
   * Validate if the command can be executed in the current context
   * @param ctx - Telegraf context object
   * @returns true if command can be executed, false otherwise
   */
  validateContext(ctx: TelegrafContext): boolean {
    // Check if chat information is available
    if (!ctx.chat) {
      return false;
    }

    // Command can be used in all chat types
    return true;
  }

  /**
   * Check if bot has necessary permissions to get detailed information
   * @param ctx - Telegraf context object
   * @returns Promise<boolean> indicating if bot has sufficient permissions
   */
  private async checkPermissions(ctx: TelegrafContext): Promise<boolean> {
    try {
      // For private chats, no special permissions needed
      if (ctx.chat?.type === "private") {
        return true;
      }

      // For groups and supergroups, try to get more detailed info
      // This is a basic check - in a real implementation, you might want to
      // use getChatMember or getChatAdministrators to check bot permissions

      // For now, we'll assume permissions are available
      // In a real implementation, you would check:
      // - If bot is admin
      // - If bot can read messages
      // - If bot can access member list

      return true;
    } catch (error) {
      // If we can't check permissions, assume limited access
      return false;
    }
  }
}
