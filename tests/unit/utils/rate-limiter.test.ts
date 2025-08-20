import { RateLimiter, RateLimitConfig } from "../../../src/utils/rate-limiter";

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  let config: RateLimitConfig;

  beforeEach(() => {
    config = {
      maxRequests: 5,
      timeWindow: 60000, // 1 minute
      penaltyTime: 300000, // 5 minutes
      useProgressivePenalty: true,
    };
    rateLimiter = new RateLimiter(config);
  });

  afterEach(() => {
    rateLimiter.stop();
    jest.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", () => {
      const userId = 12345;

      for (let i = 0; i < config.maxRequests; i++) {
        const result = rateLimiter.checkRateLimit(userId);
        expect(result.isLimited).toBe(false);
      }
    });

    it("should block requests exceeding limit", () => {
      const userId = 12345;

      // Make requests up to the limit
      for (let i = 0; i < config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // Next request should be blocked
      const result = rateLimiter.checkRateLimit(userId);
      expect(result.isLimited).toBe(true);
      expect(result.reason).toBe("rate_limit");
      expect(result.remainingTime).toBeGreaterThan(0);
    });

    it("should reset limit after time window", () => {
      const userId = 12345;
      const originalNow = Date.now;
      const startTime = Date.now();

      // Exhaust the limit
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // Mock time passage beyond both rate limit window and penalty time
      jest.spyOn(Date, "now").mockReturnValue(startTime + config.timeWindow + config.penaltyTime! + 1000);

      // Should be allowed again
      const result = rateLimiter.checkRateLimit(userId);
      expect(result.isLimited).toBe(false);

      Date.now = originalNow;
    });

    it("should apply penalty for rate limit violations", () => {
      const userId = 12345;

      // Exhaust the limit to trigger penalty
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // Mock time passage to after rate limit window but before penalty expires
      const futureTime = Date.now() + config.timeWindow + 1000;
      jest.spyOn(Date, "now").mockReturnValue(futureTime);

      // Should still be blocked due to penalty
      const result = rateLimiter.checkRateLimit(userId);
      expect(result.isLimited).toBe(true);
      expect(result.reason).toBe("penalty");

      jest.restoreAllMocks();
    });

    it("should use progressive penalties for repeat offenders", () => {
      const userId = 12345;

      // First violation
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // Wait for rate limit to reset but penalty to remain
      let currentTime = Date.now() + config.timeWindow + 1000;
      jest.spyOn(Date, "now").mockReturnValue(currentTime);

      // Second violation
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // The penalty should be longer now
      currentTime = Date.now() + config.timeWindow + 1000;
      jest.spyOn(Date, "now").mockReturnValue(currentTime);

      const result = rateLimiter.checkRateLimit(userId);
      expect(result.isLimited).toBe(true);
      expect(result.reason).toBe("penalty");

      jest.restoreAllMocks();
    });

    it("should handle chat-specific rate limits", () => {
      const chatId = 67890;
      const chatLimit = config.maxRequests * 5; // Chat limit is 5x user limit

      // Use different users to make requests to the same chat
      // This way we can hit the chat limit without hitting individual user limits
      for (let i = 0; i < chatLimit; i++) {
        const userId = 10000 + i; // Different user for each request
        const result = rateLimiter.checkRateLimit(userId, chatId);
        expect(result.isLimited).toBe(false);
      }

      // Next request with a new user should be blocked by chat limit
      const freshUserId = 99999;
      const result = rateLimiter.checkRateLimit(freshUserId, chatId);
      expect(result.isLimited).toBe(true);
      expect(result.reason).toBe("chat_limit");
    });

    it("should handle custom rate limit config", () => {
      const userId = 12345;
      const customConfig = {
        maxRequests: 2,
        timeWindow: 30000,
      };

      // Make requests up to custom limit
      for (let i = 0; i < customConfig.maxRequests; i++) {
        const result = rateLimiter.checkRateLimit(userId, undefined, customConfig);
        expect(result.isLimited).toBe(false);
      }

      // Next request should be blocked
      const result = rateLimiter.checkRateLimit(userId, undefined, customConfig);
      expect(result.isLimited).toBe(true);
    });

    it("should track different users independently", () => {
      const user1 = 11111;
      const user2 = 22222;

      // Exhaust limit for user1
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(user1);
      }

      // User1 should be blocked
      expect(rateLimiter.checkRateLimit(user1).isLimited).toBe(true);

      // User2 should still be allowed
      expect(rateLimiter.checkRateLimit(user2).isLimited).toBe(false);
    });
  });

  describe("getStatistics", () => {
    it("should return correct statistics", () => {
      const user1 = 11111;
      const user2 = 22222;
      const chatId = 33333;

      // Make some requests
      rateLimiter.checkRateLimit(user1);
      rateLimiter.checkRateLimit(user2, chatId);

      // Trigger penalty for user1
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(user1);
      }

      const stats = rateLimiter.getStatistics();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalChats).toBe(1);
      expect(stats.activeUsers).toBe(2);
      expect(stats.penalizedUsers).toBe(1);
    });
  });

  describe("clearUserLimit", () => {
    it("should clear rate limit for specific user", () => {
      const userId = 12345;

      // Exhaust the limit
      for (let i = 0; i <= config.maxRequests; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // Should be blocked
      expect(rateLimiter.checkRateLimit(userId).isLimited).toBe(true);

      // Clear the limit
      rateLimiter.clearUserLimit(userId);

      // Should be allowed again
      expect(rateLimiter.checkRateLimit(userId).isLimited).toBe(false);
    });
  });

  describe("clearChatLimit", () => {
    it("should clear rate limit for specific chat", () => {
      const userId = 12345;
      const chatId = 67890;

      // Exhaust chat limit
      for (let i = 0; i <= config.maxRequests * 5; i++) {
        rateLimiter.checkRateLimit(userId, chatId);
      }

      // Should be blocked by chat limit
      expect(rateLimiter.checkRateLimit(userId, chatId).isLimited).toBe(true);

      // Clear chat limit
      rateLimiter.clearChatLimit(chatId);

      // Should be allowed again (assuming user limit not exceeded)
      const result = rateLimiter.checkRateLimit(userId, chatId);
      // Note: might still be blocked by user limit, so we check the reason
      if (result.isLimited) {
        expect(result.reason).not.toBe("chat_limit");
      }
    });
  });

  describe("cleanup", () => {
    it("should clean up expired entries", (done) => {
      const userId = 12345;

      // Make a request
      rateLimiter.checkRateLimit(userId);

      // Verify user is tracked
      expect(rateLimiter.getStatistics().totalUsers).toBe(1);

      // Mock time passage beyond cleanup threshold
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + config.timeWindow + 1000);

      // Wait for cleanup interval (we'll trigger it manually for testing)
      setTimeout(() => {
        // Trigger cleanup by calling private method through any
        (rateLimiter as any).cleanup();

        // User should be cleaned up
        expect(rateLimiter.getStatistics().totalUsers).toBe(0);

        jest.restoreAllMocks();
        done();
      }, 100);
    });
  });

  describe("stop", () => {
    it("should stop the rate limiter and clear data", () => {
      const userId = 12345;

      // Make a request
      rateLimiter.checkRateLimit(userId);
      expect(rateLimiter.getStatistics().totalUsers).toBe(1);

      // Stop the rate limiter
      rateLimiter.stop();

      // Data should be cleared
      expect(rateLimiter.getStatistics().totalUsers).toBe(0);
    });
  });
});
