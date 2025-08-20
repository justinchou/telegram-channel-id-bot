import { TelegrafContext, ErrorContext } from "../types";
import { ChatInfoService } from "../services/chat-info-service";
import { ErrorHandler } from "../utils/error-handler";

/**
 * Chat ID Command Handler
 *
 * Implements Requirements 2.1, 2.2:
 * - 2.1: 用户在群组中发送 "/chatid" 命令时回复当前群组的 chat ID
 * - 2.2: 用户在私聊中使用命令时回复私聊的 chat ID
 */
export class ChatIdCommandHandler {
  private chatInfoService: ChatInfoService;
  private errorHandler: ErrorHandler;

  constructor() {
    this.chatInfoService = new ChatInfoService();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Handle the /chatid command
   * @param ctx - Telegraf context object
   */
  async handle(ctx: TelegrafContext): Promise<void> {
    try {
      // Validate context
      if (!ctx.chat) {
        throw new Error("Chat information not available");
      }

      // Get chat ID using the service
      const chatId = await this.chatInfoService.getChatId(ctx);

      // Format response based on chat type
      const response = this.formatChatIdResponse(chatId, ctx.chat.type);

      // Send response to user
      await ctx.reply(response, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      // Create error context for logging
      const errorContext: ErrorContext = {
        command: "chatid",
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
   * Format the chat ID response based on chat type
   * @param chatId - The chat ID to display
   * @param chatType - The type of chat (private, group, supergroup, channel)
   * @returns Formatted response string
   */
  private formatChatIdResponse(chatId: string, chatType: string): string {
    const typeEmojis: Record<string, string> = {
      private: "👤",
      group: "👥",
      supergroup: "👥",
      channel: "📢",
    };

    const emoji = typeEmojis[chatType] || "💬";

    let response = `${emoji} *Chat ID Information*\n\n`;
    response += `🆔 **Chat ID:** \`${chatId}\`\n`;

    // Add chat type specific information
    switch (chatType) {
      case "private":
        response += `📱 **Type:** Private Chat\n\n`;
        response += `💡 这是您与 Bot 的私聊 ID。`;
        break;
      case "group":
        response += `👥 **Type:** Group Chat\n\n`;
        response += `💡 这是当前群组的 Chat ID。您可以使用此 ID 向群组发送消息。`;
        break;
      case "supergroup":
        response += `👥 **Type:** Supergroup\n\n`;
        response += `💡 这是当前超级群组的 Chat ID。您可以使用此 ID 向群组发送消息。`;
        break;
      case "channel":
        response += `📢 **Type:** Channel\n\n`;
        response += `💡 这是当前频道的 Chat ID。您可以使用此 ID 向频道发送消息。`;
        break;
      default:
        response += `💬 **Type:** ${chatType}\n\n`;
        response += `💡 这是当前聊天的 Chat ID。`;
    }

    response += `\n\n🔧 使用 /info 命令获取更详细的聊天信息。`;

    return response;
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
}
