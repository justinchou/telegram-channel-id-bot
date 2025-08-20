/**
 * Simple logger implementation without external dependencies
 * This is a fallback implementation for when winston is not available
 */

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  HTTP = "http",
  DEBUG = "debug",
}

// Removed unused interface

class SimpleLogger {
  private logLevel: string;

  constructor() {
    // Use environment variable or default to 'info'
    this.logLevel = (globalThis as any).process?.env?.LOG_LEVEL || "info";
  }

  private shouldLog(level: string): boolean {
    const levels = ["error", "warn", "info", "http", "debug"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      return `${baseMessage} ${JSON.stringify(meta)}`;
    }

    return baseMessage;
  }

  private log(level: string, message: string, meta?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);

    // Use console methods based on log level
    const globalConsole = (globalThis as any).console;
    switch (level) {
      case "error":
        globalConsole.error(formattedMessage);
        break;
      case "warn":
        globalConsole.warn(formattedMessage);
        break;
      case "debug":
        globalConsole.debug(formattedMessage);
        break;
      default:
        globalConsole.log(formattedMessage);
    }
  }

  error(message: string, meta?: any): void {
    this.log("error", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log("warn", message, meta);
  }

  info(message: string, meta?: any): void {
    this.log("info", message, meta);
  }

  http(message: string, meta?: any): void {
    this.log("http", message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log("debug", message, meta);
  }

  child(context: Record<string, any>): SimpleLogger {
    const childLogger = new SimpleLogger();

    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, meta?: any) => {
      const combinedMeta = { ...context, ...meta };
      originalLog(level, message, combinedMeta);
    };

    return childLogger;
  }
}

// Create and export logger instance
const logger = new SimpleLogger();

export default logger;

/**
 * Create a child logger with additional context
 * @param context - Additional context to include in all log messages
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, any>): SimpleLogger {
  return logger.child(context);
}
