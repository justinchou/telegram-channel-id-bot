import { ChatInfoService } from "../../src/services/chat-info-service";
import { ChatInfo, TelegrafContext } from "../../src/types";

describe("ChatInfoService", () => {
  let chatInfoService: ChatInfoService;

  beforeEach(() => {
    chatInfoService = new ChatInfoService();
  });

  describe("getChatId", () => {
    it("should return chat ID as string when chat is available", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 123456789,
          type: "group",
        },
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatId(mockContext);
      expect(result).toBe("123456789");
    });

    it("should throw error when chat is not available", async () => {
      const mockContext: TelegrafContext = {
        reply: jest.fn(),
      };

      await expect(chatInfoService.getChatId(mockContext)).rejects.toThrow("Chat information not available in context");
    });

    it("should handle negative chat IDs correctly", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -1001234567890,
          type: "supergroup",
        },
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatId(mockContext);
      expect(result).toBe("-1001234567890");
    });
  });

  describe("getChatInfo", () => {
    it("should return complete chat info for a private chat", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 123456789,
          type: "private",
        },
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatInfo(mockContext);

      expect(result).toEqual({
        chatId: 123456789,
        chatType: "private",
        title: undefined,
        username: undefined,
        memberCount: undefined,
        description: undefined,
      });
    });

    it("should return complete chat info for a group with all properties", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -1001234567890,
          type: "supergroup",
          title: "Test Supergroup",
          username: "testsupergroup",
          members_count: 150,
          description: "A test supergroup for unit testing",
        } as any,
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatInfo(mockContext);

      expect(result).toEqual({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Test Supergroup",
        username: "testsupergroup",
        memberCount: 150,
        description: "A test supergroup for unit testing",
      });
    });

    it("should handle group chat type correctly", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -123456789,
          type: "group",
          title: "Test Group",
        } as any,
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatInfo(mockContext);

      expect(result.chatType).toBe("group");
      expect(result.title).toBe("Test Group");
    });

    it("should handle channel chat type correctly", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: -1001234567890,
          type: "channel",
          title: "Test Channel",
          username: "testchannel",
        } as any,
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatInfo(mockContext);

      expect(result.chatType).toBe("channel");
      expect(result.title).toBe("Test Channel");
      expect(result.username).toBe("testchannel");
    });

    it("should default to group type for unknown chat types", async () => {
      const mockContext: TelegrafContext = {
        chat: {
          id: 123456789,
          type: "unknown_type",
        } as any,
        reply: jest.fn(),
      };

      const result = await chatInfoService.getChatInfo(mockContext);

      expect(result.chatType).toBe("group");
    });

    it("should throw error when chat is not available", async () => {
      const mockContext: TelegrafContext = {
        reply: jest.fn(),
      };

      await expect(chatInfoService.getChatInfo(mockContext)).rejects.toThrow(
        "Chat information not available in context"
      );
    });
  });

  describe("formatChatInfo", () => {
    it("should format private chat info correctly", () => {
      const chatInfo: ChatInfo = {
        chatId: 123456789,
        chatType: "private",
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      expect(result).toBe("🆔 Chat ID: `123456789`\n👤 Type: private");
    });

    it("should format group chat info with all properties", () => {
      const chatInfo: ChatInfo = {
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Test Supergroup",
        username: "testsupergroup",
        memberCount: 150,
        description: "A test supergroup for unit testing",
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      const expectedLines = [
        "🆔 Chat ID: `-1001234567890`",
        "👥 Type: supergroup",
        "📝 Title: Test Supergroup",
        "🔗 Username: @testsupergroup",
        "👥 Members: 150",
        "📄 Description: A test supergroup for unit testing",
      ];

      expect(result).toBe(expectedLines.join("\n"));
    });

    it("should format channel info correctly", () => {
      const chatInfo: ChatInfo = {
        chatId: -1001234567890,
        chatType: "channel",
        title: "Test Channel",
        username: "testchannel",
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      const expectedLines = [
        "🆔 Chat ID: `-1001234567890`",
        "📢 Type: channel",
        "📝 Title: Test Channel",
        "🔗 Username: @testchannel",
      ];

      expect(result).toBe(expectedLines.join("\n"));
    });

    it("should handle missing optional properties gracefully", () => {
      const chatInfo: ChatInfo = {
        chatId: -123456789,
        chatType: "group",
        title: "Test Group",
        // No username, memberCount, or description
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      const expectedLines = ["🆔 Chat ID: `-123456789`", "👥 Type: group", "📝 Title: Test Group"];

      expect(result).toBe(expectedLines.join("\n"));
    });

    it("should not display member count when it is 0", () => {
      const chatInfo: ChatInfo = {
        chatId: -123456789,
        chatType: "group",
        title: "Empty Group",
        memberCount: 0,
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      expect(result).not.toContain("Members: 0");
      expect(result).toContain("🆔 Chat ID: `-123456789`");
      expect(result).toContain("👥 Type: group");
      expect(result).toContain("📝 Title: Empty Group");
    });

    it("should handle very long chat IDs correctly", () => {
      const chatInfo: ChatInfo = {
        chatId: -1001234567890123,
        chatType: "supergroup",
      };

      const result = chatInfoService.formatChatInfo(chatInfo);

      expect(result).toContain("🆔 Chat ID: `-1001234567890123`");
    });

    it("should use correct emojis for each chat type", () => {
      const chatTypes: Array<{ type: ChatInfo["chatType"]; emoji: string }> = [
        { type: "private", emoji: "👤" },
        { type: "group", emoji: "👥" },
        { type: "supergroup", emoji: "👥" },
        { type: "channel", emoji: "📢" },
      ];

      chatTypes.forEach(({ type, emoji }) => {
        const chatInfo: ChatInfo = {
          chatId: 123,
          chatType: type,
        };

        const result = chatInfoService.formatChatInfo(chatInfo);
        expect(result).toContain(`${emoji} Type: ${type}`);
      });
    });
  });
});
