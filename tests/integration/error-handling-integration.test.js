/**
 * Error Handling and Recovery Integration Tests
 *
 * Implements Requirements:
 * - 5.1: Bot automatically retries on network issues and logs errors
 * - 5.2: Bot handles invalid messages gracefully without crashing
 * - 5.3: Bot records errors and provides clear error information
 * - 5.4: Bot handles permission errors gracefully
 *
 * Test Coverage:
 * - Network error recovery mechanisms
 * - API error handling and user feedback
 * - Retry logic with exponential backoff
 * - Permission error handling
 * - Graceful degradation scenarios
 * - Error logging and monitoring
 */

const { TelegramBot } = require("../../dist/bot/bot-handler");
const { ErrorHandler } = require("../../dist/utils/error-handler");
const { RetryHandler } = require("../../dist/utils/retry-handler");
const { CommandRouter } = require("../../dist/commands/command-router");
const logger = require("../../dist/utils/logger").default;

// Mock Telegraf for error simulation
jest.mock("telegraf", () => {
  const mockBot = {
    telegram: {
      getMe: jest.fn(),
      getChatMembersCount: jest.fn(),
      getChat: jest.fn(),
      sendMessage: jest.fn(),
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

describe("Error Handling and Recovery Integration Tests", () => {
  let bot;
  let errorHandler;
  let retryHandler;
  let router;
  let config;
  let mockTelegraf;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
      logLevel: "error",
      port: 3000,
    };

    bot = new TelegramBot(config);
    errorHandler = new ErrorHandler();
    retryHandler = new RetryHandler(3, 2.0, 100);
    router = new CommandRouter();

    // Get mocked Telegraf instance
    const { Telegraf } = require("telegraf");
    mockTelegraf = Telegraf.mock.results[Telegraf.mock.results.length - 1].value;
  });

  afterEach(async () => {
    if (bot && bot.isActive()) {
      await bot.stop();
    }
  });

  describe("Network Error Recovery", () => {
    it("should handle network timeout with retry", async () => {
      let attemptCount = 0;
      const testFunction = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("network timeout");
        }
        return "success";
      };

      const result = await retryHandler.retryWithBackoff(testFunction);

      expect(result).toBe("success");
      expect(attemptCount).toBe(3);
    });

    it("should handle connection refused errors", async () => {
      const connectionError = new Error("ECONNREFUSED");
      mockTelegraf.telegram.getMe.mockRejectedValue(connectionError);

      await expect(bot.start()).rejects.toThrow("Network connection failed");
      expect(bot.isActive()).toBe(false);
    });

    it("should handle DNS resolution failures", async () => {
      const dnsError = new Error("ENOTFOUND api.telegram.org");
      mockTelegraf.telegram.getMe.mockRejectedValue(dnsError);

      await expect(bot.start()).rejects.toThrow("Network connection failed");
    });

    it("should handle intermittent network failures with recovery", async () => {
      let callCount = 0;
      const intermittentFunction = async () => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          throw new Error("network error");
        }
        return "recovered";
      };

      const result = await retryHandler.retryWithBackoff(intermittentFunction);

      expect(result).toBe("recovered");
      expect(callCount).toBe(3);
    });

    it("should fail after max retries exceeded", async () => {
      const alwaysFailFunction = async () => {
        throw new Error("persistent network error");
      };

      await expect(retryHandler.retryWithBackoff(alwaysFailFunction)).rejects.toThrow("persistent network error");
    });
  });

  describe("API Error Handling", () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        chat: { id: -123456789, type: "group", title: "Test Group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User" },
        message: { message_id: 1, date: Date.now(), chat: { id: -123456789, type: "group" } },
        reply: jest.fn().mockResolvedValue({}),
      };
    });

    it("should handle 401 Unauthorized errors", async () => {
      const authError = new Error("401: Unauthorized");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, authError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("认证失败"), { parse_mode: "Markdown" });
    });

    it("should handle 403 Forbidden errors", async () => {
      const forbiddenError = new Error("403: Forbidden: bot was blocked by the user");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, forbiddenError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("权限不足"), { parse_mode: "Markdown" });
    });

    it("should handle 404 Not Found errors", async () => {
      const notFoundError = new Error("404: Not Found: chat not found");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, notFoundError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("未找到"), { parse_mode: "Markdown" });
    });

    it("should handle 429 Rate Limit errors", async () => {
      const rateLimitError = new Error("429: Too Many Requests: retry after 30");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, rateLimitError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("请求过于频繁"), {
        parse_mode: "Markdown",
      });
    });

    it("should handle 500 Internal Server Error", async () => {
      const serverError = new Error("500: Internal Server Error");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, serverError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("服务器错误"), { parse_mode: "Markdown" });
    });

    it("should handle network timeout errors", async () => {
      const timeoutError = new Error("network timeout");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, timeoutError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("网络超时"), { parse_mode: "Markdown" });
    });

    it("should handle unknown errors gracefully", async () => {
      const unknownError = new Error("Something unexpected happened");
      const errorContext = errorHandler.createErrorContext(mockContext);

      await errorHandler.handleError(mockContext, unknownError, errorContext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("未知错误"), { parse_mode: "Markdown" });
    });
  });

  describe("Permission Error Handling", () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        chat: { id: -123456789, type: "group", title: "Test Group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User" },
        message: { message_id: 1, date: Date.now(), chat: { id: -123456789, type: "group" } },
        reply: jest.fn(),
      };
    });

    it("should handle reply permission errors gracefully", async () => {
      const permissionError = new Error("403: Forbidden: bot was blocked by the user");
      mockContext.reply.mockRejectedValue(permissionError);

      const errorContext = errorHandler.createErrorContext(mockContext);

      // Should not throw error even if reply fails
      await expect(errorHandler.handleError(mockContext, new Error("Test error"), errorContext)).resolves.not.toThrow();
    });

    it("should handle insufficient bot permissions", async () => {
      const insufficientPermError = new Error("400: Bad Request: not enough rights to send text messages");
      mockContext.reply.mockRejectedValue(insufficientPermError);

      const errorContext = errorHandler.createErrorContext(mockContext);

      await expect(errorHandler.handleError(mockContext, new Error("Test error"), errorContext)).resolves.not.toThrow();
    });

    it("should handle bot kicked from group", async () => {
      const kickedError = new Error("403: Forbidden: bot is not a member of the supergroup chat");
      mockContext.reply.mockRejectedValue(kickedError);

      const errorContext = errorHandler.createErrorContext(mockContext);

      await expect(errorHandler.handleError(mockContext, new Error("Test error"), errorContext)).resolves.not.toThrow();
    });
  });

  describe("Command Processing Error Recovery", () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        chat: { id: -123456789, type: "group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User" },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: -123456789, type: "group" },
          text: "/chatid",
        },
        reply: jest.fn().mockResolvedValue({}),
      };
    });

    it("should handle command handler errors gracefully", async () => {
      // Register a command that throws an error
      const errorHandler = jest.fn().mockRejectedValue(new Error("Handler crashed"));
      router.registerCommand({
        command: "crashcommand",
        handler: errorHandler,
      });

      mockContext.message.text = "/crashcommand";

      // Should handle error gracefully and not crash
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should handle malformed message objects", async () => {
      const malformedContext = {
        chat: null,
        from: undefined,
        message: { text: "/chatid" },
        reply: jest.fn().mockResolvedValue({}),
      };

      // Should not crash with malformed context
      await expect(router.routeCommand(malformedContext)).resolves.not.toThrow();
    });

    it("should handle missing context properties", async () => {
      const incompleteContext = {
        reply: jest.fn().mockResolvedValue({}),
      };

      // Should handle incomplete context gracefully
      await expect(router.routeCommand(incompleteContext)).resolves.not.toThrow();
    });

    it("should handle API errors during command execution", async () => {
      // Mock API error during chat info retrieval
      mockTelegraf.telegram.getChat.mockRejectedValue(new Error("403: Forbidden"));
      mockTelegraf.telegram.getChatMembersCount.mockRejectedValue(new Error("403: Forbidden"));

      mockContext.message.text = "/info";

      await router.routeCommand(mockContext);

      // Should still respond with available information
      expect(mockContext.reply).toHaveBeenCalled();
    });
  });

  describe("Graceful Degradation", () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        chat: { id: -123456789, type: "group", title: "Test Group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User" },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: -123456789, type: "group" },
          text: "/info",
        },
        reply: jest.fn().mockResolvedValue({}),
      };
    });

    it("should provide basic info when detailed API calls fail", async () => {
      // Mock all API calls to fail
      mockTelegraf.telegram.getChat.mockRejectedValue(new Error("API unavailable"));
      mockTelegraf.telegram.getChatMembersCount.mockRejectedValue(new Error("API unavailable"));

      await router.routeCommand(mockContext);

      // Should still provide basic chat ID information
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("-123456789"), { parse_mode: "Markdown" });
    });

    it("should handle partial API failures", async () => {
      // Mock only member count to fail
      mockTelegraf.telegram.getChat.mockResolvedValue({
        id: -123456789,
        type: "group",
        title: "Test Group",
      });
      mockTelegraf.telegram.getChatMembersCount.mockRejectedValue(new Error("Forbidden"));

      await router.routeCommand(mockContext);

      // Should provide available information without member count
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringMatching(/Chat ID.*-123456789/s), {
        parse_mode: "Markdown",
      });
    });

    it("should handle service unavailability", async () => {
      // Mock service unavailable error
      const serviceError = new Error("503: Service Unavailable");
      mockTelegraf.telegram.getChat.mockRejectedValue(serviceError);

      await router.routeCommand(mockContext);

      // Should still respond with basic information
      expect(mockContext.reply).toHaveBeenCalled();
    });
  });

  describe("Error Logging and Monitoring", () => {
    it("should log errors with proper context", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const testError = new Error("Test error for logging");
      const mockContext = {
        chat: { id: -123456789, type: "group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User" },
        message: { message_id: 1, date: Date.now(), chat: { id: -123456789, type: "group" } },
        reply: jest.fn().mockResolvedValue({}),
      };

      const errorContext = errorHandler.createErrorContext(mockContext);
      await errorHandler.handleError(mockContext, testError, errorContext);

      // Verify error was logged (implementation may vary based on logger setup)
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should create proper error context", () => {
      const mockContext = {
        chat: { id: -123456789, type: "group", title: "Test Group" },
        from: { id: 987654321, is_bot: false, first_name: "Test User", username: "testuser" },
        message: { message_id: 1, date: Date.now(), chat: { id: -123456789, type: "group" } },
        reply: jest.fn(),
      };

      const errorContext = errorHandler.createErrorContext(mockContext);

      expect(errorContext).toMatchObject({
        chatId: -123456789,
        userId: 987654321,
        metadata: expect.objectContaining({
          chatType: "group",
          chatTitle: "Test Group",
          userName: "Test User",
          userUsername: "testuser",
        }),
      });
    });
  });

  describe("Bot Lifecycle Error Handling", () => {
    it("should handle startup failures gracefully", async () => {
      const startupError = new Error("Failed to connect to Telegram API");
      mockTelegraf.telegram.getMe.mockRejectedValue(startupError);

      await expect(bot.start()).rejects.toThrow();
      expect(bot.isActive()).toBe(false);

      // Bot should be in a clean state for retry
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });
      mockTelegraf.launch.mockResolvedValue(undefined);

      // Should be able to retry startup
      await expect(bot.start()).resolves.not.toThrow();
      expect(bot.isActive()).toBe(true);
    });

    it("should handle shutdown errors gracefully", async () => {
      // Start bot successfully
      mockTelegraf.telegram.getMe.mockResolvedValue({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
      });
      mockTelegraf.launch.mockResolvedValue(undefined);

      await bot.start();
      expect(bot.isActive()).toBe(true);

      // Mock shutdown error
      mockTelegraf.stop.mockImplementation(() => {
        throw new Error("Shutdown error");
      });

      // Should handle shutdown error gracefully
      await expect(bot.stop()).rejects.toThrow("Shutdown error");
    });
  });

  describe("Retry Logic Integration", () => {
    it("should use exponential backoff correctly", async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      });

      let attemptCount = 0;
      const testFunction = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Retry test error");
        }
        return "success";
      };

      const result = await retryHandler.retryWithBackoff(testFunction);

      expect(result).toBe("success");
      expect(delays).toHaveLength(2); // Two retries
      expect(delays[0]).toBe(100); // First retry delay
      expect(delays[1]).toBe(200); // Second retry delay (2x backoff)

      global.setTimeout = originalSetTimeout;
    });

    it("should respect maximum retry attempts", async () => {
      const shortRetryHandler = new RetryHandler(2, 2.0, 10);

      let attemptCount = 0;
      const alwaysFailFunction = async () => {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      };

      await expect(shortRetryHandler.retryWithBackoff(alwaysFailFunction)).rejects.toThrow("Attempt 2 failed");
      expect(attemptCount).toBe(2);
    });
  });

  console.log("🎉 All error handling integration tests completed!");
});
