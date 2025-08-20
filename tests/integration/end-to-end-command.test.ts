/**
 * End-to-End Command Processing Integration Tests
 *
 * Implements Requirements:
 * - 2.1: Bot responds to /chatid command in different chat types
 * - 2.2: Bot responds to /info command with detailed information
 * - 4.1: Bot responds to /help command with command list
 * - 4.2: Bot responds to /start command with welcome message
 * - 5.1: Bot handles errors and retries appropriately
 *
 * Test Coverage:
 * - Complete command processing flow from message to response
 * - Different chat types (private, group, supergroup, channel)
 * - Command validation and context checking
 * - Error scenarios and recovery mechanisms
 * - Rate limiting and middleware execution
 */

import { TelegramBot } from "../../src/bot/bot-handler";
import { CommandRouter } from "../../src/commands/command-router";
import { BotConfig, TelegrafContext } from "../../src/types";

// Mock Telegraf to control API responses
jest.mock("telegraf", () => {
  const mockBot = {
    telegram: {
      getMe: jest.fn(),
      getChatMembersCount: jest.fn(),
      getChat: jest.fn(),
    },
    launch: jest.fn(),
    stop: jest.fn(),
    catch: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
  };

  return {
    Telegraf: jest.fn(() => mockBot),
  };
});

