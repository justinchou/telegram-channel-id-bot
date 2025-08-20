import { TelegramBot } from "../../src/bot/bot-handler";
import { BotConfig } from "../../src/types";

// Mock Telegraf
jest.mock("telegraf", () => {
  return {
    Telegraf: jest.fn().mockImplementation(() => ({
      telegram: {
        getMe: jest.fn().mockResolvedValue({
          id: 123456789,
          username: "test_bot",
          first_name: "Test Bot",
          is_bot: true,
        }),
      },
      launch: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      catch: jest.fn(),
      use: jest.fn(),
      on: jest.fn(),
    })),
  };
});

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock command router
jest.mock("../../src/commands/command-router", () => ({
  CommandRouter: jest.fn().mockImplementation(() => ({
    addMiddleware: jest.fn(),
    routeCommand: jest.fn(),
    createRateLimitMiddleware: jest.fn(),
    createLoggingMiddleware: jest.fn(),
  })),
}));

// Mock error handler
jest.mock("../../src/utils/error-handler", () => ({
  ErrorHandler: jest.fn().mockImplementation(() => ({
    handleError: jest.fn(),
    createErrorContext: jest.fn(),
  })),
}));

describe("TelegramBot", () => {
  let bot: TelegramBot;
  let config: BotConfig;

  beforeEach(() => {
    config = {
      token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      logLevel: "info",
      port: 3000,
    };

    bot = new TelegramBot(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create bot instance with correct configuration", () => {
      expect(bot).toBeInstanceOf(TelegramBot);
      expect(bot.isActive()).toBe(false);
    });
  });

  describe("start", () => {
    it("should start bot successfully", async () => {
      await bot.start();
      expect(bot.isActive()).toBe(true);
    });

    it("should handle invalid token error", async () => {
      const { Telegraf } = require("telegraf");
      const mockBot = new Telegraf();
      mockBot.telegram.getMe.mockRejectedValue(new Error("401 Unauthorized"));

      await expect(bot.start()).rejects.toThrow("Invalid bot token");
    });

    it("should handle network errors", async () => {
      const { Telegraf } = require("telegraf");
      const mockBot = new Telegraf();
      mockBot.telegram.getMe.mockRejectedValue(new Error("network timeout"));

      await expect(bot.start()).rejects.toThrow("Network connection failed");
    });
  });

  describe("stop", () => {
    it("should stop bot gracefully", async () => {
      await bot.start();
      expect(bot.isActive()).toBe(true);

      await bot.stop();
      expect(bot.isActive()).toBe(false);
    });

    it("should handle stop when bot is not running", async () => {
      expect(bot.isActive()).toBe(false);
      await expect(bot.stop()).resolves.not.toThrow();
    });
  });

  describe("getBotInfo", () => {
    it("should return bot information", async () => {
      const botInfo = await bot.getBotInfo();
      expect(botInfo).toEqual({
        id: 123456789,
        username: "test_bot",
        first_name: "Test Bot",
        is_bot: true,
      });
    });

    it("should handle API errors", async () => {
      const { Telegraf } = require("telegraf");
      const mockBot = new Telegraf();
      mockBot.telegram.getMe.mockRejectedValue(new Error("API Error"));

      await expect(bot.getBotInfo()).rejects.toThrow("API Error");
    });
  });

  describe("isActive", () => {
    it("should return false initially", () => {
      expect(bot.isActive()).toBe(false);
    });

    it("should return true after starting", async () => {
      await bot.start();
      expect(bot.isActive()).toBe(true);
    });

    it("should return false after stopping", async () => {
      await bot.start();
      await bot.stop();
      expect(bot.isActive()).toBe(false);
    });
  });
});
