/**
 * Unit tests for main application entry point
 * Tests the main function and its components
 */

import { loadEnvironmentConfig, initializeLogger, createBotInstance } from "../../src/index";
import { BotConfig } from "../../src/types";

// Mock dependencies
jest.mock("../../src/bot/bot-handler");
jest.mock("../../src/utils/logger");

describe("Main Application Entry Point", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("loadEnvironmentConfig", () => {
    it("should load valid configuration from environment variables", () => {
      // Set up test environment
      process.env.TELEGRAM_BOT_TOKEN = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
      process.env.LOG_LEVEL = "debug";
      process.env.PORT = "8080";
      process.env.NODE_ENV = "test";

      const config = loadEnvironmentConfig();

      expect(config).toEqual({
        token: "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
        logLevel: "debug",
        port: 8080,
        webhookUrl: undefined,
      });
    });

    it("should use default values for optional environment variables", () => {
      process.env.TELEGRAM_BOT_TOKEN = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
      delete process.env.LOG_LEVEL;
      delete process.env.PORT;
      delete process.env.WEBHOOK_URL;

      const config = loadEnvironmentConfig();

      expect(config.logLevel).toBe("info");
      expect(config.port).toBe(3000);
      expect(config.webhookUrl).toBeUndefined();
    });

    it("should throw error when TELEGRAM_BOT_TOKEN is missing", () => {
      delete process.env.TELEGRAM_BOT_TOKEN;

      expect(() => loadEnvironmentConfig()).toThrow("TELEGRAM_BOT_TOKEN environment variable is required");
    });

    it("should throw error when TELEGRAM_BOT_TOKEN has invalid format", () => {
      process.env.TELEGRAM_BOT_TOKEN = "invalid-token-format";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid TELEGRAM_BOT_TOKEN format");
    });

    it("should throw error when PORT is invalid", () => {
      process.env.TELEGRAM_BOT_TOKEN = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
      process.env.PORT = "invalid-port";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid PORT number");
    });

    it("should throw error when PORT is out of range", () => {
      process.env.TELEGRAM_BOT_TOKEN = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
      process.env.PORT = "70000";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid PORT number");
    });
  });

  describe("initializeLogger", () => {
    it("should initialize logger without throwing errors", () => {
      expect(() => initializeLogger("info")).not.toThrow();
    });

    it("should handle different log levels", () => {
      const logLevels = ["error", "warn", "info", "debug"];

      logLevels.forEach((level) => {
        expect(() => initializeLogger(level)).not.toThrow();
      });
    });
  });

  describe("createBotInstance", () => {
    const mockConfig: BotConfig = {
      token: "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      logLevel: "info",
      port: 3000,
    };

    it("should create bot instance with valid configuration", async () => {
      // Mock TelegramBot constructor and methods
      const mockBot = {
        getBotInfo: jest.fn().mockResolvedValue({
          id: 123456789,
          username: "test_bot",
          first_name: "Test Bot",
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
        }),
      };

      const { TelegramBot } = require("../../src/bot/bot-handler");
      TelegramBot.mockImplementation(() => mockBot);

      const bot = await createBotInstance(mockConfig);

      expect(bot).toBeDefined();
      expect(mockBot.getBotInfo).toHaveBeenCalled();
    });

    it("should handle bot creation errors gracefully", async () => {
      const { TelegramBot } = require("../../src/bot/bot-handler");
      TelegramBot.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(createBotInstance(mockConfig)).rejects.toThrow("Bot initialization failed");
    });

    it("should provide specific error message for 401 errors", async () => {
      const { TelegramBot } = require("../../src/bot/bot-handler");
      TelegramBot.mockImplementation(() => {
        const error = new Error("401 Unauthorized");
        throw error;
      });

      await expect(createBotInstance(mockConfig)).rejects.toThrow("Bot authentication failed");
    });

    it("should provide specific error message for network errors", async () => {
      const { TelegramBot } = require("../../src/bot/bot-handler");
      TelegramBot.mockImplementation(() => {
        const error = new Error("network timeout");
        throw error;
      });

      await expect(createBotInstance(mockConfig)).rejects.toThrow("Network connection failed");
    });
  });
});
