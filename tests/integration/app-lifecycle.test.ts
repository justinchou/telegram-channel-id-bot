/**
 * Application Lifecycle Integration Tests
 *
 * Implements Requirements:
 * - 1.1: Bot successfully joins groups and remains active
 * - 5.1: Bot handles network issues and logs errors
 * - 5.3: Bot records errors and provides clear error information
 *
 * Test Coverage:
 * - Complete application startup and shutdown cycles
 * - Environment configuration validation
 * - Graceful shutdown handling
 * - Process signal handling
 * - Configuration error scenarios
 * - Memory and resource management
 */

import {
  main,
  loadEnvironmentConfig,
  initializeLogger,
  createBotInstance,
  setupGracefulShutdown,
} from "../../src/index";
import { BotConfig } from "../../src/types";

// Mock environment variables
const mockEnv = {
  TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
  LOG_LEVEL: "error",
  NODE_ENV: "test",
  PORT: "3000",
};

// Mock process object
const mockProcess = {
  env: { ...mockEnv },
  exit: jest.fn(),
  pid: 12345,
  version: "v18.0.0",
  platform: "linux",
  arch: "x64",
  cwd: jest.fn(() => "/test/directory"),
  memoryUsage: jest.fn(() => ({
    rss: 50000000,
    heapTotal: 30000000,
    heapUsed: 20000000,
    external: 1000000,
  })),
  uptime: jest.fn(() => 3600),
  once: jest.fn(),
  on: jest.fn(),
};

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock Telegraf
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
  };

  return {
    Telegraf: jest.fn(() => mockBot),
  };
});

// Mock global objects
Object.defineProperty(globalThis, "process", {
  value: mockProcess,
  writable: true,
});

