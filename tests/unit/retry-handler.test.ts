import {
  RetryHandler,
  defaultRetryHandler,
  quickRetryHandler,
  aggressiveRetryHandler,
} from "../../src/utils/retry-handler";
import logger from "../../src/utils/logger";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock setTimeout for faster tests
jest.useFakeTimers();

describe("RetryHandler", () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler(3, 2.0, 100);
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe("retryWithBackoff", () => {
    it("should succeed on first attempt", async () => {
      const mockFunc = jest.fn().mockResolvedValue("success");

      const result = await retryHandler.retryWithBackoff(mockFunc, "test-context");

      expect(result).toBe("success");
      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("should retry on retryable errors and succeed", async () => {
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockRejectedValueOnce(new Error("Connection reset"))
        .mockResolvedValue("success");

      const promise = retryHandler.retryWithBackoff(mockFunc, "test-context");

      // Fast-forward through delays
      jest.runAllTimers();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFunc).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith("Operation succeeded after retry", {
        attempt: 3,
        context: "test-context",
      });
    });

    it("should throw non-retryable errors immediately", async () => {
      const mockFunc = jest.fn().mockRejectedValue(new Error("Invalid input"));

      await expect(retryHandler.retryWithBackoff(mockFunc)).rejects.toThrow("Invalid input");

      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith("Non-retryable error encountered", {
        error: "Invalid input",
        attempt: 1,
        context: undefined,
      });
    });

    it("should exhaust all retries and throw last error", async () => {
      const mockFunc = jest.fn().mockRejectedValue(new Error("Network error"));

      const promise = retryHandler.retryWithBackoff(mockFunc, "test-context");

      // Fast-forward through all delays
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Network error");

      expect(mockFunc).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(logger.error).toHaveBeenCalledWith("All retry attempts exhausted", {
        error: "Network error",
        totalAttempts: 4,
        context: "test-context",
      });
    });

    it("should handle string errors", async () => {
      const mockFunc = jest.fn().mockRejectedValue("String error");

      const promise = retryHandler.retryWithBackoff(mockFunc);
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("String error");
    });
  });

  describe("retrySimple", () => {
    it("should succeed on first attempt", async () => {
      const mockFunc = jest.fn().mockResolvedValue("success");

      const result = await retryHandler.retrySimple(mockFunc, 2, "simple-test");

      expect(result).toBe("success");
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it("should retry and succeed", async () => {
      const mockFunc = jest.fn().mockRejectedValueOnce(new Error("Timeout")).mockResolvedValue("success");

      const result = await retryHandler.retrySimple(mockFunc, 2, "simple-test");

      expect(result).toBe("success");
      expect(mockFunc).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith("Simple retry attempt", {
        error: "Timeout",
        attempt: 1,
        maxAttempts: 3,
        context: "simple-test",
      });
    });

    it("should throw non-retryable errors immediately", async () => {
      const mockFunc = jest.fn().mockRejectedValue(new Error("Invalid input"));

      await expect(retryHandler.retrySimple(mockFunc, 2)).rejects.toThrow("Invalid input");

      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it("should use default maxRetries when not specified", async () => {
      const mockFunc = jest.fn().mockRejectedValue(new Error("Network error"));

      await expect(retryHandler.retrySimple(mockFunc)).rejects.toThrow("Network error");

      expect(mockFunc).toHaveBeenCalledTimes(4); // 1 initial + 3 retries (default)
    });
  });

  describe("isRetryableError", () => {
    const testCases = [
      { error: "Network timeout", expected: true },
      { error: "Connection reset", expected: true },
      { error: "ECONNRESET", expected: true },
      { error: "Rate limit exceeded", expected: true },
      { error: "Service unavailable", expected: true },
      { error: "Invalid input", expected: false },
      { error: "Unauthorized", expected: false },
      { error: "Not found", expected: false },
    ];

    testCases.forEach(({ error, expected }) => {
      it(`should return ${expected} for "${error}"`, () => {
        const mockFunc = jest.fn().mockRejectedValue(new Error(error));

        // Access private method through any cast for testing
        const isRetryable = (retryHandler as any).isRetryableError(new Error(error));

        expect(isRetryable).toBe(expected);
      });
    });
  });

  describe("calculateDelay", () => {
    it("should calculate exponential backoff with jitter", () => {
      // Access private method for testing
      const calculateDelay = (retryHandler as any).calculateDelay.bind(retryHandler);

      const delay0 = calculateDelay(0);
      const delay1 = calculateDelay(1);
      const delay2 = calculateDelay(2);

      // Base delay is 100ms, backoff factor is 2.0
      expect(delay0).toBeGreaterThanOrEqual(100);
      expect(delay0).toBeLessThan(110); // 100 + 10% jitter

      expect(delay1).toBeGreaterThanOrEqual(200);
      expect(delay1).toBeLessThan(220); // 200 + 10% jitter

      expect(delay2).toBeGreaterThanOrEqual(400);
      expect(delay2).toBeLessThan(440); // 400 + 10% jitter
    });
  });

  describe("static create", () => {
    it("should create RetryHandler with custom config", () => {
      const customHandler = RetryHandler.create({
        maxRetries: 5,
        backoffFactor: 1.5,
        baseDelay: 500,
      });

      expect(customHandler).toBeInstanceOf(RetryHandler);
      expect((customHandler as any).maxRetries).toBe(5);
      expect((customHandler as any).backoffFactor).toBe(1.5);
      expect((customHandler as any).baseDelay).toBe(500);
    });

    it("should create RetryHandler with partial config", () => {
      const customHandler = RetryHandler.create({
        maxRetries: 2,
      });

      expect(customHandler).toBeInstanceOf(RetryHandler);
      expect((customHandler as any).maxRetries).toBe(2);
    });
  });

  describe("exported instances", () => {
    it("should export default retry handler", () => {
      expect(defaultRetryHandler).toBeInstanceOf(RetryHandler);
    });

    it("should export quick retry handler", () => {
      expect(quickRetryHandler).toBeInstanceOf(RetryHandler);
    });

    it("should export aggressive retry handler", () => {
      expect(aggressiveRetryHandler).toBeInstanceOf(RetryHandler);
    });
  });
});
