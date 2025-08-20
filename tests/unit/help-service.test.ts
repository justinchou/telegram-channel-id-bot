import { HelpService } from "../../src/services/help-service";

describe("HelpService", () => {
  let helpService: HelpService;

  beforeEach(() => {
    helpService = new HelpService();
  });

  describe("getHelpMessage", () => {
    it("should return help message with all available commands", () => {
      // Requirements: 4.1 - 用户发送 "/help" 命令时回复可用命令列表和使用说明
      const helpMessage = helpService.getHelpMessage();

      // 验证消息包含标题
      expect(helpMessage).toContain("Telegram Chat ID Bot 帮助");

      // 验证包含所有必需的命令
      expect(helpMessage).toContain("/start");
      expect(helpMessage).toContain("/help");
      expect(helpMessage).toContain("/chatid");
      expect(helpMessage).toContain("/info");

      // 验证包含使用说明
      expect(helpMessage).toContain("使用说明");
      expect(helpMessage).toContain("群组");
      expect(helpMessage).toContain("私聊");
      expect(helpMessage).toContain("Chat ID");

      // 验证消息不为空且有合理长度
      expect(helpMessage).toBeTruthy();
      expect(helpMessage.length).toBeGreaterThan(100);
    });

    it("should return consistent message on multiple calls", () => {
      const message1 = helpService.getHelpMessage();
      const message2 = helpService.getHelpMessage();

      expect(message1).toBe(message2);
    });

    it("should include markdown formatting", () => {
      const helpMessage = helpService.getHelpMessage();

      // 验证包含 Markdown 格式
      expect(helpMessage).toContain("*");
      expect(helpMessage).toMatch(/\*.*\*/);
    });
  });

  describe("getStartMessage", () => {
    it("should return welcome message with basic usage guide", () => {
      // Requirements: 4.2 - 用户发送 "/start" 命令时回复欢迎消息和基本使用指南
      const startMessage = helpService.getStartMessage();

      // 验证包含欢迎信息
      expect(startMessage).toContain("欢迎");
      expect(startMessage).toContain("Telegram Chat ID Bot");

      // 验证包含基本使用指南
      expect(startMessage).toContain("快速开始");
      expect(startMessage).toContain("/chatid");
      expect(startMessage).toContain("/info");
      expect(startMessage).toContain("/help");

      // 验证包含功能说明
      expect(startMessage).toContain("Bot 功能");
      expect(startMessage).toContain("适用场景");

      // 验证消息不为空且有合理长度
      expect(startMessage).toBeTruthy();
      expect(startMessage.length).toBeGreaterThan(100);
    });

    it("should return consistent message on multiple calls", () => {
      const message1 = helpService.getStartMessage();
      const message2 = helpService.getStartMessage();

      expect(message1).toBe(message2);
    });

    it("should include markdown formatting", () => {
      const startMessage = helpService.getStartMessage();

      // 验证包含 Markdown 格式
      expect(startMessage).toContain("*");
      expect(startMessage).toMatch(/\*.*\*/);
    });

    it("should mention help command for more details", () => {
      const startMessage = helpService.getStartMessage();

      expect(startMessage).toContain("/help");
    });
  });

  describe("getUnknownCommandMessage", () => {
    it("should return message prompting user to use help command", () => {
      // Requirements: 4.3 - 用户发送未知命令时提示使用 "/help" 查看可用命令
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证包含未知命令提示
      expect(unknownMessage).toContain("未知命令");
      expect(unknownMessage).toContain("不理解");

      // 验证提示使用 help 命令
      expect(unknownMessage).toContain("/help");
      expect(unknownMessage).toContain("可用的命令");

      // 验证包含使用提示
      expect(unknownMessage).toContain("提示");
      expect(unknownMessage).toContain("/");

      // 验证消息不为空
      expect(unknownMessage).toBeTruthy();
      expect(unknownMessage.length).toBeGreaterThan(20);
    });

    it("should return consistent message on multiple calls", () => {
      const message1 = helpService.getUnknownCommandMessage();
      const message2 = helpService.getUnknownCommandMessage();

      expect(message1).toBe(message2);
    });

    it("should include markdown formatting", () => {
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证包含 Markdown 格式
      expect(unknownMessage).toContain("*");
      expect(unknownMessage).toMatch(/\*.*\*/);
    });

    it("should provide examples of correct command format", () => {
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证包含命令格式示例
      expect(unknownMessage).toContain("/chatid");
      expect(unknownMessage).toContain("/info");
    });
  });

  describe("HelpService class", () => {
    it("should be instantiable", () => {
      expect(helpService).toBeInstanceOf(HelpService);
    });

    it("should have all required methods", () => {
      expect(typeof helpService.getHelpMessage).toBe("function");
      expect(typeof helpService.getStartMessage).toBe("function");
      expect(typeof helpService.getUnknownCommandMessage).toBe("function");
    });

    it("should return string values for all methods", () => {
      expect(typeof helpService.getHelpMessage()).toBe("string");
      expect(typeof helpService.getStartMessage()).toBe("string");
      expect(typeof helpService.getUnknownCommandMessage()).toBe("string");
    });
  });

  describe("Message content validation", () => {
    it("should ensure all messages are user-friendly", () => {
      const helpMessage = helpService.getHelpMessage();
      const startMessage = helpService.getStartMessage();
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证消息都包含友好的表情符号
      expect(helpMessage).toMatch(/[🤖📋💡❓]/);
      expect(startMessage).toMatch(/[👋🎯🚀💼]/);
      expect(unknownMessage).toMatch(/[❓💡]/);
    });

    it("should ensure messages are in Chinese", () => {
      const helpMessage = helpService.getHelpMessage();
      const startMessage = helpService.getStartMessage();
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证消息包含中文字符
      expect(helpMessage).toMatch(/[\u4e00-\u9fff]/);
      expect(startMessage).toMatch(/[\u4e00-\u9fff]/);
      expect(unknownMessage).toMatch(/[\u4e00-\u9fff]/);
    });

    it("should ensure all messages mention key commands", () => {
      const helpMessage = helpService.getHelpMessage();
      const startMessage = helpService.getStartMessage();
      const unknownMessage = helpService.getUnknownCommandMessage();

      // 验证关键命令在消息中被提及
      [helpMessage, startMessage, unknownMessage].forEach((message) => {
        expect(message).toContain("/help");
      });
    });
  });
});
