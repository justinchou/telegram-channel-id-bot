/**
 * PM2 Ecosystem Configuration for Telegram Chat ID Bot
 *
 * This configuration supports multiple environments:
 * - Development: Single instance with file watching
 * - Production: Cluster mode with auto-restart and monitoring
 * - Staging: Single instance for testing
 */

module.exports = {
  apps: [
    {
      // Production Configuration
      name: "telegram-bot-prod",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1, // Telegram bots should run as single instance to avoid conflicts
      exec_mode: "fork", // Use fork mode for single instance

      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: ".env.production",

      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",

      // Logging
      log_file: "logs/pm2-combined.log",
      out_file: "logs/pm2-out.log",
      error_file: "logs/pm2-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Advanced PM2 features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Health monitoring
      health_check_grace_period: 3000,

      // Source map support for better error traces
      source_map_support: true,

      // Process title for easier identification
      instance_var: "INSTANCE_ID",

      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: "0 3 * * *",

      // Post deploy hooks
      post_update: ["yarn install", "yarn build"],

      // Ignore specific files/folders for watching
      ignore_watch: ["node_modules", "logs", "coverage", "dist", ".git", "*.log"],
    },

    {
      // Development Configuration
      name: "telegram-bot-dev",
      script: "ts-node",
      args: "--transpile-only src/index.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",

      // Environment
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        LOG_LEVEL: "debug",
      },
      env_file: ".env.development",

      // Development specific settings
      autorestart: true,
      watch: ["src"],
      watch_delay: 1000,
      ignore_watch: ["node_modules", "logs", "coverage", "dist", ".git", "*.log", "tests"],

      // Logging
      log_file: "logs/pm2-dev-combined.log",
      out_file: "logs/pm2-dev-out.log",
      error_file: "logs/pm2-dev-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Development optimizations
      max_memory_restart: "200M",
      restart_delay: 2000,
      kill_timeout: 3000,

      // Disable cron restart in development
      cron_restart: null,
    },

    {
      // Staging Configuration
      name: "telegram-bot-staging",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",

      // Environment
      env: {
        NODE_ENV: "staging",
        PORT: 3002,
      },
      env_file: ".env.staging",

      // Staging specific settings
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 3000,

      // Logging
      log_file: "logs/pm2-staging-combined.log",
      out_file: "logs/pm2-staging-out.log",
      error_file: "logs/pm2-staging-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Health monitoring
      health_check_grace_period: 2000,
      kill_timeout: 4000,
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: "deploy",
      host: ["your-production-server.com"],
      ref: "origin/main",
      repo: "git@github.com:your-username/telegram-channel-id-bot.git",
      path: "/var/www/telegram-bot",
      "pre-deploy-local": "",
      "post-deploy": "yarn install && yarn build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      ssh_options: "StrictHostKeyChecking=no",
    },

    staging: {
      user: "deploy",
      host: ["your-staging-server.com"],
      ref: "origin/develop",
      repo: "git@github.com:your-username/telegram-channel-id-bot.git",
      path: "/var/www/telegram-bot-staging",
      "post-deploy": "yarn install && yarn build && pm2 reload ecosystem.config.js --env staging",
      ssh_options: "StrictHostKeyChecking=no",
    },
  },
};