describe("End-to-End Command Processing Integration", () => {
  let bot: TelegramBot;
  let router: CommandRouter;
  let config: BotConfig;
  let mockTelegraf: any;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
      logLevel: "error",
      port: 3000,
    };

    // Create bot and router instances
    bot = new TelegramBot(config);
    router = new CommandRouter();

    // Get mocked Telegraf instance
    const { Telegraf } = require("telegraf");
    mockTelegraf = Telegraf.mock.results[Telegraf.mock.results.length - 1].value;

    // Setup default successful responses
    mockTelegraf.telegram.getMe.mockResolvedValue({
      id: 123456789,
      username: "test_bot",
      first_name: "Test Bot",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
    });

    mockTelegraf.telegram.getChatMembersCount.mockResolvedValue(42);
    mockTelegraf.telegram.getChat.mockResolvedValue({
      id: -1001234567890,
      type: "supergroup",
      title: "Test Supergroup",
      username: "test_group",
      description: "A test supergroup for integration testing",
    });
  });

  afterEach(async () => {
    if (bot && bot.isActive()) {
      await bot.stop();
    }
  });

  describe("ChatID Command End-to-End", () => {
    it("should process /chatid command in private chat", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 987654321,
          type: "private",
        },
        from: {
          id: 987654321,
          is_bot: false,
          first_name: "Test User",
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: {
            id: 987654321,
            type: "private",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("987654321"), { parse_mode: "Markdown" });
    });

    it("should process /chatid command in group chat", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-123456789"), { parse_mode: "Markdown" });
    });

    it("should process /chatid command in supergroup", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -1001234567890,
          type: "supergroup",
          title: "Test Supergroup",
          username: "test_group",
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
            id: -1001234567890,
            type: "supergroup",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-1001234567890"), {
        parse_mode: "Markdown",
      });
    });

    it("should handle /chatid with bot mention", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid@test_bot",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-123456789"), { parse_mode: "Markdown" });
    });
  });

  describe("Info Command End-to-End", () => {
    it("should process /info command with complete chat information", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -1001234567890,
          type: "supergroup",
          title: "Test Supergroup",
          username: "test_group",
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
            id: -1001234567890,
            type: "supergroup",
          },
          text: "/info",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/Chat ID.*-1001234567890/s), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/聊天类型.*超级群组/s), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/群组名称.*Test Supergroup/s), {
        parse_mode: "Markdown",
      });
    });

    it("should handle /info command with API errors gracefully", async () => {
      // Mock API error for member count
      mockTelegraf.telegram.getChatMembersCount.mockRejectedValue(new Error("Forbidden"));

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/info",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      // Should still respond with available information
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-123456789"), { parse_mode: "Markdown" });
    });

    it("should process /info in private chat", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 987654321,
          type: "private",
        },
        from: {
          id: 987654321,
          is_bot: false,
          first_name: "Test User",
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: {
            id: 987654321,
            type: "private",
          },
          text: "/info",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/Chat ID.*987654321/s), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/聊天类型.*私聊/s), {
        parse_mode: "Markdown",
      });
    });
  });

  describe("Help Command End-to-End", () => {
    it("should process /help command with command list", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/help",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("可用命令"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("/chatid"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("/info"), { parse_mode: "Markdown" });
    });

    it("should process /start command with welcome message", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 987654321,
          type: "private",
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
            id: 987654321,
            type: "private",
          },
          text: "/start",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("欢迎使用"), { parse_mode: "Markdown" });
    });

    it("should handle unknown commands gracefully", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/unknowncommand",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("未知命令"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("/help"), { parse_mode: "Markdown" });
    });
  });

  describe("Command Validation and Context Checking", () => {
    it("should validate chat types for restricted commands", async () => {
      // Register a command that only works in private chats
      router.registerCommand({
        command: "privateonly",
        handler: jest.fn(),
        allowedChatTypes: ["private"],
      });

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/privateonly",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("不能在当前聊天类型中使用"), {
        parse_mode: "Markdown",
      });
    });

    it("should ignore non-command messages", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "This is just a regular message, not a command",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      // Should not call reply for non-commands
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    it("should handle commands with parameters", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid some extra parameters",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      // Should still process the command despite extra parameters
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-123456789"), { parse_mode: "Markdown" });
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle reply failures gracefully", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockRejectedValue(new Error("Bot was blocked by the user")),
      };

      // Should not throw error even if reply fails
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
    });

    it("should handle command handler errors", async () => {
      // Register a command that throws an error
      const errorHandler = jest.fn().mockRejectedValue(new Error("Handler error"));
      router.registerCommand({
        command: "errorcommand",
        handler: errorHandler,
      });

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/errorcommand",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      // Should handle error gracefully
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should handle malformed context objects", async () => {
      const malformedContext = {
        // Missing required properties
        reply: jest.fn().mockResolvedValue({}),
      } as any;

      // Should not crash with malformed context
      await expect(router.routeCommand(malformedContext)).resolves.not.toThrow();
    });
  });

  describe("Middleware Integration", () => {
    it("should execute middleware in correct order", async () => {
      const executionOrder: string[] = [];

      const middleware1 = async (ctx: TelegrafContext, next: () => Promise<void>) => {
        executionOrder.push("middleware1-before");
        await next();
        executionOrder.push("middleware1-after");
      };

      const middleware2 = async (ctx: TelegrafContext, next: () => Promise<void>) => {
        executionOrder.push("middleware2-before");
        await next();
        executionOrder.push("middleware2-after");
      };

      const testHandler = jest.fn().mockImplementation(async () => {
        executionOrder.push("handler");
      });

      router.addMiddleware(middleware1);
      router.addMiddleware(middleware2);
      router.registerCommand({
        command: "testmiddleware",
        handler: testHandler,
      });

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/testmiddleware",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      await router.routeCommand(mockContext);

      expect(executionOrder).toEqual([
        "middleware1-before",
        "middleware2-before",
        "handler",
        "middleware2-after",
        "middleware1-after",
      ]);
    });

    it("should handle middleware errors", async () => {
      const errorMiddleware = async (ctx: TelegrafContext, next: () => Promise<void>) => {
        throw new Error("Middleware error");
      };

      router.addMiddleware(errorMiddleware);

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      // Should handle middleware errors gracefully
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should apply rate limiting middleware", async () => {
      const rateLimitMiddleware = CommandRouter.createRateLimitMiddleware(2, 1000);
      router.addMiddleware(rateLimitMiddleware);

      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
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
            id: -123456789,
            type: "group",
          },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      // First two requests should succeed
      await router.routeCommand(mockContext);
      await router.routeCommand(mockContext);

      // Third request should be rate limited
      await router.routeCommand(mockContext);

      // Check that rate limit message was sent
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("请求过于频繁"), {
        parse_mode: "Markdown",
      });
    });
  });
});