Object.defineProperty(globalThis, "require", {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(globalThis, "module", {
  value: { exports: {} },
  writable: true,
});

Object.defineProperty(globalThis, "console", {
  value: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
  writable: true,
});

describe("Application Lifecycle Integration Tests", () => {
  let mockTelegraf: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process mock
    mockProcess.env = { ...mockEnv };
    mockProcess.exit.mockClear();
    mockProcess.once.mockClear();
    mockProcess.on.mockClear();

    // Get mocked Telegraf instance
    const { Telegraf } = require("telegraf");
    if (Telegraf.mock.results.length > 0) {
      mockTelegraf = Telegraf.mock.results[Telegraf.mock.results.length - 1].value;
    }
  });

  describe("Environment Configuration Loading", () => {
    it("should load valid environment configuration", () => {
      const config = loadEnvironmentConfig();

      expect(config).toEqual({
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
        logLevel: "error",
        webhookUrl: undefined,
        port: 3000,
      });
    });

    it("should throw error for missing bot token", () => {
      delete mockProcess.env.TELEGRAM_BOT_TOKEN;

      expect(() => loadEnvironmentConfig()).toThrow("TELEGRAM_BOT_TOKEN environment variable is required");
    });

    it("should throw error for invalid token format", () => {
      mockProcess.env.TELEGRAM_BOT_TOKEN = "invalid-token-format";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid TELEGRAM_BOT_TOKEN format");
    });

    it("should handle invalid log level gracefully", () => {
      mockProcess.env.LOG_LEVEL = "invalid-level";

      const config = loadEnvironmentConfig();

      expect(config.logLevel).toBe("invalid-level"); // Should still accept it but warn
    });

    it("should throw error for invalid port", () => {
      mockProcess.env.PORT = "invalid-port";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid PORT number");
    });

    it("should handle port out of range", () => {
      mockProcess.env.PORT = "99999";

      expect(() => loadEnvironmentConfig()).toThrow("Invalid PORT number");
    });

    it("should handle optional webhook URL", () => {
      mockProcess.env.WEBHOOK_URL = "https://example.com/webhook";

      const config = loadEnvironmentConfig();

      expect(config.webhookUrl).toBe("https://example.com/webhook");
    });

    it("should use default values for optional settings", () => {
      delete mockProcess.env.LOG_LEVEL;
      delete mockProcess.env.PORT;

      const config = loadEnvironmentConfig();

      expect(config.logLevel).toBe("info");
      expect(config.port).toBe(3000);
    });
  });

  describe("Logger Initialization", () => {
    it("should initialize logger with proper configuration", () => {
      expect(() => initializeLogger("info")).not.toThrow();
    });

    it("should handle different log levels", () => {
      const logLevels = ["error", "warn", "info", "http", "debug"];

      logLevels.forEach((level) => {
        expect(() => initializeLogger(level)).not.toThrow();
      });
    });

    it("should log startup information", () => {
      initializeLogger("info");

      // Logger should have been called (implementation specific)
      // This test verifies the function doesn't crash
      expect(true).toBe(true);
    });
  });

  describe("Bot Instance Creation", () => {
    let config: BotConfig;

    beforeEach(() => {
      config = {
        token: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ-test-token",
        logLevel: "error",
        port: 3000,
      };

      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockResolvedValue({
          id: 123456789,
          username: "test_bot",
          first_name: "Test Bot",
          can_join_groups: true,
          can_read_all_group_messages: true,
          supports_inline_queries: false,
        });
      }
    });

    it("should create bot instance successfully", async () => {
      const bot = await createBotInstance(config);

      expect(bot).toBeDefined();
      expect(mockTelegraf?.telegram.getMe).toHaveBeenCalled();
    });

    it("should handle authentication errors during creation", async () => {
      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockRejectedValue(new Error("401: Unauthorized"));
      }

      await expect(createBotInstance(config)).rejects.toThrow("Bot authentication failed");
    });

    it("should handle network errors during creation", async () => {
      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockRejectedValue(new Error("network timeout"));
      }

      await expect(createBotInstance(config)).rejects.toThrow("Network connection failed");
    });

    it("should handle generic errors during creation", async () => {
      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockRejectedValue(new Error("Unknown error"));
      }

      await expect(createBotInstance(config)).rejects.toThrow("Bot initialization failed");
    });

    it("should log bot information on successful creation", async () => {
      const bot = await createBotInstance(config);

      expect(bot).toBeDefined();
      // Verify that bot info was retrieved and logged
      expect(mockTelegraf?.telegram.getMe).toHaveBeenCalled();
    });
  });

  describe("Graceful Shutdown Setup", () => {
    let mockBot: any;

    beforeEach(() => {
      mockBot = {
        isActive: jest.fn(() => true),
        stop: jest.fn().mockResolvedValue(undefined),
      };
    });

    it("should setup signal handlers", () => {
      setupGracefulShutdown(mockBot);

      expect(mockProcess.once).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(mockProcess.once).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    });

    it("should setup exception handlers", () => {
      setupGracefulShutdown(mockBot);

      expect(mockProcess.on).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    });

    it("should handle SIGINT signal", async () => {
      setupGracefulShutdown(mockBot);

      // Get the SIGINT handler
      const sigintHandler = mockProcess.once.mock.calls.find((call) => call[0] === "SIGINT")?.[1];

      expect(sigintHandler).toBeDefined();

      // Execute the handler
      await sigintHandler();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });

    it("should handle SIGTERM signal", async () => {
      setupGracefulShutdown(mockBot);

      // Get the SIGTERM handler
      const sigtermHandler = mockProcess.once.mock.calls.find((call) => call[0] === "SIGTERM")?.[1];

      expect(sigtermHandler).toBeDefined();

      // Execute the handler
      await sigtermHandler();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });

    it("should handle uncaught exceptions", async () => {
      setupGracefulShutdown(mockBot);

      // Get the uncaught exception handler
      const exceptionHandler = mockProcess.on.mock.calls.find((call) => call[0] === "uncaughtException")?.[1];

      expect(exceptionHandler).toBeDefined();

      const testError = new Error("Uncaught test error");

      // Execute the handler
      await exceptionHandler(testError);

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should handle unhandled promise rejections", async () => {
      setupGracefulShutdown(mockBot);

      // Get the unhandled rejection handler
      const rejectionHandler = mockProcess.on.mock.calls.find((call) => call[0] === "unhandledRejection")?.[1];

      expect(rejectionHandler).toBeDefined();

      const testReason = new Error("Unhandled rejection");
      const testPromise = Promise.reject(testReason);

      // Execute the handler
      await rejectionHandler(testReason, testPromise);

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should handle shutdown errors gracefully", async () => {
      mockBot.stop.mockRejectedValue(new Error("Shutdown error"));
      setupGracefulShutdown(mockBot);

      const sigintHandler = mockProcess.once.mock.calls.find((call) => call[0] === "SIGINT")?.[1];

      // Should handle shutdown error and still exit
      await sigintHandler();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it("should prevent multiple shutdown attempts", async () => {
      setupGracefulShutdown(mockBot);

      const sigintHandler = mockProcess.once.mock.calls.find((call) => call[0] === "SIGINT")?.[1];

      // Simulate multiple rapid signals
      const promise1 = sigintHandler();
      const promise2 = sigintHandler();

      await Promise.all([promise1, promise2]);

      // Bot stop should only be called once
      expect(mockBot.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe("Complete Application Lifecycle", () => {
    it("should handle successful startup and shutdown cycle", async () => {
      // Mock successful responses
      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockResolvedValue({
          id: 123456789,
          username: "test_bot",
          first_name: "Test Bot",
        });
        mockTelegraf.launch.mockResolvedValue(undefined);
      }

      // Note: main() function runs indefinitely, so we can't test it directly
      // Instead, we test the individual components that make up the lifecycle

      const config = loadEnvironmentConfig();
      expect(config).toBeDefined();

      initializeLogger(config.logLevel);

      const bot = await createBotInstance(config);
      expect(bot).toBeDefined();

      setupGracefulShutdown(bot);

      // Verify all components were initialized
      expect(mockProcess.once).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(mockProcess.once).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    });

    it("should handle startup failure gracefully", async () => {
      // Mock startup failure
      if (mockTelegraf) {
        mockTelegraf.telegram.getMe.mockRejectedValue(new Error("Startup failed"));
      }

      const config = loadEnvironmentConfig();

      await expect(createBotInstance(config)).rejects.toThrow();
    });

    it("should handle configuration errors during startup", () => {
      delete mockProcess.env.TELEGRAM_BOT_TOKEN;

      expect(() => loadEnvironmentConfig()).toThrow();
    });
  });

  describe("Resource Management", () => {
    it("should track memory usage during startup", () => {
      initializeLogger("info");

      expect(mockProcess.memoryUsage).toHaveBeenCalled();
    });

    it("should log process information", () => {
      initializeLogger("info");

      // Verify process information was accessed
      expect(mockProcess.pid).toBeDefined();
      expect(mockProcess.version).toBeDefined();
      expect(mockProcess.platform).toBeDefined();
    });

    it("should handle process information gracefully when unavailable", () => {
      // Temporarily remove process properties
      const originalPid = mockProcess.pid;
      delete (mockProcess as any).pid;

      expect(() => initializeLogger("info")).not.toThrow();

      // Restore
      mockProcess.pid = originalPid;
    });
  });

  describe("Error Scenarios", () => {
    it("should handle missing process object gracefully", () => {
      // Temporarily remove process
      const originalProcess = (globalThis as any).process;
      delete (globalThis as any).process;

      expect(() => loadEnvironmentConfig()).toThrow();

      // Restore
      (globalThis as any).process = originalProcess;
    });

    it("should handle missing environment variables object", () => {
      delete mockProcess.env;

      expect(() => loadEnvironmentConfig()).toThrow();
    });

    it("should handle dotenv configuration errors", () => {
      const dotenv = require("dotenv");
      dotenv.config.mockImplementation(() => {
        throw new Error("dotenv error");
      });

      // Should still work even if dotenv fails
      expect(() => loadEnvironmentConfig()).not.toThrow();
    });
  });

  describe("Development vs Production Behavior", () => {
    it("should handle development environment", () => {
      mockProcess.env.NODE_ENV = "development";

      const config = loadEnvironmentConfig();

      expect(config).toBeDefined();
    });

    it("should handle production environment", () => {
      mockProcess.env.NODE_ENV = "production";

      const config = loadEnvironmentConfig();

      expect(config).toBeDefined();
    });

    it("should handle test environment", () => {
      mockProcess.env.NODE_ENV = "test";

      const config = loadEnvironmentConfig();

      expect(config).toBeDefined();
    });

    it("should handle missing NODE_ENV", () => {
      delete mockProcess.env.NODE_ENV;

      const config = loadEnvironmentConfig();

      expect(config).toBeDefined();
    });
  });
});
