import { CommandRouter, CommandRegistration, CommandMiddleware } from "../../src/commands/command-router";
import { TelegrafContext } from "../../src/types";

// Mock the dependencies
jest.mock("../../src/utils/error-handler");
jest.mock("../../src/commands/chatid");
jest.mock("../../src/commands/info");
jest.mock("../../src/commands/help");

describe("CommandRouter", () => {
  let router: CommandRouter;
  let mockContext: TelegrafContext;

  beforeEach(() => {
    router = new CommandRouter();

    // Create mock context
    mockContext = {
      chat: {
        id: 123456789,
        type: "group",
      },
      from: {
        id: 987654321,
        is_bot: false,
        first_name: "Test User",
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: {
          id: 123456789,
          type: "group",
        },
      },
      reply: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Command Registration", () => {
    it("should register a new command successfully", () => {
      const mockHandler = jest.fn();
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
        description: "Test command",
      };

      router.registerCommand(registration);

      expect(router.isCommandRegistered("test")).toBe(true);
      expect(router.isCommandRegistered("/test")).toBe(true);
    });

    it("should register command aliases", () => {
      const mockHandler = jest.fn();
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
        aliases: ["t", "testing"],
      };

      router.registerCommand(registration);

      expect(router.isCommandRegistered("test")).toBe(true);
      expect(router.isCommandRegistered("t")).toBe(true);
      expect(router.isCommandRegistered("testing")).toBe(true);
    });

    it("should throw error for invalid command registration", () => {
      expect(() => {
        router.registerCommand({} as CommandRegistration);
      }).toThrow("Command and handler are required for registration");
    });

    it("should normalize command names by removing leading slash", () => {
      const mockHandler = jest.fn();
      const registration: CommandRegistration = {
        command: "/test",
        handler: mockHandler,
      };

      router.registerCommand(registration);

      expect(router.isCommandRegistered("test")).toBe(true);
      expect(router.isCommandRegistered("/test")).toBe(true);
    });
  });

  describe("Default Commands", () => {
    it("should have default commands registered", () => {
      expect(router.isCommandRegistered("chatid")).toBe(true);
      expect(router.isCommandRegistered("info")).toBe(true);
      expect(router.isCommandRegistered("help")).toBe(true);
      expect(router.isCommandRegistered("start")).toBe(true);
    });

    it("should have command aliases registered", () => {
      expect(router.isCommandRegistered("id")).toBe(true); // alias for chatid
      expect(router.isCommandRegistered("h")).toBe(true); // alias for help
    });

    it("should return list of registered commands", () => {
      const commands = router.getRegisteredCommands();

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((cmd) => cmd.command === "chatid")).toBe(true);
      expect(commands.some((cmd) => cmd.command === "info")).toBe(true);
      expect(commands.some((cmd) => cmd.command === "help")).toBe(true);
      expect(commands.some((cmd) => cmd.command === "start")).toBe(true);
    });
  });

  describe("Command Routing", () => {
    it("should route valid commands to their handlers", async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.registerCommand(registration);

      // Mock message with command
      (mockContext.message as any).text = "/test";

      await router.routeCommand(mockContext);

      expect(mockHandler).toHaveBeenCalledWith(mockContext);
    });

    it("should handle commands with bot username mentions", async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.registerCommand(registration);

      // Mock message with command and bot mention
      (mockContext.message as any).text = "/test@mybotname";

      await router.routeCommand(mockContext);

      expect(mockHandler).toHaveBeenCalledWith(mockContext);
    });

    it("should ignore non-command messages", async () => {
      // Mock regular message (not a command)
      (mockContext.message as any).text = "Hello, this is not a command";

      await router.routeCommand(mockContext);

      // Should not throw error or call any handlers
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    it("should handle unknown commands", async () => {
      // Mock message with unknown command
      (mockContext.message as any).text = "/unknowncommand";

      await router.routeCommand(mockContext);

      // Should call the unknown command handler (through help handler)
      expect(mockContext.reply).toHaveBeenCalled();
    });

    it("should validate command context for chat types", async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const registration: CommandRegistration = {
        command: "privateonly",
        handler: mockHandler,
        allowedChatTypes: ["private"],
      };

      router.registerCommand(registration);

      // Mock message in group chat (should be rejected)
      (mockContext.message as any).text = "/privateonly";
      mockContext.chat!.type = "group";

      await router.routeCommand(mockContext);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("不能在当前聊天类型中使用"), {
        parse_mode: "Markdown",
      });
    });
  });

  describe("Middleware Support", () => {
    it("should execute middleware before command handler", async () => {
      const executionOrder: string[] = [];

      const middleware: CommandMiddleware = async (_ctx, next) => {
        executionOrder.push("middleware");
        await next();
      };

      const mockHandler = jest.fn().mockImplementation(async () => {
        executionOrder.push("handler");
      });

      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.addMiddleware(middleware);
      router.registerCommand(registration);

      (mockContext.message as any).text = "/test";

      await router.routeCommand(mockContext);

      expect(executionOrder).toEqual(["middleware", "handler"]);
      expect(mockHandler).toHaveBeenCalledWith(mockContext);
    });

    it("should execute multiple middlewares in order", async () => {
      const executionOrder: string[] = [];

      const middleware1: CommandMiddleware = async (_ctx, next) => {
        executionOrder.push("middleware1");
        await next();
      };

      const middleware2: CommandMiddleware = async (_ctx, next) => {
        executionOrder.push("middleware2");
        await next();
      };

      const mockHandler = jest.fn().mockImplementation(async () => {
        executionOrder.push("handler");
      });

      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.addMiddleware(middleware1);
      router.addMiddleware(middleware2);
      router.registerCommand(registration);

      (mockContext.message as any).text = "/test";

      await router.routeCommand(mockContext);

      expect(executionOrder).toEqual(["middleware1", "middleware2", "handler"]);
    });

    it("should stop execution if middleware doesn't call next", async () => {
      const mockHandler = jest.fn();

      const blockingMiddleware: CommandMiddleware = async (ctx, _next) => {
        // Don't call next() - this should stop execution
        await ctx.reply("Blocked by middleware");
      };

      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.addMiddleware(blockingMiddleware);
      router.registerCommand(registration);

      (mockContext.message as any).text = "/test";

      await router.routeCommand(mockContext);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith("Blocked by middleware");
    });
  });

  describe("Static Middleware Factories", () => {
    describe("createLoggingMiddleware", () => {
      it("should create logging middleware that logs command execution", async () => {
        const consoleSpy = jest.spyOn(console, "log").mockImplementation();
        const loggingMiddleware = CommandRouter.createLoggingMiddleware();

        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const registration: CommandRegistration = {
          command: "test",
          handler: mockHandler,
        };

        router.addMiddleware(loggingMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/test";

        await router.routeCommand(mockContext);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Command executed: /test"),
          expect.objectContaining({
            chatId: mockContext.chat?.id,
            chatType: mockContext.chat?.type,
            userId: mockContext.from?.id,
          })
        );

        consoleSpy.mockRestore();
      });

      it("should log errors when command execution fails", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
        const loggingMiddleware = CommandRouter.createLoggingMiddleware();

        const mockHandler = jest.fn().mockRejectedValue(new Error("Test error"));
        const registration: CommandRegistration = {
          command: "test",
          handler: mockHandler,
        };

        router.addMiddleware(loggingMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/test";

        await expect(router.routeCommand(mockContext)).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Command failed: /test"),
          expect.objectContaining({
            error: "Test error",
          })
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe("createRateLimitMiddleware", () => {
      it("should allow commands within rate limit", async () => {
        const rateLimitMiddleware = CommandRouter.createRateLimitMiddleware(5, 60000);
        const mockHandler = jest.fn().mockResolvedValue(undefined);

        const registration: CommandRegistration = {
          command: "test",
          handler: mockHandler,
        };

        router.addMiddleware(rateLimitMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/test";

        // Execute command multiple times within limit
        for (let i = 0; i < 3; i++) {
          await router.routeCommand(mockContext);
        }

        expect(mockHandler).toHaveBeenCalledTimes(3);
      });

      it("should block commands when rate limit is exceeded", async () => {
        const rateLimitMiddleware = CommandRouter.createRateLimitMiddleware(2, 60000);
        const mockHandler = jest.fn().mockResolvedValue(undefined);

        const registration: CommandRegistration = {
          command: "test",
          handler: mockHandler,
        };

        router.addMiddleware(rateLimitMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/test";

        // Execute command up to limit
        await router.routeCommand(mockContext);
        await router.routeCommand(mockContext);

        // This should be blocked
        await router.routeCommand(mockContext);

        expect(mockHandler).toHaveBeenCalledTimes(2);
        expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("请求过于频繁"), {
          parse_mode: "Markdown",
        });
      });
    });

    describe("createAdminMiddleware", () => {
      it("should allow admin users to execute commands", async () => {
        const adminIds = [987654321]; // mockContext.from.id
        const adminMiddleware = CommandRouter.createAdminMiddleware(adminIds);
        const mockHandler = jest.fn().mockResolvedValue(undefined);

        const registration: CommandRegistration = {
          command: "admin",
          handler: mockHandler,
        };

        router.addMiddleware(adminMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/admin";

        await router.routeCommand(mockContext);

        expect(mockHandler).toHaveBeenCalledWith(mockContext);
      });

      it("should block non-admin users from executing commands", async () => {
        const adminIds = [111111111]; // Different from mockContext.from.id
        const adminMiddleware = CommandRouter.createAdminMiddleware(adminIds);
        const mockHandler = jest.fn().mockResolvedValue(undefined);

        const registration: CommandRegistration = {
          command: "admin",
          handler: mockHandler,
        };

        router.addMiddleware(adminMiddleware);
        router.registerCommand(registration);

        (mockContext.message as any).text = "/admin";

        await router.routeCommand(mockContext);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(mockContext.reply).toHaveBeenCalledWith("❌ 此命令需要管理员权限。", { parse_mode: "Markdown" });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in command execution", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error("Command execution failed"));
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.registerCommand(registration);

      (mockContext.message as any).text = "/test";

      // Should not throw, error should be handled internally
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
    });

    it("should handle errors in middleware execution", async () => {
      const errorMiddleware: CommandMiddleware = async (_ctx, _next) => {
        throw new Error("Middleware error");
      };

      const mockHandler = jest.fn();
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.addMiddleware(errorMiddleware);
      router.registerCommand(registration);

      (mockContext.message as any).text = "/test";

      // Should not throw, error should be handled internally
      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle context without message", async () => {
      const contextWithoutMessage = {
        ...mockContext,
        message: undefined,
      };

      await expect(router.routeCommand(contextWithoutMessage)).resolves.not.toThrow();
    });

    it("should handle context without chat", async () => {
      const contextWithoutChat = {
        ...mockContext,
        chat: undefined,
      };

      (contextWithoutChat.message as any).text = "/test";

      await expect(router.routeCommand(contextWithoutChat)).resolves.not.toThrow();
    });

    it("should handle empty command text", async () => {
      (mockContext.message as any).text = "/";

      await expect(router.routeCommand(mockContext)).resolves.not.toThrow();
    });

    it("should handle command with parameters", async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const registration: CommandRegistration = {
        command: "test",
        handler: mockHandler,
      };

      router.registerCommand(registration);

      (mockContext.message as any).text = "/test param1 param2";

      await router.routeCommand(mockContext);

      expect(mockHandler).toHaveBeenCalledWith(mockContext);
    });
  });
});
