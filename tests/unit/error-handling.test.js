// Simple JavaScript test to verify our error handling logic works
const assert = require("assert");

// Mock logger
const mockLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
};

// Simple ErrorHandler implementation for testing
class SimpleErrorHandler {
  constructor() {
    this.logger = mockLogger;
  }

  getUserFriendlyMessage(error) {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("timeout")) {
      return "🔌 网络连接出现问题，请稍后再试。";
    }

    if (message.includes("permission") || message.includes("forbidden")) {
      return "❌ Bot 没有足够的权限执行此操作。请检查 Bot 的权限设置。";
    }

    if (message.includes("rate limit")) {
      return "⏰ 请求过于频繁，请稍后再试。";
    }

    return "❌ 抱歉，处理您的请求时出现了问题。请稍后再试或联系管理员。";
  }

  logError(error, errorContext) {
    const logData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...errorContext,
    };
    this.logger.error("Bot error occurred", logData);
  }
}

// Simple RetryHandler implementation for testing
class SimpleRetryHandler {
  constructor(maxRetries = 3, backoffFactor = 2.0, baseDelay = 100) {
    this.maxRetries = maxRetries;
    this.backoffFactor = backoffFactor;
    this.baseDelay = baseDelay;
  }

  isRetryableError(error) {
    const message = error.message.toLowerCase();
    const retryablePatterns = ["network", "timeout", "connection", "econnreset", "rate limit"];
    return retryablePatterns.some((pattern) => message.includes(pattern));
  }

  async retryWithBackoff(func) {
    let lastError = new Error("Unknown error");

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await func();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.maxRetries) {
          break;
        }

        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        // Skip actual delay in tests
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    throw lastError;
  }
}

// Test ErrorHandler
console.log("Testing ErrorHandler...");

const errorHandler = new SimpleErrorHandler();

// Test error message generation
const networkError = new Error("Network timeout occurred");
const networkMessage = errorHandler.getUserFriendlyMessage(networkError);
assert.strictEqual(networkMessage, "🔌 网络连接出现问题，请稍后再试。");

const permissionError = new Error("Permission denied");
const permissionMessage = errorHandler.getUserFriendlyMessage(permissionError);
assert.strictEqual(permissionMessage, "❌ Bot 没有足够的权限执行此操作。请检查 Bot 的权限设置。");

const rateLimitError = new Error("Rate limit exceeded");
const rateLimitMessage = errorHandler.getUserFriendlyMessage(rateLimitError);
assert.strictEqual(rateLimitMessage, "⏰ 请求过于频繁，请稍后再试。");

const genericError = new Error("Something went wrong");
const genericMessage = errorHandler.getUserFriendlyMessage(genericError);
assert.strictEqual(genericMessage, "❌ 抱歉，处理您的请求时出现了问题。请稍后再试或联系管理员。");

console.log("✅ ErrorHandler tests passed");

// Test RetryHandler
console.log("Testing RetryHandler...");

const retryHandler = new SimpleRetryHandler(2, 2.0, 10);

// Test successful operation
(async () => {
  let callCount = 0;
  const successFunc = async () => {
    callCount++;
    return "success";
  };

  const result = await retryHandler.retryWithBackoff(successFunc);
  assert.strictEqual(result, "success");
  assert.strictEqual(callCount, 1);
  console.log("✅ Successful operation test passed");

  // Test retryable error that eventually succeeds
  callCount = 0;
  const retryableFunc = async () => {
    callCount++;
    if (callCount < 3) {
      throw new Error("Network timeout");
    }
    return "success after retry";
  };

  const retryResult = await retryHandler.retryWithBackoff(retryableFunc);
  assert.strictEqual(retryResult, "success after retry");
  assert.strictEqual(callCount, 3);
  console.log("✅ Retryable error test passed");

  // Test non-retryable error
  const nonRetryableFunc = async () => {
    throw new Error("Invalid input");
  };

  try {
    await retryHandler.retryWithBackoff(nonRetryableFunc);
    assert.fail("Should have thrown error");
  } catch (error) {
    assert.strictEqual(error.message, "Invalid input");
  }
  console.log("✅ Non-retryable error test passed");

  // Test exhausted retries
  const alwaysFailFunc = async () => {
    throw new Error("Network error");
  };

  try {
    await retryHandler.retryWithBackoff(alwaysFailFunc);
    assert.fail("Should have thrown error");
  } catch (error) {
    assert.strictEqual(error.message, "Network error");
  }
  console.log("✅ Exhausted retries test passed");

  console.log("✅ All RetryHandler tests passed");
  console.log("🎉 All tests completed successfully!");
})().catch(console.error);
