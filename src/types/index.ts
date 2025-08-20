// import { Context as TelegrafContext } from "telegraf";

// Temporary type definition for Context to avoid telegraf dependency issues
export interface TelegrafContext {
  chat?:
    | {
        id: number;
        type: string;
        title?: string;
        username?: string;
      }
    | undefined;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  message?:
    | {
        message_id: number;
        date: number;
        chat: {
          id: number;
          type: string;
        };
        text?: string;
        new_chat_members?: any[];
      }
    | undefined;
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
 * Security event types for logging and monitoring
 */
export type SecurityEventType =
  | "rate_limit_exceeded"
  | "invalid_chat_type"
  | "insufficient_bot_permissions"
  | "admin_permission_denied"
  | "command_allowed"
  | "security_middleware_error"
  | "permission_check_failed"
  | "bot_blocked"
  | "unauthorized_access";

/**
 * Security context information for logging
 */
export interface SecurityContext {
  /** Type of security event */
  event: SecurityEventType;
  /** Chat ID where event occurred */
  chatId?: number;
  /** User ID involved in the event */
  userId?: number;
  /** Command that triggered the event */
  command?: string;
  /** Additional event-specific data */
  metadata?: Record<string, any>;
  /** Timestamp of the event */
  timestamp: string;
}

/**
 * Bot permission status information
 */
export interface BotPermissionStatus {
  /** Whether bot has required permissions */
  hasPermission: boolean;
  /** Bot's status in the chat */
  status?: "member" | "administrator" | "creator" | "left" | "kicked" | "restricted";
  /** Specific permissions the bot has */
  permissions?: {
    canSendMessages?: boolean;
    canDeleteMessages?: boolean;
    canRestrictMembers?: boolean;
    canPromoteMembers?: boolean;
    canChangeInfo?: boolean;
    canInviteUsers?: boolean;
    canPinMessages?: boolean;
  };
  /** Error message if permission check failed */
  error?: string;
}

/**
 * User permission information
 */
export interface UserPermissionInfo {
  /** Whether user is admin */
  isAdmin: boolean;
  /** User's status in the chat */
  status?: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  /** Specific admin permissions */
  adminPermissions?: {
    canDeleteMessages?: boolean;
    canRestrictMembers?: boolean;
    canPromoteMembers?: boolean;
    canChangeInfo?: boolean;
    canInviteUsers?: boolean;
    canPinMessages?: boolean;
  };
}

/**
 * Rate limit violation information
 */
export interface RateLimitViolation {
  /** User ID that violated the limit */
  userId: number;
  /** Chat ID where violation occurred */
  chatId?: number;
  /** Type of rate limit violated */
  limitType: "user" | "chat" | "global";
  /** Number of requests made */
  requestCount: number;
  /** Maximum allowed requests */
  maxRequests: number;
  /** Time window for the limit */
  timeWindow: number;
  /** Remaining time until reset */
  remainingTime: number;
  /** Whether penalty was applied */
  penaltyApplied: boolean;
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
