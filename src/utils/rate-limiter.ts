import logger from "./logger";

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  timeWindow: number;
  /** Penalty time in milliseconds for exceeding limit */
  penaltyTime?: number;
  /** Whether to use progressive penalties */
  useProgressivePenalty?: boolean;
}

/**
 * Rate limit entry for tracking user requests
 */
interface RateLimitEntry {
  /** Number of requests in current window */
  count: number;
  /** When the current window resets */
  resetTime: number;
  /** When penalty expires (if any) */
  penaltyExpires?: number;
  /** Number of times user has been penalized */
  penaltyCount?: number;
}

/**
 * Advanced Rate Limiter for Bot Security
 *
 * Implements Requirements 5.2, 5.4:
 * - 5.2: Bot handles invalid messages gracefully without crashing
 * - 5.4: Bot records permission errors but continues running
 *
 * Features:
 * - Per-user rate limiting
 * - Progressive penalties for repeat offenders
 * - Different limits for different chat types
 * - Automatic cleanup of expired entries
 * - Comprehensive logging and monitoring
 */
export class RateLimiter {
  private userLimits = new Map<number, RateLimitEntry>();
  private chatLimits = new Map<number, RateLimitEntry>();
  private globalConfig: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.globalConfig = {
      penaltyTime: 300000, // 5 minutes default penalty
      useProgressivePenalty: true,
      ...config,
    };

