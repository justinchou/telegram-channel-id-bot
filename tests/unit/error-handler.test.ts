import { ErrorHandler } from "../../src/utils/error-handler";
import { Context } from "telegraf";
import logger from "../../src/utils/logger";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let mockContext: Partial<Context>;
  let mockReply: jest.Mock;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockReply = jest.fn().mockResolvedValue(undefined);

    mockContext = {
      reply: mockReply,
      chat: {
        id: 12345,
        type: "group",
      },
      from: {
        id: 67890,
        is_bot: false,
        first_name: "Test",
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: {
          id: 12345,
          type: "group",
        },
      },
    } as Partial<Context>;

    // Clear mock calls
    jest.clearAllMocks();
  });

  describe("handleError", () => {
    it("should log error and send user-friendly message", async () => {
      const error = new Error("Test error");
      const errorContext = {
        command: "/test",
        chatId: 12345,
        userId: 67890,
      };

      await errorHandler.handleError(mockContext as Context, error, errorContext);

      expect(logger.error).toHaveBeenCalledWith("Bot error occurred", {
        message: "Test error",
        stack: error.stack,
        name: "Error",
        command: "/test",
        chatId: 12345,
        userId: 67890,
      });

      expect(mockReply).toHaveBeenCalledWith("❌ 抱歉，处理您的请求时出现了问题。请稍后再试或联系管理员。", {
        parse_mode: "Markdown",
      });
    });

    it("should handle network errors with appropriate message", async () => {
      const error = new Error("Network timeout occurred");

      await errorHandler.handleError(mockContext as Context, error);

      expect(mockReply).toHaveBeenCalledWith("🔌 网络连接出现问题，请稍后再试。", { parse_mode: "Markdown" });
    });

    it("should handle permission errors with appropriate message", async () => {
      const error = new Error("Permission denied");

      await errorHandler.handleError(mockContext as Context, error);

      expect(mockReply).toHaveBeenCalledWith("❌ Bot 没有足够的权限执行此操作。请检查 Bot 的权限设置。", {
        parse_mode: "Markdown",
      });
    });

    it("should handle rate limit errors with appropriate message", async () => {
      const error = new Error("Rate limit exceeded");

      await errorHandler.handleError(mockContext as Context, error);

      expect(mockReply).toHaveBeenCalledWith("⏰ 请求过于频繁，请稍后再试。", { parse_mode: "Markdown" });
    });

    it("should handle Telegram errors appropriately", async () => {
      const error = new Error("Bot was blocked by the user");
      error.name = "TelegramError";

      await errorHandler.handleError(mockContext as Context, error);

      expect(mockReply).toHaveBeenCalledWith("🚫 Bot 已被阻止。请解除阻止后重试。", { parse_mode: "Markdown" });
    });

    it("should log error when reply fails", async () => {
      const error = new Error("Test error");
      const replyError = new Error("Failed to send message");
      mockReply.mockRejectedValue(replyError);

      await errorHandler.handleError(mockContext as Context, error);

      expect(logger.error).toHaveBeenCalledWith("Failed to send error message to user", {
        originalError: "Test error",
        replyError: "Failed to send message",
        chatId: 12345,
      });
    });
  });

  describe("logError", () => {
    it("should log error with context", () => {
      const error = new Error("Test error");
      const errorContext = {
        command: "/test",
        chatId: 12345,
        userId: 67890,
        metadata: { extra: "data" },
      };

      errorHandler.logError(error, errorContext);

      expect(logger.error).toHaveBeenCalledWith("Bot error occurred", {
        message: "Test error",
        stack: error.stack,
        name: "Error",
        command: "/test",
        chatId: 12345,
        userId: 67890,
        metadata: { extra: "data" },
      });
    });

    it("should log error without context", () => {
      const error = new Error("Test error");

      errorHandler.logError(error);

      expect(logger.error).toHaveBeenCalledWith("Bot error occurred", {
        message: "Test error",
        stack: error.stack,
        name: "Error",
      });
    });
  });

  describe("handleCriticalError", () => {
    it("should log critical error with context", () => {
      const error = new Error("Critical error");
      const context = "Bot initialization";

      errorHandler.handleCriticalError(error, context);

      expect(logger.error).toHaveBeenCalledWith("Critical error occurred", {
        message: "Critical error",
        stack: error.stack,
        context: "Bot initialization",
        timestamp: expect.any(String),
      });
    });

    it("should log restart message in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = new Error("Critical error");
      errorHandler.handleCriticalError(error);

      expect(logger.error).toHaveBeenCalledWith("Bot may need to be restarted due to critical error");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("createErrorContext", () => {
    it("should create error context from Telegram context", () => {
      const context = errorHandler.createErrorContext(mockContext as Context, "/test");

      expect(context).toEqual({
        command: "/test",
        chatId: 12345,
        userId: 67890,
        metadata: {
          chatType: "group",
          messageId: 1,
          timestamp: expect.any(String),
        },
      });
    });

    it("should handle missing context properties", () => {
      const minimalContext = {} as Context;
      const context = errorHandler.createErrorContext(minimalContext);

      expect(context).toEqual({
        command: undefined,
        chatId: undefined,
        userId: undefined,
        metadata: {
          chatType: undefined,
          messageId: undefined,
          timestamp: expect.any(String),
        },
      });
    });
  });
});
