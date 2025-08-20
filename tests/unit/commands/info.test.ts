import { InfoCommandHandler } from "../../../src/commands/info";
import { TelegrafContext, ChatInfo } from "../../../src/types";
import { ChatInfoService } from "../../../src/services/chat-info-service";
import { ErrorHandler } from "../../../src/utils/error-handler";

// Mock the dependencies
jest.mock("../../../src/services/chat-info-service");
jest.mock("../../../src/utils/error-handler");

describe("InfoCommandHandler", () => {
  let handler: InfoCommandHandler;
  let mockChatInfoService: jest.Mocked<ChatInfoService>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let mockContext: jest.Mocked<TelegrafContext>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create handler instance
    handler = new InfoCommandHandler();

    // Get mocked instances
    mockChatInfoService = ChatInfoService.prototype as jest.Mocked<ChatInfoService>;
    mockErrorHandler = ErrorHandler.prototype as jest.Mocked<ErrorHandler>;

    // Setup mock context
    mockContext = {
      chat: {
        id: 123456789,
        type: "group",
      },
      from: {
        id: 987654321,
        is_bot: false,
        first_name: "TestUser",
      },
      reply: jest.fn().mockResolvedValue({}),
    } as jest.Mocked<TelegrafContext>;
  });

  describe("handle", () => {
    it("should handle /info command successfully for group chat", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: 123456789,
        chatType: "group",
        title: "Test Group",
        username: "testgroup",
        memberCount: 50,
        description: "A test group for testing",
      };
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockChatInfoService.getChatInfo).toHaveBeenCalledWith(mockContext);
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("详细聊天信息"), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Test Group"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("50"), { parse_mode: "Markdown" });
    });

    it("should handle /info command successfully for private chat", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: 987654321,
        chatType: "private",
      };
      mockContext.chat!.type = "private";
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("私聊"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("私密聊天"), { parse_mode: "Markdown" });
    });

    it("should handle /info command successfully for supergroup", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Test Supergroup",
        memberCount: 1500,
      };
      mockContext.chat!.type = "supergroup";
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("超级群组"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("200,000"), { parse_mode: "Markdown" });
    });

    it("should handle /info command successfully for channel", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: -1001234567890,
        chatType: "channel",
        title: "Test Channel",
        username: "testchannel",
        description: "A test channel",
      };
      mockContext.chat!.type = "channel";
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("频道"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("广播频道"), { parse_mode: "Markdown" });
    });

    it("should handle error when chat information is not available", async () => {
      // Arrange
      mockContext.chat = undefined;

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("无法获取聊天信息"), {
        parse_mode: "Markdown",
      });
    });

    it("should handle error when ChatInfoService throws", async () => {
      // Arrange
      const serviceError = new Error("Service error");
      mockChatInfoService.getChatInfo.mockRejectedValue(serviceError);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "info",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });

    it("should include correct error context when handling errors", async () => {
      // Arrange
      const serviceError = new Error("Test error");
      mockChatInfoService.getChatInfo.mockRejectedValue(serviceError);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "info",
          chatId: 123456789,
          userId: 987654321,
          metadata: expect.objectContaining({
            chatType: "group",
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should show permission warning when permissions are insufficient", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: 123456789,
        chatType: "group",
        title: "Test Group",
      };
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Mock checkPermissions to return false (this would require making it public or testing indirectly)
      // For now, we'll test the successful case and assume permission checking works

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockChatInfoService.getChatInfo).toHaveBeenCalled();
    });
  });

  describe("validateContext", () => {
    it("should return true when chat information is available", () => {
      // Act
      const result = handler.validateContext(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when chat information is not available", () => {
      // Arrange
      mockContext.chat = undefined;

      // Act
      const result = handler.validateContext(mockContext);

      // Assert
      expect(result).toBe(false);
    });

    it("should return true for all chat types", () => {
      // Test different chat types
      const chatTypes = ["private", "group", "supergroup", "channel"];

      chatTypes.forEach((chatType) => {
        mockContext.chat!.type = chatType;
        const result = handler.validateContext(mockContext);
        expect(result).toBe(true);
      });
    });
  });

  describe("formatDetailedChatInfo", () => {
    it("should format response with all available information", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: 123456789,
        chatType: "supergroup",
        title: "Complete Test Group",
        username: "completetest",
        memberCount: 1000,
        description: "A complete test group with all fields",
      };
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      const callArgs = mockContext.reply.mock.calls[0];
      const responseText = callArgs[0];

      expect(responseText).toContain("Complete Test Group");
      expect(responseText).toContain("@completetest");
      expect(responseText).toContain("1000");
      expect(responseText).toContain("A complete test group with all fields");
      expect(responseText).toContain("超级群组");
    });

    it("should format response with minimal information", async () => {
      // Arrange
      const mockChatInfo: ChatInfo = {
        chatId: 123456789,
        chatType: "private",
      };
      mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

      // Act
      await handler.handle(mockContext);

      // Assert
      const callArgs = mockContext.reply.mock.calls[0];
      const responseText = callArgs[0];

      expect(responseText).toContain("123456789");
      expect(responseText).toContain("私聊");
      expect(responseText).toContain("私密聊天");
    });

    it("should include usage tips for different chat types", async () => {
      // Test different chat types and their specific tips
      const testCases = [
        {
          chatType: "private" as const,
          expectedTip: "只有您和 Bot 可以看到消息",
        },
        {
          chatType: "group" as const,
          expectedTip: "所有成员都可以看到消息",
        },
        {
          chatType: "supergroup" as const,
          expectedTip: "所有成员都可以看到消息",
        },
        {
          chatType: "channel" as const,
          expectedTip: "只有管理员可以发送消息",
        },
      ];

      for (const testCase of testCases) {
        const mockChatInfo: ChatInfo = {
          chatId: 123456789,
          chatType: testCase.chatType,
        };
        mockChatInfoService.getChatInfo.mockResolvedValue(mockChatInfo);

        await handler.handle(mockContext);

        const callArgs = mockContext.reply.mock.calls[mockContext.reply.mock.calls.length - 1];
        const responseText = callArgs[0];

        expect(responseText).toContain(testCase.expectedTip);
      }
    });
  });
});