    // Start cleanup interval to remove expired entries
    this.startCleanup();
  }

  /**
   * Check if user is rate limited
   * @param userId - User ID to check
   * @param chatId - Chat ID (optional, for chat-specific limits)
   * @param customConfig - Custom rate limit config (optional)
   * @returns Object with isLimited status and remaining time
   */
  checkRateLimit(
    userId: number,
    chatId?: number,
    customConfig?: Partial<RateLimitConfig>
  ): { isLimited: boolean; remainingTime?: number; reason?: string } {
    const config = { ...this.globalConfig, ...customConfig };
    const now = Date.now();

    // Check user-specific rate limit
    const userResult = this.checkUserLimit(userId, now, config);
    if (userResult.isLimited) {
      return userResult;
    }

    // Check chat-specific rate limit if chatId provided
    if (chatId) {
      const chatResult = this.checkChatLimit(chatId, now, config);
      if (chatResult.isLimited) {
        return chatResult;
      }
    }

    // Update counters
    this.updateUserLimit(userId, now, config);
    if (chatId) {
      this.updateChatLimit(chatId, now, config);
    }

    return { isLimited: false };
  }

  /**
   * Check user-specific rate limit
   * @param userId - User ID
   * @param now - Current timestamp
   * @param config - Rate limit configuration
   * @returns Rate limit check result
   */
  private checkUserLimit(
    userId: number,
    now: number,
    config: RateLimitConfig
  ): { isLimited: boolean; remainingTime?: number; reason?: string } {
    const userEntry = this.userLimits.get(userId);

    // Check if user is currently penalized
    if (userEntry?.penaltyExpires && now < userEntry.penaltyExpires) {
      const remainingTime = Math.ceil((userEntry.penaltyExpires - now) / 1000);

      logger.warn("User is penalized for rate limit violation", {
        userId,
        remainingTime,
        penaltyCount: userEntry.penaltyCount || 0,
      });

      return {
        isLimited: true,
        remainingTime,
        reason: "penalty",
      };
    }

    // Check if user has exceeded rate limit
    if (userEntry && now < userEntry.resetTime && userEntry.count >= config.maxRequests) {
      const remainingTime = Math.ceil((userEntry.resetTime - now) / 1000);

      // Apply penalty if configured
      if (config.penaltyTime) {
        this.applyPenalty(userId, now, config);
      }

      logger.warn("User exceeded rate limit", {
        userId,
        requestCount: userEntry.count,
        maxRequests: config.maxRequests,
        remainingTime,
      });

      return {
        isLimited: true,
        remainingTime,
        reason: "rate_limit",
      };
    }

    return { isLimited: false };
  }

  /**
   * Check chat-specific rate limit
   * @param chatId - Chat ID
   * @param now - Current timestamp
   * @param config - Rate limit configuration
   * @returns Rate limit check result
   */
  private checkChatLimit(
    chatId: number,
    now: number,
    config: RateLimitConfig
  ): { isLimited: boolean; remainingTime?: number; reason?: string } {
    const chatEntry = this.chatLimits.get(chatId);

    if (chatEntry && now < chatEntry.resetTime && chatEntry.count >= config.maxRequests * 5) {
      const remainingTime = Math.ceil((chatEntry.resetTime - now) / 1000);

      logger.warn("Chat exceeded rate limit", {
        chatId,
        requestCount: chatEntry.count,
        maxRequests: config.maxRequests * 5,
        remainingTime,
      });

      return {
        isLimited: true,
        remainingTime,
        reason: "chat_limit",
      };
    }

    return { isLimited: false };
  }

  /**
   * Update user rate limit counter
   * @param userId - User ID
   * @param now - Current timestamp
   * @param config - Rate limit configuration
   */
  private updateUserLimit(userId: number, now: number, config: RateLimitConfig): void {
    const userEntry = this.userLimits.get(userId);

    if (!userEntry || now >= userEntry.resetTime) {
      // Reset or initialize user limit
      this.userLimits.set(userId, {
        count: 1,
        resetTime: now + config.timeWindow,
      });
    } else {
      // Increment counter
      userEntry.count++;
    }
  }

  /**
   * Update chat rate limit counter
   * @param chatId - Chat ID
   * @param now - Current timestamp
   * @param config - Rate limit configuration
   */
  private updateChatLimit(chatId: number, now: number, config: RateLimitConfig): void {
    const chatEntry = this.chatLimits.get(chatId);

    if (!chatEntry || now >= chatEntry.resetTime) {
      // Reset or initialize chat limit
      this.chatLimits.set(chatId, {
        count: 1,
        resetTime: now + config.timeWindow,
      });
    } else {
      // Increment counter
      chatEntry.count++;
    }
  }

  /**
   * Apply penalty to user for rate limit violation
   * @param userId - User ID
   * @param now - Current timestamp
   * @param config - Rate limit configuration
   */
  private applyPenalty(userId: number, now: number, config: RateLimitConfig): void {
    const userEntry = this.userLimits.get(userId);
    if (!userEntry || !config.penaltyTime) {
      return;
    }

    const penaltyCount = (userEntry.penaltyCount || 0) + 1;
    let penaltyDuration = config.penaltyTime;

    // Progressive penalty: increase penalty time for repeat offenders
    if (config.useProgressivePenalty && penaltyCount > 1) {
      penaltyDuration = config.penaltyTime * Math.min(penaltyCount, 5); // Cap at 5x
    }

    userEntry.penaltyExpires = now + penaltyDuration;
    userEntry.penaltyCount = penaltyCount;

    logger.warn("Applied penalty to user for rate limit violation", {
      userId,
      penaltyCount,
      penaltyDuration: Math.ceil(penaltyDuration / 1000),
    });
  }

  /**
   * Get rate limit statistics for monitoring
   * @returns Statistics object
   */
  getStatistics(): {
    totalUsers: number;
    totalChats: number;
    penalizedUsers: number;
    activeUsers: number;
  } {
    const now = Date.now();
    let penalizedUsers = 0;
    let activeUsers = 0;

    for (const [_, entry] of this.userLimits) {
      if (entry.penaltyExpires && now < entry.penaltyExpires) {
        penalizedUsers++;
      }
      if (now < entry.resetTime) {
        activeUsers++;
      }
    }

    return {
      totalUsers: this.userLimits.size,
      totalChats: this.chatLimits.size,
      penalizedUsers,
      activeUsers,
    };
  }

  /**
   * Clear rate limit for a specific user (admin function)
   * @param userId - User ID to clear
   */
  clearUserLimit(userId: number): void {
    this.userLimits.delete(userId);
    logger.info("Cleared rate limit for user", { userId });
  }

  /**
   * Clear rate limit for a specific chat (admin function)
   * @param chatId - Chat ID to clear
   */
  clearChatLimit(chatId: number): void {
    this.chatLimits.delete(chatId);
    logger.info("Cleared rate limit for chat", { chatId });
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedUsers = 0;
    let cleanedChats = 0;

    // Clean up user entries
    for (const [userId, entry] of this.userLimits) {
      const isExpired = now >= entry.resetTime && (!entry.penaltyExpires || now >= entry.penaltyExpires);

      if (isExpired) {
        this.userLimits.delete(userId);
        cleanedUsers++;
      }
    }

    // Clean up chat entries
    for (const [chatId, entry] of this.chatLimits) {
      if (now >= entry.resetTime) {
        this.chatLimits.delete(chatId);
        cleanedChats++;
      }
    }

    if (cleanedUsers > 0 || cleanedChats > 0) {
      logger.debug("Rate limiter cleanup completed", {
        cleanedUsers,
        cleanedChats,
        remainingUsers: this.userLimits.size,
        remainingChats: this.chatLimits.size,
      });
    }
  }

  /**
   * Stop the rate limiter and cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.userLimits.clear();
    this.chatLimits.clear();

    logger.info("Rate limiter stopped and cleaned up");
  }
}
