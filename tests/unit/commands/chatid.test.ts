import { ChatIdCommandHandler } from "../../../src/commands/chatid";
import { TelegrafContext } from "../../../src/types";
import { ChatInfoService } from "../../../src/services/chat-info-service";
import { ErrorHandler } from "../../../src/utils/error-handler";

// Mock the dependencies
jest.mock("../../../src/services/chat-info-service");
jest.mock("../../../src/utils/error-handler");

describe("ChatIdCommandHandler", () => {
  let handler: ChatIdCommandHandler;
  let mockChatInfoService: jest.Mocked<ChatInfoService>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let mockContext: jest.Mocked<TelegrafContext>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create handler instance
    handler = new ChatIdCommandHandler();

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
    it("should handle /chatid command successfully in group chat", async () => {
      // Arrange
      const expectedChatId = "123456789";
      mockChatInfoService.getChatId.mockResolvedValue(expectedChatId);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockChatInfoService.getChatId).toHaveBeenCalledWith(mockContext);
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Chat ID Information"), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedChatId), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Group Chat"), { parse_mode: "Markdown" });
    });

    it("should handle /chatid command successfully in private chat", async () => {
      // Arrange
      const expectedChatId = "987654321";
      mockContext.chat!.type = "private";
      mockChatInfoService.getChatId.mockResolvedValue(expectedChatId);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockChatInfoService.getChatId).toHaveBeenCalledWith(mockContext);
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Private Chat"), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedChatId), {
        parse_mode: "Markdown",
      });
    });

    it("should handle /chatid command successfully in supergroup", async () => {
      // Arrange
      const expectedChatId = "-1001234567890";
      mockContext.chat!.type = "supergroup";
      mockChatInfoService.getChatId.mockResolvedValue(expectedChatId);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Supergroup"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedChatId), {
        parse_mode: "Markdown",
      });
    });

    it("should handle /chatid command successfully in channel", async () => {
      // Arrange
      const expectedChatId = "-1001234567890";
      mockContext.chat!.type = "channel";
      mockChatInfoService.getChatId.mockResolvedValue(expectedChatId);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("Channel"), { parse_mode: "Markdown" });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedChatId), {
        parse_mode: "Markdown",
      });
    });

    it("should handle error when chat information is not available", async () => {
      // Arrange
      mockContext.chat = undefined;

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        expect.any(Error),
        expect.objectContaining({
          command: "chatid",
          chatId: undefined,
          userId: mockContext.from?.id,
        })
      );
    });

    it("should handle error when ChatInfoService throws", async () => {
      // Arrange
      const serviceError = new Error("Service error");
      mockChatInfoService.getChatId.mockRejectedValue(serviceError);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "chatid",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });

    it("should include correct error context when handling errors", async () => {
      // Arrange
      const serviceError = new Error("Test error");
      mockChatInfoService.getChatId.mockRejectedValue(serviceError);

      // Act
      await handler.handle(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "chatid",
          chatId: 123456789,
          userId: 987654321,
          metadata: expect.objectContaining({
            chatType: "group",
            timestamp: expect.any(String),
          }),
        })
      );
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

  describe("formatChatIdResponse", () => {
    it("should format response correctly for different chat types", () => {
      // This is testing the private method indirectly through handle()
      // We can verify the output contains the expected elements

      const testCases = [
        { type: "private", expectedText: "Private Chat" },
        { type: "group", expectedText: "Group Chat" },
        { type: "supergroup", expectedText: "Supergroup" },
        { type: "channel", expectedText: "Channel" },
      ];

      testCases.forEach(async ({ type, expectedText }) => {
        mockContext.chat!.type = type;
        mockChatInfoService.getChatId.mockResolvedValue("123456789");

        await handler.handle(mockContext);

        expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedText), {
          parse_mode: "Markdown",
        });
      });
    });
  });
});
