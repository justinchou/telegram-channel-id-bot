import { TelegramBot } from "../../src/bot/bot-handler";
import { BotConfig } from "../../src/types";

describe("TelegramBot Integration", () => {
  let bot: TelegramBot;
  let config: BotConfig;

  beforeEach(() => {
    config = {
      token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
      logLevel: "error", // Reduce log noise during tests
      port: 3000,
    };
  });

  afterEach(async () => {
    if (bot && bot.isActive()) {
      await bot.stop();
    }
  });

  describe("Bot Lifecycle", () => {
    it("should create bot instance without starting", () => {
      bot = new TelegramBot(config);
      expect(bot).toBeInstanceOf(TelegramBot);
      expect(bot.isActive()).toBe(false);
    });

    it("should handle invalid token gracefully", async () => {
      bot = new TelegramBot(config);

      // This will fail with invalid token, but should not crash
      await expect(bot.start()).rejects.toThrow();
      expect(bot.isActive()).toBe(false);
    });

    it("should handle stop when not started", async () => {
      bot = new TelegramBot(config);

      // Should not throw error when stopping a bot that wasn't started
      await expect(bot.stop()).resolves.not.toThrow();
      expect(bot.isActive()).toBe(false);
    });
  });

  describe("Bot Configuration", () => {
    it("should accept valid configuration", () => {
      const validConfig: BotConfig = {
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        logLevel: "info",
        port: 8080,
        webhookUrl: "https://example.com/webhook",
      };

      bot = new TelegramBot(validConfig);
      expect(bot).toBeInstanceOf(TelegramBot);
    });

    it("should handle minimal configuration", () => {
      const minimalConfig: BotConfig = {
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        logLevel: "error",
        port: 3000,
      };

      bot = new TelegramBot(minimalConfig);
      expect(bot).toBeInstanceOf(TelegramBot);
    });
  });

  describe("Error Handling", () => {
    it("should handle getBotInfo with invalid token", async () => {
      bot = new TelegramBot(config);

      // Should throw error for invalid token
      await expect(bot.getBotInfo()).rejects.toThrow();
    });
  });
});
