import { HelpCommandHandler } from "../../../src/commands/help";
import { TelegrafContext } from "../../../src/types";
import { HelpService } from "../../../src/services/help-service";
import { ErrorHandler } from "../../../src/utils/error-handler";

// Mock the dependencies
jest.mock("../../../src/services/help-service");
jest.mock("../../../src/utils/error-handler");

describe("HelpCommandHandler", () => {
  let handler: HelpCommandHandler;
  let mockHelpService: jest.Mocked<HelpService>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let mockContext: jest.Mocked<TelegrafContext>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create handler instance
    handler = new HelpCommandHandler();

    // Get mocked instances
    mockHelpService = HelpService.prototype as jest.Mocked<HelpService>;
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

  describe("handleHelp", () => {
    it("should handle /help command successfully", async () => {
      // Arrange
      const expectedHelpMessage = "Help message content";
      mockHelpService.getHelpMessage.mockReturnValue(expectedHelpMessage);

      // Act
      await handler.handleHelp(mockContext);

      // Assert
      expect(mockHelpService.getHelpMessage).toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expectedHelpMessage, { parse_mode: "Markdown" });
    });

    it("should handle error when help service throws", async () => {
      // Arrange
      const serviceError = new Error("Help service error");
      mockHelpService.getHelpMessage.mockImplementation(() => {
        throw serviceError;
      });

      // Act
      await handler.handleHelp(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "help",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });

    it("should include correct error context when handling errors", async () => {
      // Arrange
      const serviceError = new Error("Test error");
      mockHelpService.getHelpMessage.mockImplementation(() => {
        throw serviceError;
      });

      // Act
      await handler.handleHelp(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "help",
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

  describe("handleStart", () => {
    it("should handle /start command successfully", async () => {
      // Arrange
      const expectedStartMessage = "Welcome message content";
      mockHelpService.getStartMessage.mockReturnValue(expectedStartMessage);

      // Act
      await handler.handleStart(mockContext);

      // Assert
      expect(mockHelpService.getStartMessage).toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expectedStartMessage, { parse_mode: "Markdown" });
    });

    it("should log start command usage", async () => {
      // Arrange
      const expectedStartMessage = "Welcome message content";
      mockHelpService.getStartMessage.mockReturnValue(expectedStartMessage);

      // Act
      await handler.handleStart(mockContext);

      // Assert
      expect(mockErrorHandler.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          command: "start",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });

    it("should handle error when start service throws", async () => {
      // Arrange
      const serviceError = new Error("Start service error");
      mockHelpService.getStartMessage.mockImplementation(() => {
        throw serviceError;
      });

      // Act
      await handler.handleStart(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "start",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });
  });

  describe("handleUnknownCommand", () => {
    it("should handle unknown command without specific command", async () => {
      // Arrange
      const expectedUnknownMessage = "Unknown command message";
      mockHelpService.getUnknownCommandMessage.mockReturnValue(expectedUnknownMessage);

      // Act
      await handler.handleUnknownCommand(mockContext);

      // Assert
      expect(mockHelpService.getUnknownCommandMessage).toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expectedUnknownMessage, { parse_mode: "Markdown" });
    });

    it("should handle unknown command with specific command", async () => {
      // Arrange
      const expectedUnknownMessage = "Unknown command message";
      const unknownCommand = "/invalidcommand";
      mockHelpService.getUnknownCommandMessage.mockReturnValue(expectedUnknownMessage);

      // Act
      await handler.handleUnknownCommand(mockContext, unknownCommand);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(unknownCommand), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining(expectedUnknownMessage), {
        parse_mode: "Markdown",
      });
    });

    it("should log unknown command usage", async () => {
      // Arrange
      const unknownCommand = "/invalidcommand";
      const expectedUnknownMessage = "Unknown command message";
      mockHelpService.getUnknownCommandMessage.mockReturnValue(expectedUnknownMessage);

      // Act
      await handler.handleUnknownCommand(mockContext, unknownCommand);

      // Assert
      expect(mockErrorHandler.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          command: "unknown",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
          metadata: expect.objectContaining({
            unknownCommand: unknownCommand,
          }),
        })
      );
    });

    it("should handle error when unknown command service throws", async () => {
      // Arrange
      const serviceError = new Error("Unknown command service error");
      mockHelpService.getUnknownCommandMessage.mockImplementation(() => {
        throw serviceError;
      });

      // Act
      await handler.handleUnknownCommand(mockContext, "/test");

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        serviceError,
        expect.objectContaining({
          command: "unknown",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
        })
      );
    });
  });

  describe("handleBotAddedToGroup", () => {
    it("should handle bot being added to group", async () => {
      // Arrange
      mockContext.chat!.type = "group";
      (mockContext.chat as any).title = "Test Group";

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("欢迎！我已加入 Test Group"), {
        parse_mode: "Markdown",
      });
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("/chatid"), { parse_mode: "Markdown" });
    });

    it("should handle bot being added to supergroup", async () => {
      // Arrange
      mockContext.chat!.type = "supergroup";
      (mockContext.chat as any).title = "Test Supergroup";

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("欢迎！我已加入 Test Supergroup"), {
        parse_mode: "Markdown",
      });
    });

    it("should not send message when not in group or supergroup", async () => {
      // Arrange
      mockContext.chat!.type = "private";

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    it("should handle missing chat context", async () => {
      // Arrange
      mockContext.chat = undefined;

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    it("should log bot addition to group", async () => {
      // Arrange
      mockContext.chat!.type = "group";
      (mockContext.chat as any).title = "Test Group";

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockErrorHandler.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          command: "bot_added",
          chatId: mockContext.chat?.id,
          userId: mockContext.from?.id,
          metadata: expect.objectContaining({
            chatTitle: "Test Group",
          }),
        })
      );
    });

    it("should handle error when reply throws", async () => {
      // Arrange
      mockContext.chat!.type = "group";
      const replyError = new Error("Reply error");
      mockContext.reply.mockRejectedValue(replyError);

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockContext,
        replyError,
        expect.objectContaining({
          command: "bot_added",
        })
      );
    });
  });

  describe("validateContext", () => {
    it("should always return true for help commands", () => {
      // Test with different contexts
      const contexts = [
        { chat: { id: 123, type: "private" } },
        { chat: { id: 456, type: "group" } },
        { chat: { id: 789, type: "supergroup" } },
        { chat: { id: 101112, type: "channel" } },
        { chat: undefined },
      ];

      contexts.forEach((contextData) => {
        mockContext.chat = contextData.chat as any;
        const result = handler.validateContext(mockContext);
        expect(result).toBe(true);
      });
    });
  });

  describe("createGroupWelcomeMessage", () => {
    it("should create welcome message with group title", async () => {
      // Arrange
      mockContext.chat!.type = "group";
      (mockContext.chat as any).title = "My Test Group";

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("My Test Group"), {
        parse_mode: "Markdown",
      });
    });

    it("should create welcome message with default title when title is missing", async () => {
      // Arrange
      mockContext.chat!.type = "group";
      (mockContext.chat as any).title = undefined;

      // Act
      await handler.handleBotAddedToGroup(mockContext);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("群组"), { parse_mode: "Markdown" });
    });
  });
});
