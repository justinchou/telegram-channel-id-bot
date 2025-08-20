// Test the compiled JavaScript output
const { ErrorHandler } = require("../../dist/utils/error-handler");
const { RetryHandler } = require("../../dist/utils/retry-handler");
const logger = require("../../dist/utils/logger").default;

console.log("Testing compiled JavaScript output...");

// Test logger
console.log("Testing logger...");
logger.info("Test info message");
logger.error("Test error message", { context: "test" });
logger.warn("Test warning message");
console.log("✅ Logger test passed");

// Test ErrorHandler
console.log("Testing ErrorHandler...");
const errorHandler = new ErrorHandler();

// Mock context
const mockContext = {
  reply: async (text) => {
    console.log(`Mock reply: ${text}`);
    return Promise.resolve();
  },
  chat: { id: 12345, type: "group" },
  from: { id: 67890, is_bot: false, first_name: "Test" },
  message: { message_id: 1, date: Date.now(), chat: { id: 12345, type: "group" } },
};

// Test error handling
(async () => {
  try {
    const testError = new Error("Network timeout occurred");
    await errorHandler.handleError(mockContext, testError);
    console.log("✅ ErrorHandler test passed");

    // Test RetryHandler
    console.log("Testing RetryHandler...");
    const retryHandler = new RetryHandler(2, 2.0, 10);

    let callCount = 0;
    const testFunc = async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error("Network error");
      }
      return "success";
    };

    const result = await retryHandler.retryWithBackoff(testFunc);
    console.log(`Retry result: ${result}, calls: ${callCount}`);
    console.log("✅ RetryHandler test passed");

    console.log("🎉 All compiled tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
})();
