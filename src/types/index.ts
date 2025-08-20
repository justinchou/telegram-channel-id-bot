// import { Context as TelegrafContext } from "telegraf";

// Temporary type definition for Context to avoid telegraf dependency issues
export interface TelegrafContext {
  chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  } | undefined;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  message?: {
    message_id: number;
    date: number;
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    new_chat_members?: any[];
  } | undefined;
  reply: (text: string, extra?: any) => Promise<any>;
  myChatMember?: {
    new_chat_member: { status: string };
    old_chat_member: { status: string };
  };
  inlineQuery?: {
    id: string;
    query: string;
  };
  answerInlineQuery?: (results: any[]) => Promise<any>;
  updateType?: string;
}

/**
 * Chat information interface containing details about a Telegram chat
 * Supports different chat types: private, group, supergroup, channel
 */
export interface ChatInfo {
  /** Unique identifier for the chat */
  chatId: number;
  /** Type of chat */
  chatType: "private" | "group" | "supergroup" | "channel";
  /** Title of the chat (for groups, supergroups, channels) */
  title?: string;
  /** Username of the chat (if available) */
  username?: string;
  /** Number of members in the chat (for groups and supergroups) */
  memberCount?: number;
  /** Description of the chat (if available) */
  description?: string;
}

/**
 * Bot configuration interface for environment and runtime settings
 */
export interface BotConfig {
  /** Telegram Bot API token */
  token: string;
  /** Logging level for the application */
  logLevel: string;
  /** Optional webhook URL for webhook mode */
  webhookUrl?: string;
  /** Port number for the application */
  port: number;
}

/**
 * Extended Telegraf Context with additional properties and methods
 * Provides type safety for custom context extensions
 */
export interface ExtendedContext extends TelegrafContext {
  /** Custom reply method with enhanced error handling */
  safeReply: (text: string, extra?: any) => Promise<void>;
  /** Get formatted chat information */
  getChatInfo: () => Promise<ChatInfo>;
}

/**
 * Command handler function type
 */
export type CommandHandler = (ctx: ExtendedContext) => Promise<void>;

/**
 * Error context information for logging and debugging
 */
export interface ErrorContext {
  /** Command that caused the error */
  command?: string | undefined;
  /** Chat ID where error occurred */
  chatId?: number | undefined;
  /** User ID who triggered the error */
  userId?: number | undefined;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * NodeJS .ProcessEnv interface for environment variables
 * Extends the standard NodeJS.ProcessEnv with custom NODE_ENV property
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: string;
  }
}