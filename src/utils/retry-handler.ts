import logger from "./logger";

/**
 * Retry handler with exponential backoff for handling transient failures
 * Useful for network requests, API calls, and other operations that might fail temporarily
 */
export class RetryHandler {
  private maxRetries: number;
  private backoffFactor: number;
  private baseDelay: number;

  /**
   * Create a new RetryHandler instance
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param backoffFactor - Multiplier for exponential backoff (default: 2.0)
   * @param baseDelay - Base delay in milliseconds (default: 1000)
   */
  constructor(maxRetries: number = 3, backoffFactor: number = 2.0, baseDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.backoffFactor = backoffFactor;
    this.baseDelay = baseDelay;
  }

  /**
   * Execute a function with retry logic and exponential backoff
   * @param func - Function to execute
   * @param context - Optional context for logging
   * @returns Promise resolving to the function result
   */
  async retryWithBackoff<T>(func: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await func();

        // Log successful retry if it wasn't the first attempt
        if (attempt > 0) {
          logger.info("Operation succeeded after retry", {
            attempt: attempt + 1,
            context,
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          logger.warn("Non-retryable error encountered", {
            error: lastError.message,
            attempt: attempt + 1,
            context,
          });
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);

        logger.warn("Operation failed, retrying", {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          nextRetryIn: delay,
          context,
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    logger.error("All retry attempts exhausted", {
      error: lastError.message,
      totalAttempts: this.maxRetries + 1,
      context,
    });

    throw lastError;
  }

  /**
   * Execute a function with simple retry logic (no backoff)
   * @param func - Function to execute
   * @param retries - Number of retries (default: uses maxRetries)
   * @param context - Optional context for logging
   * @returns Promise resolving to the function result
   */
  async retrySimple<T>(func: () => Promise<T>, retries?: number, context?: string): Promise<T> {
    const maxAttempts = (retries ?? this.maxRetries) + 1;
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await func();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts - 1) {
          break;
        }

        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        logger.warn("Simple retry attempt", {
          error: lastError.message,
          attempt: attempt + 1,
          maxAttempts,
          context,
        });
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error is retryable
   * @param error - Error to check
   * @returns True if the error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      "network",
      "timeout",
      "connection",
      "econnreset",
      "enotfound",
      "econnrefused",
      "rate limit",
      "too many requests",
      "service unavailable",
      "internal server error",
      "bad gateway",
      "gateway timeout",
    ];

    return retryablePatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Calculate delay for exponential backoff
   * @param attempt - Current attempt number (0-based)
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number): number {
    const delay = this.baseDelay * Math.pow(this.backoffFactor, attempt);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;

    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => (globalThis as any).setTimeout(resolve, ms));
  }

  /**
   * Create a retry handler with custom configuration
   * @param config - Retry configuration
   * @returns New RetryHandler instance
   */
  static create(config: { maxRetries?: number; backoffFactor?: number; baseDelay?: number }): RetryHandler {
    return new RetryHandler(config.maxRetries, config.backoffFactor, config.baseDelay);
  }
}

/**
 * Default retry handler instance for common use cases
 */
export const defaultRetryHandler = new RetryHandler();

/**
 * Quick retry handler for fast operations
 */
export const quickRetryHandler = new RetryHandler(2, 1.5, 500);

/**
 * Aggressive retry handler for critical operations
 */
export const aggressiveRetryHandler = new RetryHandler(5, 2.0, 2000);
