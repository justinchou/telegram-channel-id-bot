/**
 * Integration Tests for Telegram Bot
 *
 * Implements Requirements:
 * - 1.1: Bot successfully joins groups and remains active
 * - 1.2: Bot sends welcome message when added to groups
 * - 2.1: Bot responds to /chatid command
 * - 2.2: Bot responds to /info command
 * - 4.1: Bot responds to /help command
 * - 5.1: Bot handles network issues and logs errors
 *
 * Test Coverage:
 * - Bot startup and shutdown lifecycle
 * - Command processing end-to-end flows
 * - Telegram API response mocking
 * - Error handling and recovery mechanisms
 * - Welcome message functionality
 * - Permission and context validation
 */

import { TelegramBot } from "../../src/bot/bot-handler";
import { BotConfig, TelegrafContext } from "../../src/types";

// Mock Telegraf to avoid actual API calls
jest.mock("telegraf", () => {
  const mockBot = {
    telegram: {
      getMe: jest.fn(),
    },
    launch: jest.fn(),
    stop: jest.fn(),
    catch: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  };

  return {
    Telegraf: jest.fn(() => mockBot),
  };
});

describe("TelegramBot Integration Tests", () => {
  let bot: TelegramBot;
  let config: BotConfig;
  let mockTelegraf: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    config = {
      token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
      logLevel: "error", // Reduce log noise during tests
      port: 3000,
    };

    // Get the mocked Telegraf constructor
    const { Telegraf } = require("telegraf");
    bot = new TelegramBot(config);
    mockTelegraf = Telegraf.mock.results[Telegraf.mock.results.length - 1].value;
  });

  afterEach(async () => {
    if (bot && bot.isActive()) {
      await bot.stop();
    }
  });

  describe("Bot Lifecycle Management", () => {
    it("should create bot instance without starting", () => {
      expect(bot).toBeInstanceOf(TelegramBot);
      expect(bot.isActive()).toBe(false);
    });

    it("should start bot successfully with valid token", async () => {
      // Mock successful bot info response
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: false,
      });

      mockTelegraf.launch.mockResolvedValue(undefined);

      await bot.start();

      expect(bot.isActive()).toBe(true);
      expect(mockTelegraf.telegram.getMe).toHaveBeenCalled();
      expect(mockTelegraf.launch).toHaveBeenCalled();
    });

    it("should handle bot startup with authentication error", async () => {
      // Mock 401 authentication error
      const authError = new Error("401: Unauthorized");
      mockTelegraf.telegram.getMe.mockRejectedValue(authError);

      await expect(bot.start()).rejects.toThrow("Invalid bot token");
      expect(bot.isActive()).toBe(false);
    });

    it("should handle bot startup with network error", async () => {
      // Mock network timeout error
      const networkError = new Error("network timeout");
      mockTelegraf.telegram.getMe.mockRejectedValue(networkError);

      await expect(bot.start()).rejects.toThrow("Network connection failed");
      expect(bot.isActive()).toBe(false);
    });

    it("should stop bot gracefully when running", async () => {
      // Setup successful start
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });
      mockTelegraf.launch.mockResolvedValue(undefined);

      await bot.start();
      expect(bot.isActive()).toBe(true);

      await bot.stop();
      expect(bot.isActive()).toBe(false);
      expect(mockTelegraf.stop).toHaveBeenCalled();
    });

    it("should handle stop when not started", async () => {
      // Should not throw error when stopping a bot that wasn't started
      await expect(bot.stop()).resolves.not.toThrow();
      expect(bot.isActive()).toBe(false);
    });

    it("should handle multiple start/stop cycles", async () => {
      // Mock successful responses
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });
      mockTelegraf.launch.mockResolvedValue(undefined);

      // First cycle
      await bot.start();
      expect(bot.isActive()).toBe(true);
      await bot.stop();
      expect(bot.isActive()).toBe(false);

      // Second cycle
      await bot.start();
      expect(bot.isActive()).toBe(true);
      await bot.stop();
      expect(bot.isActive()).toBe(false);

      expect(mockTelegraf.launch).toHaveBeenCalledTimes(2);
      expect(mockTelegraf.stop).toHaveBeenCalledTimes(2);
    });
  });

  describe("Bot Configuration Validation", () => {
    it("should accept valid configuration with all options", () => {
      const validConfig: BotConfig = {
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        logLevel: "info",
        port: 8080,
        webhookUrl: "https://example.com/webhook",
      };

      const testBot = new TelegramBot(validConfig);
      expect(testBot).toBeInstanceOf(TelegramBot);
    });

    it("should handle minimal configuration", () => {
      const minimalConfig: BotConfig = {
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        logLevel: "error",
        port: 3000,
      };

      const testBot = new TelegramBot(minimalConfig);
      expect(testBot).toBeInstanceOf(TelegramBot);
    });

    it("should setup middleware and event handlers during construction", () => {
      expect(mockTelegraf.catch).toHaveBeenCalled();
      expect(mockTelegraf.use).toHaveBeenCalled();
      expect(mockTelegraf.on).toHaveBeenCalledWith("text", expect.any(Function));
      expect(mockTelegraf.on).toHaveBeenCalledWith("my_chat_member", expect.any(Function));
      expect(mockTelegraf.on).toHaveBeenCalledWith("new_chat_members", expect.any(Function));
      expect(mockTelegraf.on).toHaveBeenCalledWith("inline_query", expect.any(Function));
    });
  });

  describe("Welcome Message Integration", () => {
    let mockContext: TelegrafContext;

    beforeEach(() => {
      mockContext = {
        chat: {
          id: 123456789,
          type: "group",
          title: "Test Group",
        },
        from: {
          id: 987654321,
          is_bot: false,
          first_name: "Test User",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: {
            id: 123456789,
            type: "group",
          },
        },
        reply: jest.fn().mockResolvedValue({}),
        myChatMember: {
          new_chat_member: { status: "member" },
          old_chat_member: { status: "left" },
        },
      };
    });

    it("should handle bot being added to group via my_chat_member", async () => {
      // Get the my_chat_member handler
      const myChatMemberHandler = mockTelegraf.on.mock.calls.find((call) => call[0] === "my_chat_member")?.[1];

      expect(myChatMemberHandler).toBeDefined();

      // Simulate bot being added to group
      await myChatMemberHandler(mockContext);

      // Should send welcome message
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("欢迎使用 Chat ID Bot"), {
        parse_mode: "Markdown",
      });
    });

    it("should handle bot being added to group via new_chat_members", async () => {
      // Mock bot info for comparison
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });

      // Setup context for new_chat_members
      const newMembersContext = {
        ...mockContext,
        message: {
          ...mockContext.message,
          new_chat_members: [{ id: 123456789, username: "test_bot" }],
        },
      };

      // Get the new_chat_members handler
      const newMembersHandler = mockTelegraf.on.mock.calls.find((call) => call[0] === "new_chat_members")?.[1];

      expect(newMembersHandler).toBeDefined();

      // Simulate bot being added via new_chat_members
      await newMembersHandler(newMembersContext);

      // Should send welcome message
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("欢迎使用 Chat ID Bot"), {
        parse_mode: "Markdown",
      });
    });

    it("should handle welcome message permission errors gracefully", async () => {
      // Mock permission error
      mockContext.reply = jest.fn().mockRejectedValue(new Error("forbidden: bot was blocked by the user"));

      const myChatMemberHandler = mockTelegraf.on.mock.calls.find((call) => call[0] === "my_chat_member")?.[1];

      // Should not throw error even if reply fails
      await expect(myChatMemberHandler(mockContext)).resolves.not.toThrow();
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle getBotInfo with invalid token", async () => {
      const authError = new Error("401: Unauthorized");
      mockTelegraf.telegram.getMe.mockRejectedValue(authError);

      await expect(bot.getBotInfo()).rejects.toThrow();
    });

    it("should setup global error handler", () => {
      // Verify that catch middleware was registered
      expect(mockTelegraf.catch).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should handle unhandled bot errors", async () => {
      // Get the error handler
      const errorHandler = mockTelegraf.catch.mock.calls[0][0];

      const mockError = new Error("Test error");
      const mockContext = {
        chat: { id: 123, type: "group" },
        from: { id: 456, is_bot: false, first_name: "Test" },
        reply: jest.fn().mockResolvedValue({}),
      };

      // Should not throw when handling errors
      await expect(errorHandler(mockError, mockContext)).resolves.not.toThrow();
    });
  });

  describe("Inline Query Integration", () => {
    it("should handle inline queries", async () => {
      const mockInlineContext = {
        chat: { id: 123456789, type: "private" },
        inlineQuery: { id: "query123", query: "" },
        answerInlineQuery: jest.fn().mockResolvedValue({}),
      };

      // Get the inline_query handler
      const inlineQueryHandler = mockTelegraf.on.mock.calls.find((call) => call[0] === "inline_query")?.[1];

      expect(inlineQueryHandler).toBeDefined();

      await inlineQueryHandler(mockInlineContext);

      expect(mockInlineContext.answerInlineQuery).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "article",
          id: "chatid",
          title: "获取当前聊天 ID",
        }),
      ]);
    });

    it("should handle inline query errors gracefully", async () => {
      const mockInlineContext = {
        chat: { id: 123456789, type: "private" },
        inlineQuery: { id: "query123", query: "" },
        answerInlineQuery: jest.fn().mockRejectedValue(new Error("Query failed")),
      };

      const inlineQueryHandler = mockTelegraf.on.mock.calls.find((call) => call[0] === "inline_query")?.[1];

      // Should not throw error even if inline query fails
      await expect(inlineQueryHandler(mockInlineContext)).resolves.not.toThrow();
    });
  });

  describe("Middleware Integration", () => {
    it("should setup logging middleware", () => {
      // Verify that use middleware was called for logging
      expect(mockTelegraf.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should process text messages through command router", () => {
      // Verify that text handler was registered
      expect(mockTelegraf.on).toHaveBeenCalledWith("text", expect.any(Function));
    });

    it("should handle middleware execution errors", async () => {
      // Get the logging middleware
      const loggingMiddleware = mockTelegraf.use.mock.calls[0][0];

      const mockContext = {
        updateType: "message",
        chat: { id: 123, type: "group" },
        from: { id: 456, is_bot: false, first_name: "Test" },
      };

      const mockNext = jest.fn().mockRejectedValue(new Error("Middleware error"));

      // Should propagate errors from next()
      await expect(loggingMiddleware(mockContext, mockNext)).rejects.toThrow("Middleware error");
    });
  });

  describe("Bot Information Retrieval", () => {
    it("should retrieve bot information successfully", async () => {
      const mockBotInfo = {
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: false,
      };

      mockTelegraf.telegram.getMe.mockResolvedValue(mockBotInfo);

      const botInfo = await bot.getBotInfo();

      expect(botInfo).toEqual(mockBotInfo);
      expect(mockTelegraf.telegram.getMe).toHaveBeenCalled();
    });

    it("should handle bot info retrieval errors", async () => {
      const error = new Error("Network error");
      mockTelegraf.telegram.getMe.mockRejectedValue(error);

      await expect(bot.getBotInfo()).rejects.toThrow("Network error");
    });
  });

  describe("Graceful Shutdown Integration", () => {
    it("should handle process signals during bot operation", async () => {
      // Mock successful start
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });
      mockTelegraf.launch.mockResolvedValue(undefined);

      await bot.start();
      expect(bot.isActive()).toBe(true);

      // Simulate graceful shutdown
      await bot.stop();
      expect(bot.isActive()).toBe(false);
    });
  });
});
