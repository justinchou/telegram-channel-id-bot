import { CommandRouter } from "../../src/commands/command-router";
import { TelegrafContext } from "../../src/types";

describe("CommandRouter Integration Tests", () => {
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

  it("should initialize with default commands", () => {
    expect(router.isCommandRegistered("chatid")).toBe(true);
    expect(router.isCommandRegistered("info")).toBe(true);
    expect(router.isCommandRegistered("help")).toBe(true);
    expect(router.isCommandRegistered("start")).toBe(true);
  });

  it("should register and execute custom commands", async () => {
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    router.registerCommand({
      command: "test",
      handler: mockHandler,
      description: "Test command",
    });

    expect(router.isCommandRegistered("test")).toBe(true);

    // Mock message with command
    (mockContext.message as any).text = "/test";

    await router.routeCommand(mockContext);

    expect(mockHandler).toHaveBeenCalledWith(mockContext);
  });

  it("should handle middleware execution", async () => {
    const executionOrder: string[] = [];

    const middleware = async (ctx: TelegrafContext, next: () => Promise<void>) => {
      executionOrder.push("middleware");
      await next();
    };

    const mockHandler = jest.fn().mockImplementation(async () => {
      executionOrder.push("handler");
    });

    router.addMiddleware(middleware);
    router.registerCommand({
      command: "test",
      handler: mockHandler,
    });

    (mockContext.message as any).text = "/test";

    await router.routeCommand(mockContext);

    expect(executionOrder).toEqual(["middleware", "handler"]);
  });

  it("should validate chat types", async () => {
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    router.registerCommand({
      command: "privateonly",
      handler: mockHandler,
      allowedChatTypes: ["private"],
    });

    // Mock message in group chat (should be rejected)
    (mockContext.message as any).text = "/privateonly";
    mockContext.chat!.type = "group";

    await router.routeCommand(mockContext);

    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockContext.reply).toHaveBeenCalledWith(expect.stringContaining("不能在当前聊天类型中使用"), {
      parse_mode: "Markdown",
    });
  });

  it("should handle unknown commands gracefully", async () => {
    (mockContext.message as any).text = "/unknowncommand";

    await router.routeCommand(mockContext);

    // Should not throw and should handle unknown command
    expect(mockContext.reply).toHaveBeenCalled();
  });

  it("should ignore non-command messages", async () => {
    (mockContext.message as any).text = "This is not a command";

    await router.routeCommand(mockContext);

    // Should not call reply for non-commands
    expect(mockContext.reply).not.toHaveBeenCalled();
  });
});
