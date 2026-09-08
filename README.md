# 日况 Daystate

每天 30 秒，记录真实状态。日况是一款云端优先的私人状态日记，记录心情、剩余电量、文字和标签，并通过日历与趋势图回看变化。

## 已实现

- 用户名、密码和私有注册码注册
- HttpOnly Cookie 云端会话，多端登录共享数据
- 每天一条心情与剩余电量记录，支持补记、修改和删除
- 自定义文字和标签
- 月历回顾，以及 7、30、90 天趋势
- JSON、CSV 完整导出
- 响应式桌面端、移动端和 PWA 安装体验
- 基础登录限流、同源校验和安全响应头

## 架构

- React 19 + TypeScript + Vite
- Cloudflare Pages + Pages Functions
- Cloudflare D1，数据库名 `daystate-db`
- 云端数据库是唯一业务数据源；浏览器不使用 IndexedDB 保存日记

## 本地开发

```bash
npm ci
```

复制 `.dev.vars.example` 为 `.dev.vars` 并填写仅供本地使用的注册码，然后执行：

```bash
npm run db:migrate:local
npm run dev:cloud
```

只开发静态界面时可执行 `npm run dev`，但此模式没有 Pages Functions API。

## 验证

```bash
npm run lint
npm run build
```

完整构建依次验证前端类型、生产打包、Functions 类型和 Worker 打包。

## 部署

首次创建 D1 和 Pages 项目后，将 `wrangler.toml` 中的数据库 ID 指向独立的 `daystate-db`，再执行：

```bash
npm run db:migrate:remote
npx wrangler pages secret put REGISTRATION_CODE --project-name daystate
npm run deploy
```

## 数据表

- `users`：账号和密码哈希
- `sessions`：30 天登录会话
- `mood_entries`：每个账号每天唯一的一条状态记录
- `auth_attempts`：15 分钟滚动认证失败计数

任何远程 D1 查询都必须显式使用 `--remote`，否则操作的是 Wrangler 本地数据库。
