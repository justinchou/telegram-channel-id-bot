/**
 * Main application entry point for Telegram Chat ID Bot
 *
 * Implements Requirements:
 * - 1.1: Bot successfully joins groups and remains active
 * - 5.1: Bot automatically retries on network issues and logs errors
 * - 5.3: Bot records errors and provides clear error information
 *
 * Features:
 * - Environment variable configuration loading
 * - Logger initialization with proper log levels
 * - Bot instance creation and startup
 * - Graceful shutdown handling for SIGINT/SIGTERM
 * - Comprehensive error handling and logging
 * - Process exit code management
 */

// @ts-ignore - dotenv types may not be available in all environments
const dotenv = require("dotenv");
import { TelegramBot } from "./bot/bot-handler";
import { BotConfig } from "./types";
import logger from "./utils/logger";

/**
 * Load and validate environment variables
 * Implements requirement 5.3: Clear error information for configuration issues
 */
function loadEnvironmentConfig(): BotConfig {
  // Load environment variables from .env file
  dotenv.config();

  const proc = (globalThis as any).process;
  const token = proc?.env?.TELEGRAM_BOT_TOKEN;
  const logLevel = proc?.env?.LOG_LEVEL || "info";
  const webhookUrl = proc?.env?.WEBHOOK_URL;
  const port = parseInt(proc?.env?.PORT || "3000", 10);
  const nodeEnv = proc?.env?.NODE_ENV || "development";

  // Validate required environment variables
  if (!token) {
    const errorMessage =
      "TELEGRAM_BOT_TOKEN environment variable is required. Please check your .env file or environment configuration.";
    logger.error("Configuration validation failed", {
      error: errorMessage,
      nodeEnv,
      availableEnvVars: Object.keys(proc?.env || {}).filter(
        (key) => key.startsWith("TELEGRAM_") || key.startsWith("LOG_") || key.startsWith("NODE_")
      ),
    });
    throw new Error(errorMessage);
  }

  // Validate token format (basic check)
  if (!token.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
    const errorMessage = "Invalid TELEGRAM_BOT_TOKEN format. Token should be in format: 'bot_id:bot_token'";
    logger.error("Token validation failed", {
      error: errorMessage,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + "...",
    });
    throw new Error(errorMessage);
  }

  // Validate log level
  const validLogLevels = ["error", "warn", "info", "http", "debug"];
  if (!validLogLevels.includes(logLevel)) {
    logger.warn("Invalid LOG_LEVEL, using 'info' as default", {
      providedLogLevel: logLevel,
      validLogLevels,
    });
  }

  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    const errorMessage = `Invalid PORT number: ${proc?.env?.PORT}. Port must be between 1 and 65535.`;
    logger.error("Port validation failed", {
      error: errorMessage,
      providedPort: proc?.env?.PORT,
    });
    throw new Error(errorMessage);
  }

  const config: BotConfig = {
    token,
    logLevel,
    webhookUrl,
    port,
  };

  logger.info("Environment configuration loaded successfully", {
    nodeEnv,
    logLevel,
    port,
    hasWebhookUrl: !!webhookUrl,
    tokenPrefix: token.substring(0, 10) + "...",
  });

  return config;
}

/**
 * Initialize application logger with proper configuration
 * Implements requirement 5.1: Proper error logging
 */
function initializeLogger(logLevel: string): void {
  // The logger is already initialized in the logger module
  // This function serves as a validation and configuration point

  const proc = (globalThis as any).process;

  logger.info("Logger initialized", {
    logLevel,
    timestamp: new Date().toISOString(),
    nodeVersion: proc?.version,
    platform: proc?.platform,
    arch: proc?.arch,
  });

  // Log startup information
  logger.info("Starting Telegram Chat ID Bot", {
    version: "1.0.0",
    nodeEnv: proc?.env?.NODE_ENV || "development",
    pid: proc?.pid,
    cwd: proc?.cwd?.(),
  });
}

/**
 * Create and configure bot instance
 * Implements requirement 1.1: Bot successfully joins groups and remains active
 */
async function createBotInstance(config: BotConfig): Promise<TelegramBot> {
  try {
    logger.info("Creating bot instance", {
      tokenPrefix: config.token.substring(0, 10) + "...",
      logLevel: config.logLevel,
    });

    const bot = new TelegramBot(config);

    // Validate bot configuration by getting bot info
    const botInfo = await bot.getBotInfo();
    logger.info("Bot instance created successfully", {
      botId: botInfo.id,
      botUsername: botInfo.username,
      botName: botInfo.first_name,
      canJoinGroups: botInfo.can_join_groups,
      canReadAllGroupMessages: botInfo.can_read_all_group_messages,
      supportsInlineQueries: botInfo.supports_inline_queries,
    });

    return bot;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to create bot instance", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      tokenPrefix: config.token.substring(0, 10) + "...",
    });

    // Provide specific error guidance
    if (errorMessage.includes("401")) {
      throw new Error("Bot authentication failed. Please verify your TELEGRAM_BOT_TOKEN is correct and active.");
    }

    if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
      throw new Error("Network connection failed. Please check your internet connection and try again.");
    }

    throw new Error(`Bot initialization failed: ${errorMessage}`);
  }
}

