import { SecurityMiddleware, SecurityMiddlewareConfig } from "../../../src/middleware/security-middleware";
import { TelegrafContext } from "../../../src/types";

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("SecurityMiddleware", () => {
  let securityMiddleware: SecurityMiddleware;
  let mockContext: Partial<TelegrafContext>;
  let mockNext: jest.Mock;
  let config: SecurityMiddlewareConfig;

  beforeEach(() => {
    config = {
      rateLimiting: {
        maxRequests: 5,
        timeWindow: 60000,
        penaltyTime: 300000,
        useProgressivePenalty: true,
      },
      checkBotPermissions: true,
      validateChatTypes: true,
      allowedChatTypes: ["private", "group", "supergroup"],
      requireAdmin: false,
      logSecurityEvents: true,
    };

    securityMiddleware = new SecurityMiddleware(config);
    mockNext = jest.fn().mockResolvedValue(undefined);

    mockContext = {
      chat: {
        id: 123456,
        type: "group",
        title: "Test Group",
      },
      from: {
        id: 789012,
        is_bot: false,
        first_name: "Test User",
        username: "testuser",
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: {
          id: 123456,
          type: "group",
        },
        text: "/test",
      },
      reply: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    securityMiddleware.stop();
    jest.clearAllMocks();
  });

  describe("createMiddleware", () => {
    it("should create middleware function", () => {
      const middleware = securityMiddleware.createMiddleware();
      expect(typeof middleware).toBe("function");
    });

    it("should pass through when all security checks pass", async () => {
      // Mock all security checks to pass
      const validateChatTypeSpy = jest
        .spyOn(securityMiddleware["securityService"], "validateChatType")
        .mockReturnValue(true);
      const checkBotPermissionsSpy = jest
        .spyOn(securityMiddleware["securityService"], "checkBotPermissions")
        .mockResolvedValue(true);
      const logSecurityEventSpy = jest
        .spyOn(securityMiddleware["securityService"], "logSecurityEvent")
        .mockImplementation();

      const checkRateLimitSpy = jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: false,
      });

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(validateChatTypeSpy).toHaveBeenCalled();
      expect(checkBotPermissionsSpy).toHaveBeenCalled();
      expect(checkRateLimitSpy).toHaveBeenCalled();
      expect(logSecurityEventSpy).toHaveBeenCalled();
    });

    it("should block when rate limit is exceeded", async () => {
      const checkRateLimitSpy = jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: true,
        remainingTime: 30,
        reason: "rate_limit",
      });

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("请求过于频繁"), {
        parse_mode: "Markdown",
      });
      expect(checkRateLimitSpy).toHaveBeenCalled();
    });

    it("should block when chat type is not allowed", async () => {
      // Mock rate limit to pass
      jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: false,
      });

      // Mock chat type validation to fail
      const validateChatTypeSpy = jest
        .spyOn(securityMiddleware["securityService"], "validateChatType")
        .mockReturnValue(false);

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("不能在当前聊天类型"), {
        parse_mode: "Markdown",
      });
      expect(validateChatTypeSpy).toHaveBeenCalled();
    });

    it("should block when bot lacks permissions", async () => {
      // Mock rate limit and chat type to pass
      jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: false,
      });
      jest.spyOn(securityMiddleware["securityService"], "validateChatType").mockReturnValue(true);

      // Mock bot permissions to fail
      const checkBotPermissionsSpy = jest
        .spyOn(securityMiddleware["securityService"], "checkBotPermissions")
        .mockResolvedValue(false);

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("没有足够的权限"), {
        parse_mode: "Markdown",
      });
      expect(checkBotPermissionsSpy).toHaveBeenCalled();
    });

    it("should block when admin permissions are required but user is not admin", async () => {
      // Mock all other checks to pass
      jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: false,
      });
      jest.spyOn(securityMiddleware["securityService"], "validateChatType").mockReturnValue(true);
      jest.spyOn(securityMiddleware["securityService"], "checkBotPermissions").mockResolvedValue(true);

      // Mock admin permissions to fail
      const checkUserAdminPermissionsSpy = jest
        .spyOn(securityMiddleware["securityService"], "checkUserAdminPermissions")
        .mockResolvedValue(false);

      const customConfig = { ...config, requireAdmin: true };
      const middleware = securityMiddleware.createMiddleware(customConfig);
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("需要管理员权限"), {
        parse_mode: "Markdown",
      });
      expect(checkUserAdminPermissionsSpy).toHaveBeenCalled();
    });

    it("should handle different rate limit reasons", async () => {
      const checkRateLimitSpy = jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: true,
        remainingTime: 120,
        reason: "penalty",
      });

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("频繁请求被暂时限制"), {
        parse_mode: "Markdown",
      });
      expect(checkRateLimitSpy).toHaveBeenCalled();
    });

    it("should handle chat limit reason", async () => {
      const checkRateLimitSpy = jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: true,
        remainingTime: 60,
        reason: "chat_limit",
      });

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("此聊天的请求过于频繁"), {
        parse_mode: "Markdown",
      });
      expect(checkRateLimitSpy).toHaveBeenCalled();
    });

    it("should handle missing user ID gracefully", async () => {
      delete mockContext.from;

      // Mock other checks to pass
      jest.spyOn(securityMiddleware["securityService"], "validateChatType").mockReturnValue(true);
      jest.spyOn(securityMiddleware["securityService"], "checkBotPermissions").mockResolvedValue(true);
      jest.spyOn(securityMiddleware["securityService"], "logSecurityEvent").mockImplementation();

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle security middleware errors gracefully", async () => {
      // Mock validation to throw error
      const validateChatTypeSpy = jest
        .spyOn(securityMiddleware["securityService"], "validateChatType")
        .mockImplementation(() => {
          throw new Error("Security check failed");
        });
      const sanitizeErrorMessageSpy = jest
        .spyOn(securityMiddleware["securityService"], "sanitizeErrorMessage")
        .mockReturnValue("安全检查失败");
      const logSecurityEventSpy = jest
        .spyOn(securityMiddleware["securityService"], "logSecurityEvent")
        .mockImplementation();

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith("安全检查失败", { parse_mode: "Markdown" });
      expect(validateChatTypeSpy).toHaveBeenCalled();
      expect(sanitizeErrorMessageSpy).toHaveBeenCalled();
      expect(logSecurityEventSpy).toHaveBeenCalled();
    });

    it("should handle reply errors gracefully", async () => {
      const checkRateLimitSpy = jest.spyOn(securityMiddleware["rateLimiter"], "checkRateLimit").mockReturnValue({
        isLimited: true,
        remainingTime: 30,
        reason: "rate_limit",
      });

      // Mock reply to throw error
      mockContext.reply = jest.fn().mockRejectedValue(new Error("Cannot send message"));

      const middleware = securityMiddleware.createMiddleware();
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(checkRateLimitSpy).toHaveBeenCalled();
      // Should not throw error even if reply fails
    });

    it("should skip checks when disabled in config", async () => {
      const customConfig = {
        checkBotPermissions: false,
        validateChatTypes: false,
        requireAdmin: false,
        logSecurityEvents: false,
      };

      const middleware = securityMiddleware.createMiddleware(customConfig);
      await middleware(mockContext as TelegrafContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("getStatistics", () => {
    it("should return rate limiter statistics", () => {
      const mockStats = {
        totalUsers: 5,
        totalChats: 3,
        penalizedUsers: 1,
        activeUsers: 4,
      };
      const getStatisticsSpy = jest
        .spyOn(securityMiddleware["rateLimiter"], "getStatistics")
        .mockReturnValue(mockStats);

      const stats = securityMiddleware.getStatistics();
      expect(stats).toEqual(mockStats);
      expect(getStatisticsSpy).toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("should stop rate limiter and log", () => {
      const stopSpy = jest.spyOn(securityMiddleware["rateLimiter"], "stop").mockImplementation();

      securityMiddleware.stop();

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
