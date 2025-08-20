/**
 * Help Service - 提供帮助信息和使用指南
 *
 * 根据 Requirements 4.1, 4.2, 4.3:
 * - 4.1: 提供可用命令列表和使用说明
 * - 4.2: 提供欢迎消息和基本使用指南
 * - 4.3: 处理未知命令并提示使用帮助
 */
export class HelpService {
  /**
   * 获取帮助消息，包含所有可用命令和使用说明
   * Requirements: 4.1 - 用户发送 "/help" 命令时回复可用命令列表和使用说明
   */
  getHelpMessage(): string {
    return `🤖 *Telegram Chat ID Bot 帮助*

📋 *可用命令：*

/start - 开始使用 Bot，显示欢迎信息
/help - 显示此帮助信息
/chatid - 获取当前聊天的 Chat ID
/info - 获取当前聊天的详细信息

💡 *使用说明：*

• 在群组中使用命令可以获取群组的 Chat ID 和信息
• 在私聊中使用命令可以获取私聊的 Chat ID
• Chat ID 是 Telegram 中每个聊天的唯一标识符
• 开发者可以使用 Chat ID 来发送消息到特定的聊天

❓ 如有问题，请使用 /help 查看此帮助信息。`;
  }

  /**
   * 获取开始消息，包含欢迎信息和基本使用指南
   * Requirements: 4.2 - 用户发送 "/start" 命令时回复欢迎消息和基本使用指南
   */
  getStartMessage(): string {
    return `👋 *欢迎使用 Telegram Chat ID Bot！*

🎯 *Bot 功能：*
这个 Bot 可以帮助您快速获取 Telegram 聊天的 Chat ID 和相关信息。

🚀 *快速开始：*

1️⃣ 使用 /chatid 命令获取当前聊天的 ID
2️⃣ 使用 /info 命令获取详细的聊天信息
3️⃣ 使用 /help 命令查看所有可用功能

💼 *适用场景：*
• 开发 Telegram Bot 时需要获取群组 ID
• 配置 Bot 发送消息到特定聊天
• 管理多个群组时需要识别群组

输入 /help 查看详细的命令说明。`;
  }

  /**
   * 获取未知命令消息，提示用户使用帮助
   * Requirements: 4.3 - 用户发送未知命令时提示使用 "/help" 查看可用命令
   */
  getUnknownCommandMessage(): string {
    return `❓ *未知命令*

抱歉，我不理解这个命令。

请使用 /help 查看所有可用的命令和使用说明。

💡 *提示：* 确保命令以 "/" 开头，例如 /chatid 或 /info`;
  }
}