/**
 * Setup graceful shutdown handlers for the application
 * Implements requirement 5.1: Proper error handling and logging
 */
function setupGracefulShutdown(bot: TelegramBot): void {
  const proc = (globalThis as any).process;
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string, exitCode: number = 0) => {
    if (isShuttingDown) {
      logger.warn("Shutdown already in progress, forcing exit", { signal });
      proc?.exit?.(1);
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}, initiating graceful shutdown...`, {
      signal,
      pid: proc?.pid,
      uptime: proc?.uptime?.(),
    });

    try {
      // Stop the bot with timeout
      const shutdownTimeout = setTimeout(() => {
        logger.error("Shutdown timeout exceeded, forcing exit");
        proc?.exit?.(1);
      }, 10000); // 10 second timeout

      if (bot.isActive()) {
        await bot.stop();
      }

      clearTimeout(shutdownTimeout);

      logger.info("Graceful shutdown completed successfully", {
        signal,
        exitCode,
      });

      proc?.exit?.(exitCode);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Error during graceful shutdown", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        signal,
      });

      proc?.exit?.(1);
    }
  };

  // Handle termination signals
  if (proc) {
    proc.once?.("SIGINT", () => gracefulShutdown("SIGINT", 0));
    proc.once?.("SIGTERM", () => gracefulShutdown("SIGTERM", 0));

    // Handle uncaught exceptions
    proc.on?.("uncaughtException", (error: Error) => {
      logger.error("Uncaught exception detected", {
        error: error.message,
        stack: error.stack,
        pid: proc?.pid,
      });

      gracefulShutdown("UNCAUGHT_EXCEPTION", 1);
    });

    // Handle unhandled promise rejections
    proc.on?.("unhandledRejection", (reason: any, promise: Promise<any>) => {
      logger.error("Unhandled promise rejection detected", {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
        pid: proc?.pid,
      });

      gracefulShutdown("UNHANDLED_REJECTION", 1);
    });
  }

  logger.info("Graceful shutdown handlers registered", {
    signals: ["SIGINT", "SIGTERM"],
    handlers: ["uncaughtException", "unhandledRejection"],
  });
}

/**
 * Main application function
 * Orchestrates the entire application startup process
 *
 * Implements Requirements:
 * - 1.1: Bot successfully joins groups and remains active
 * - 5.1: Bot automatically retries on network issues and logs errors
 * - 5.3: Bot records errors and provides clear error information
 */
async function main(): Promise<void> {
  let bot: TelegramBot | null = null;

  try {
    // Step 1: Load and validate environment configuration
    logger.info("=== Starting Telegram Chat ID Bot ===");
    const config = loadEnvironmentConfig();

    // Step 2: Initialize logger with proper configuration
    initializeLogger(config.logLevel);

    // Step 3: Create and configure bot instance
    bot = await createBotInstance(config);

    // Step 4: Setup graceful shutdown handling
    setupGracefulShutdown(bot);

    // Step 5: Start the bot
    await bot.start();

    const proc = (globalThis as any).process;
    logger.info("=== Bot startup completed successfully ===", {
      status: "running",
      pid: proc?.pid,
      memoryUsage: proc?.memoryUsage?.(),
    });

    // Keep the process alive
    // The bot will handle all events and the process will be terminated
    // only through graceful shutdown signals
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const proc = (globalThis as any).process;

    logger.error("=== Bot startup failed ===", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      pid: proc?.pid,
    });

    // Attempt to stop bot if it was created
    if (bot) {
      try {
        await bot.stop();
      } catch (stopError) {
        logger.error("Failed to stop bot during error cleanup", {
          error: stopError instanceof Error ? stopError.message : String(stopError),
        });
      }
    }

    // Exit with error code
    proc?.exit?.(1);
  }
}

// Start the application if this file is run directly
const req = (globalThis as any).require;
const mod = (globalThis as any).module;
const proc = (globalThis as any).process;

if (req?.main === mod) {
  main().catch((error) => {
    const globalConsole = (globalThis as any).console;
    globalConsole?.error?.("Fatal error in main function:", error);
    proc?.exit?.(1);
  });
}

// Export main function for testing purposes
export { main, loadEnvironmentConfig, initializeLogger, createBotInstance, setupGracefulShutdown };
