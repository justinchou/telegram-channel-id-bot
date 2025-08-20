# PM2 管理指南

本指南详细介绍如何使用 PM2 管理 Telegram Chat ID Bot 的部署、监控和维护。

## 目录

- [快速开始](#快速开始)
- [配置文件](#配置文件)
- [管理脚本](#管理脚本)
- [部署流程](#部署流程)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)

## 快速开始

### 1. 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2
# 或使用 yarn
yarn global add pm2
```

### 2. 配置环境变量

创建对应环境的配置文件：

```bash
# 生产环境
cp .env.example .env.production
# 编辑 .env.production 文件，设置正确的 TELEGRAM_BOT_TOKEN

# 开发环境
cp .env.example .env.development
# 编辑 .env.development 文件

# 测试环境
cp .env.example .env.staging
# 编辑 .env.staging 文件
```

### 3. 启动机器人

```bash
# 启动生产环境
yarn pm2:start

# 启动开发环境
yarn pm2:start:dev

# 启动测试环境
yarn pm2:start:staging
```

## 配置文件

### ecosystem.config.js

主要的 PM2 配置文件，包含三个环境的配置：

- **生产环境** (`telegram-bot-prod`): 单实例，自动重启，日志记录
- **开发环境** (`telegram-bot-dev`): 文件监控，TypeScript 直接运行
- **测试环境** (`telegram-bot-staging`): 单实例，用于测试部署

#### 主要配置项

```javascript
{
  name: 'telegram-bot-prod',           // 进程名称
  script: 'dist/index.js',            // 启动脚本
  instances: 1,                       // 实例数量
  exec_mode: 'fork',                  // 执行模式
  autorestart: true,                  // 自动重启
  watch: false,                       // 文件监控
  max_memory_restart: '500M',         // 内存限制重启
  env_file: '.env.production',        // 环境变量文件
  cron_restart: '0 3 * * *',         // 定时重启（每天凌晨3点）
}
```

## 管理脚本

### pm2-manager.sh

主要的 PM2 管理脚本，提供以下功能：

#### 基本操作

```bash
# 启动机器人
./scripts/pm2-manager.sh start <env>

# 停止机器人
./scripts/pm2-manager.sh stop <env>

# 重启机器人
./scripts/pm2-manager.sh restart <env>

# 优雅重载（零停机）
./scripts/pm2-manager.sh reload <env>
```

#### 监控和日志

```bash
# 查看状态
./scripts/pm2-manager.sh status

# 查看日志
./scripts/pm2-manager.sh logs <env> [行数]

# 打开监控界面
./scripts/pm2-manager.sh monitor

# 查看详细信息
./scripts/pm2-manager.sh info <env>
```

#### 系统管理

```bash
# 设置开机自启
./scripts/pm2-manager.sh setup

# 保存当前进程列表
./scripts/pm2-manager.sh save

# 更新 PM2
./scripts/pm2-manager.sh update
```

### pm2-deploy.sh

部署脚本，提供完整的部署流程：

```bash
# 部署到生产环境
./scripts/pm2-deploy.sh deploy prod

# 部署到测试环境（跳过测试）
./scripts/pm2-deploy.sh deploy staging --skip-tests

# 强制重启部署
./scripts/pm2-deploy.sh deploy prod --force-restart

# 回滚部署
./scripts/pm2-deploy.sh rollback prod

# 健康检查
./scripts/pm2-deploy.sh health prod
```

### pm2-monitor.sh

监控脚本，提供详细的监控功能：

```bash
# 监控所有进程
./scripts/pm2-monitor.sh monitor

# 监控特定进程
./scripts/pm2-monitor.sh monitor telegram-bot-prod

# 持续监控（每60秒检查一次）
./scripts/pm2-monitor.sh continuous 60

# 生成监控报告
./scripts/pm2-monitor.sh report

# 设置邮件告警
./scripts/pm2-monitor.sh setup-alerts admin@example.com
```

## 部署流程

### 标准部署流程

1. **代码检查**: 运行测试和代码检查
2. **构建项目**: 编译 TypeScript 代码
3. **环境验证**: 检查环境变量配置
4. **进程管理**: 启动或重载 PM2 进程
5. **健康检查**: 验证部署是否成功

### 生产环境部署

```bash
# 完整部署流程
./scripts/pm2-deploy.sh deploy prod

# 部署流程包括：
# 1. 安装依赖
# 2. 运行测试
# 3. 构建项目
# 4. 优雅重载进程
# 5. 健康检查
```

### 开发环境部署

```bash
# 开发环境部署（跳过测试）
./scripts/pm2-deploy.sh deploy dev --skip-tests

# 开发环境特点：
# - 文件监控自动重启
# - TypeScript 直接运行
# - 详细日志输出
```

## 监控和日志

### 日志文件位置

```
logs/
├── pm2-combined.log      # 生产环境综合日志
├── pm2-out.log          # 生产环境标准输出
├── pm2-error.log        # 生产环境错误日志
├── pm2-dev-combined.log # 开发环境综合日志
├── pm2-dev-out.log      # 开发环境标准输出
├── pm2-dev-error.log    # 开发环境错误日志
├── monitor.log          # 监控脚本日志
└── app.log              # 应用程序日志
```

### 监控指标

监控脚本会检查以下指标：

- **进程状态**: 是否在线运行
- **CPU 使用率**: 默认阈值 80%
- **内存使用**: 默认阈值 80MB
- **重启次数**: 默认阈值 5 次
- **运行时间**: 最小运行时间 5 分钟

### 实时监控

```bash
# PM2 内置监控界面
pm2 monit

# 或使用脚本
yarn pm2:monitor
```

## 故障排除

### 常见问题

#### 1. 机器人无法启动

```bash
# 检查日志
yarn pm2:logs

# 检查配置
cat .env.production

# 验证 Token
echo $TELEGRAM_BOT_TOKEN
```

#### 2. 内存使用过高

```bash
# 检查内存使用
./scripts/pm2-monitor.sh monitor telegram-bot-prod

# 重启进程
yarn pm2:restart
```

#### 3. 频繁重启

```bash
# 查看错误日志
tail -f logs/pm2-error.log

# 检查应用日志
tail -f logs/app.log
```

### 调试模式

```bash
# 开启调试日志
LOG_LEVEL=debug yarn pm2:start:dev

# 查看详细日志
yarn pm2:logs:dev
```

### 健康检查

```bash
# 手动健康检查
./scripts/pm2-deploy.sh health prod

# 持续监控
./scripts/pm2-monitor.sh continuous 30
```

## 最佳实践

### 1. 环境管理

- 为每个环境使用独立的配置文件
- 定期备份环境配置
- 使用版本控制管理配置变更

### 2. 监控和告警

```bash
# 设置邮件告警
./scripts/pm2-monitor.sh setup-alerts admin@example.com

# 定期生成监控报告
./scripts/pm2-monitor.sh report
```

### 3. 日志管理

```bash
# 定期清理日志（保留最近30天）
find logs/ -name "*.log" -mtime +30 -delete

# 日志轮转（可以使用 logrotate）
sudo logrotate -f /etc/logrotate.d/telegram-bot
```

### 4. 备份和恢复

```bash
# 保存 PM2 配置
pm2 save

# 备份配置文件
tar -czf backup-$(date +%Y%m%d).tar.gz .env.* ecosystem.config.js

# 恢复配置
pm2 resurrect
```

### 5. 性能优化

- 监控内存使用，适时调整 `max_memory_restart`
- 根据负载调整重启策略
- 使用 `cron_restart` 定期重启避免内存泄漏

### 6. 安全考虑

- 定期更新 PM2 版本
- 限制日志文件大小
- 使用环境变量管理敏感信息
- 定期检查进程权限

## 快速参考

### 常用命令

```bash
# 启动
yarn pm2:start              # 生产环境
yarn pm2:start:dev          # 开发环境

# 状态
yarn pm2:status             # 查看状态
yarn pm2:logs               # 查看日志

# 部署
yarn pm2:deploy             # 部署生产环境
yarn pm2:health             # 健康检查

# 监控
yarn pm2:monitor            # 打开监控界面
```

### 环境对应关系

| 环境 | 进程名               | 端口 | 配置文件         |
| ---- | -------------------- | ---- | ---------------- |
| 生产 | telegram-bot-prod    | 3000 | .env.production  |
| 开发 | telegram-bot-dev     | 3001 | .env.development |
| 测试 | telegram-bot-staging | 3002 | .env.staging     |

### 脚本权限

确保所有脚本都有执行权限：

```bash
chmod +x scripts/*.sh
```

## 支持

如果遇到问题，请：

1. 查看日志文件
2. 运行健康检查
3. 查看监控报告
4. 参考故障排除部分

更多信息请参考 [PM2 官方文档](https://pm2.keymetrics.io/docs/)。
