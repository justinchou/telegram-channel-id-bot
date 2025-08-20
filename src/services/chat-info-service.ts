import { ChatInfo, TelegrafContext } from "../types";

/**
 * Service for handling chat information retrieval and formatting
 * Provides methods to get chat IDs, detailed chat information, and format responses
 */
export class ChatInfoService {
  /**
   * Get the chat ID from the Telegram context
   * @param ctx - Telegraf context object
   * @returns Promise resolving to the chat ID as a string
   * @throws Error if chat information is not available
   */
  async getChatId(ctx: TelegrafContext): Promise<string> {
    if (!ctx.chat) {
      throw new Error("Chat information not available in context");
    }

    return ctx.chat.id.toString();
  }

  /**
   * Get comprehensive chat information from the Telegram context
   * @param ctx - Telegraf context object
   * @returns Promise resolving to ChatInfo object with detailed information
   * @throws Error if chat information is not available
   */
  async getChatInfo(ctx: TelegrafContext): Promise<ChatInfo> {
    if (!ctx.chat) {
      throw new Error("Chat information not available in context");
    }

    const chat = ctx.chat as any; // Type assertion for accessing additional properties

    // Determine chat type and normalize it
    let chatType: ChatInfo["chatType"];
    switch (chat.type) {
      case "private":
        chatType = "private";
        break;
      case "group":
        chatType = "group";
        break;
      case "supergroup":
        chatType = "supergroup";
        break;
      case "channel":
        chatType = "channel";
        break;
      default:
        chatType = "group"; // Default fallback
    }

    const chatInfo: ChatInfo = {
      chatId: chat.id,
      chatType: chatType,
      title: chat.title,
      username: chat.username,
      memberCount: chat.members_count,
      description: chat.description,
    };

    return chatInfo;
  }

  /**
   * Format chat information into a user-friendly string
   * @param chatInfo - ChatInfo object to format
   * @returns Formatted string with chat details
   */
  formatChatInfo(chatInfo: ChatInfo): string {
    const lines: string[] = [];

    // Add chat ID (always present)
    lines.push(`🆔 Chat ID: \`${chatInfo.chatId}\``);

    // Add chat type with appropriate emoji
    const typeEmojis = {
      private: "👤",
      group: "👥",
      supergroup: "👥",
      channel: "📢",
    };

    lines.push(`${typeEmojis[chatInfo.chatType]} Type: ${chatInfo.chatType}`);

    // Add title if available (for groups, supergroups, channels)
    if (chatInfo.title) {
      lines.push(`📝 Title: ${chatInfo.title}`);
    }

    // Add username if available
    if (chatInfo.username) {
      lines.push(`🔗 Username: @${chatInfo.username}`);
    }

    // Add member count if available (for groups and supergroups)
    if (chatInfo.memberCount !== undefined && chatInfo.memberCount > 0) {
      lines.push(`👥 Members: ${chatInfo.memberCount}`);
    }

    // Add description if available
    if (chatInfo.description) {
      lines.push(`📄 Description: ${chatInfo.description}`);
    }

    return lines.join("\n");
  }
}
