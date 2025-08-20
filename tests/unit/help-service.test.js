"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const help_service_1 = require("../../src/services/help-service");
describe("HelpService", () => {
    let helpService;
    beforeEach(() => {
        helpService = new help_service_1.HelpService();
    });
    describe("getHelpMessage", () => {
        it("should return help message with all available commands", () => {
            const helpMessage = helpService.getHelpMessage();
            expect(helpMessage).toContain("Telegram Chat ID Bot 帮助");
            expect(helpMessage).toContain("/start");
            expect(helpMessage).toContain("/help");
            expect(helpMessage).toContain("/chatid");
            expect(helpMessage).toContain("/info");
            expect(helpMessage).toContain("使用说明");
            expect(helpMessage).toContain("群组");
            expect(helpMessage).toContain("私聊");
            expect(helpMessage).toContain("Chat ID");
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
            expect(helpMessage).toContain("*");
            expect(helpMessage).toMatch(/\*.*\*/);
        });
    });
    describe("getStartMessage", () => {
        it("should return welcome message with basic usage guide", () => {
            const startMessage = helpService.getStartMessage();
            expect(startMessage).toContain("欢迎");
            expect(startMessage).toContain("Telegram Chat ID Bot");
            expect(startMessage).toContain("快速开始");
            expect(startMessage).toContain("/chatid");
            expect(startMessage).toContain("/info");
            expect(startMessage).toContain("/help");
            expect(startMessage).toContain("Bot 功能");
            expect(startMessage).toContain("适用场景");
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
            const unknownMessage = helpService.getUnknownCommandMessage();
            expect(unknownMessage).toContain("未知命令");
            expect(unknownMessage).toContain("不理解");
            expect(unknownMessage).toContain("/help");
            expect(unknownMessage).toContain("可用的命令");
            expect(unknownMessage).toContain("提示");
            expect(unknownMessage).toContain("/");
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
            expect(unknownMessage).toContain("*");
            expect(unknownMessage).toMatch(/\*.*\*/);
        });
        it("should provide examples of correct command format", () => {
            const unknownMessage = helpService.getUnknownCommandMessage();
            expect(unknownMessage).toContain("/chatid");
            expect(unknownMessage).toContain("/info");
        });
    });
    describe("HelpService class", () => {
        it("should be instantiable", () => {
            expect(helpService).toBeInstanceOf(help_service_1.HelpService);
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
            expect(helpMessage).toMatch(/[🤖📋💡❓]/);
            expect(startMessage).toMatch(/[👋🎯🚀💼]/);
            expect(unknownMessage).toMatch(/[❓💡]/);
        });
        it("should ensure messages are in Chinese", () => {
            const helpMessage = helpService.getHelpMessage();
            const startMessage = helpService.getStartMessage();
            const unknownMessage = helpService.getUnknownCommandMessage();
            expect(helpMessage).toMatch(/[\u4e00-\u9fff]/);
            expect(startMessage).toMatch(/[\u4e00-\u9fff]/);
            expect(unknownMessage).toMatch(/[\u4e00-\u9fff]/);
        });
        it("should ensure all messages mention key commands", () => {
            const helpMessage = helpService.getHelpMessage();
            const startMessage = helpService.getStartMessage();
            const unknownMessage = helpService.getUnknownCommandMessage();
            [helpMessage, startMessage, unknownMessage].forEach((message) => {
                expect(message).toContain("/help");
            });
        });
    });
});
//# sourceMappingURL=help-service.test.js.map