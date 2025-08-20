import { SecurityService } from "../../../src/services/security-service";
import { TelegrafContext } from "../../../src/types";

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("SecurityService", () => {
  let securityService: SecurityService;
  let mockContext: Partial<TelegrafContext>;

  beforeEach(() => {
    securityService = new SecurityService();
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
      reply: jest.fn().mockResolvedValue({}),
    };

    // Add telegram methods to context
    (mockContext as any).telegram = {
      getMe: jest.fn().mockResolvedValue({
        id: 111111,
        username: "testbot",
        first_name: "Test Bot",
      }),
      getChatMember: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateChatType", () => {
    it("should return true for allowed chat types", () => {
      const result = securityService.validateChatType(mockContext as TelegrafContext);
      expect(result).toBe(true);
    });

    it("should return false for disallowed chat types", () => {
      mockContext.chat!.type = "unknown";
      const result = securityService.validateChatType(mockContext as TelegrafContext, ["private", "group"]);
      expect(result).toBe(false);
    });

    it("should return false when chat information is missing", () => {
      mockContext.chat = undefined;
      const result = securityService.validateChatType(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });

    it("should use custom allowed types when provided", () => {
      mockContext.chat!.type = "private";
      const result = securityService.validateChatType(mockContext as TelegrafContext, ["group", "supergroup"]);
      expect(result).toBe(false);
    });
  });

  describe("checkBotPermissions", () => {
    it("should return true for private chats", async () => {
      mockContext.chat!.type = "private";
      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
    });

    it("should check group permissions for group chats", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "member",
      });

      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
      expect((mockContext as any).telegram.getChatMember).toHaveBeenCalledWith(123456, 111111);
    });

    it("should return false for restricted bot in groups", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "restricted",
      });

      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });

    it("should check admin permissions for channels", async () => {
      mockContext.chat!.type = "channel";
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "administrator",
      });

      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
    });

    it("should return false for non-admin bot in channels", async () => {
      mockContext.chat!.type = "channel";
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "member",
      });

      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      (mockContext as any).telegram.getMe.mockRejectedValue(new Error("API Error"));

      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });

    it("should return false when chat information is missing", async () => {
      mockContext.chat = undefined;
      const result = await securityService.checkBotPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });
  });

  describe("checkUserAdminPermissions", () => {
    it("should return true for private chats", async () => {
      mockContext.chat!.type = "private";
      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
    });

    it("should return true for administrators", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "administrator",
      });

      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
      expect((mockContext as any).telegram.getChatMember).toHaveBeenCalledWith(123456, 789012);
    });

    it("should return true for creators", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "creator",
      });

      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext);
      expect(result).toBe(true);
    });

    it("should return false for regular members", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "member",
      });

      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });

    it("should check specific user ID when provided", async () => {
      const targetUserId = 999999;
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "administrator",
      });

      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext, targetUserId);
      expect(result).toBe(true);
      expect((mockContext as any).telegram.getChatMember).toHaveBeenCalledWith(123456, targetUserId);
    });

    it("should handle API errors gracefully", async () => {
      (mockContext as any).telegram.getChatMember.mockRejectedValue(new Error("User not found"));

      const result = await securityService.checkUserAdminPermissions(mockContext as TelegrafContext);
      expect(result).toBe(false);
    });
  });

  describe("validateCommandPermissions", () => {
    it("should validate regular commands successfully", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "member",
      });

      const result = await securityService.validateCommandPermissions(mockContext as TelegrafContext, "chatid", false);
      expect(result).toBe(true);
    });

    it("should require admin permissions for admin commands", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "member",
      });

      const result = await securityService.validateCommandPermissions(mockContext as TelegrafContext, "admin", true);
      expect(result).toBe(false);
    });

    it("should allow admin commands for administrators", async () => {
      (mockContext as any).telegram.getChatMember.mockResolvedValue({
        status: "administrator",
      });

      const result = await securityService.validateCommandPermissions(mockContext as TelegrafContext, "admin", true);
      expect(result).toBe(true);
    });

    it("should check bot permissions", async () => {
      (mockContext as any).telegram.getChatMember
        .mockResolvedValueOnce({ status: "administrator" }) // User check
        .mockResolvedValueOnce({ status: "restricted" }); // Bot check

      const result = await securityService.validateCommandPermissions(mockContext as TelegrafContext, "admin", true);
      expect(result).toBe(false);
    });
  });

  describe("sanitizeErrorMessage", () => {
    it("should sanitize forbidden errors", () => {
      const error = new Error("Forbidden: bot was blocked by the user");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("🚫 Bot 无法发送消息。请检查 Bot 是否被阻止或缺少权限。");
    });

    it("should sanitize not found errors", () => {
      const error = new Error("Bad Request: chat not found");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("❌ 找不到指定的聊天。");
    });

    it("should sanitize rate limit errors", () => {
      const error = new Error("Too Many Requests: retry after 30");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("⏰ 请求过于频繁，请稍后再试。");
    });

    it("should sanitize bad request errors", () => {
      const error = new Error("Bad Request: invalid command format");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("❌ 请求格式不正确，请检查命令格式。");
    });

    it("should sanitize token errors without exposing details", () => {
      const error = new Error("Unauthorized: invalid token");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("🔧 Bot 配置问题，请联系管理员。");
    });

    it("should provide generic message for unknown errors", () => {
      const error = new Error("Some unknown error");
      const result = securityService.sanitizeErrorMessage(error, mockContext as TelegrafContext);
      expect(result).toBe("❌ 处理请求时出现问题，请稍后再试。");
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events with context", () => {
      const logger = require("../../../src/utils/logger");

      securityService.logSecurityEvent("rate_limit_exceeded", mockContext as TelegrafContext, {
        reason: "too_many_requests",
      });

      expect(logger.info).toHaveBeenCalledWith("Security event", {
        event: "rate_limit_exceeded",
        chatId: 123456,
        chatType: "group",
        userId: 789012,
        username: "testuser",
        timestamp: expect.any(String),
        reason: "too_many_requests",
      });
    });
  });
});
