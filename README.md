# Raindrop CLI

[English](./README.en.md)

`raindrop` 是一个面向 [Raindrop.io](https://raindrop.io) 的命令行工具，提供可脚本化的查询、创建、诊断和原始请求能力。

这个仓库当前以源码方式使用为主，适合本地开发、自动化脚本、测试，以及让代理或工具通过稳定 JSON 输出与 Raindrop API 交互。

## 特性

- 提供统一的 CLI 入口，覆盖账号诊断、用户信息、收藏夹、标签、书签和原始 GET 请求。
- 支持 `--json`，为自动化和代理调用返回稳定的机器可读输出。
- 支持 `--token`、环境变量和配置文件三种认证来源，并带有明确的优先级。
- 对常见错误提供结构化输出，包括参数错误、认证错误、限流和网络超时。
- 为帮助信息中的必填参数提供清晰标注，减少命令试错成本。

## 当前命令

```text
raindrop doctor
raindrop user me
raindrop collections list [--tree]
raindrop collections resolve --name <name>
raindrop tags list [--collection <id>]
raindrop bookmarks list --collection <id> [--limit <count>] [--page <page>]
raindrop bookmarks search <query> --collection <id> [--limit <count>] [--page <page>]
raindrop bookmarks get <id>
raindrop bookmarks suggest --url <url>
raindrop bookmarks create --url <url> --collection <id> [--title <title>] [--tags <a,b>] [--parse]
raindrop request get </rest/v1/...>
```

## 环境要求

- Node.js `>= 22.18.0`
- `pnpm`
- 可用的 Raindrop access token

## 安装

当前项目更适合从源码直接运行：

```bash
pnpm install
pnpm build
```

构建后可直接执行：

```bash
node dist/index.mjs --help
```

如果你希望在本机以命令方式调用，也可以在本地链接：

```bash
pnpm link --global
raindrop --help
```

## 认证

CLI 按以下顺序读取 token：

1. `--token <token>`
2. 环境变量 `RAINDROP_TOKEN`
3. 配置文件 `~/.raindrop/config.toml`

配置文件示例：

```toml
token = "rdt_xxx"
base_url = "https://api.raindrop.io/rest/v1"
timeout_ms = 10000
```

说明：

- `base_url` 默认值是 `https://api.raindrop.io/rest/v1`
- `timeout_ms` 默认值是 `10000`
- `doctor` 不只是检查本地配置，还会真的发请求验证 token 是否可用

## 快速开始

先确认认证配置是否正确：

```bash
raindrop --json doctor
```

读取当前用户：

```bash
raindrop --json user me
```

列出收藏夹树：

```bash
raindrop --json collections list --tree
```

按名称或路径解析收藏夹：

```bash
raindrop --json collections resolve --name Research
raindrop --json collections resolve --name "Research/AI"
```

列出指定收藏夹中的书签：

```bash
raindrop --json bookmarks list --collection 0 --limit 20
```

搜索书签：

```bash
raindrop --json bookmarks search "typescript #performance" --collection 0 --limit 20
```

创建书签：

```bash
raindrop --json bookmarks create \
  --url https://example.com \
  --collection -1 \
  --title "Example" \
  --tags engineering,tools \
  --parse
```

原始读取请求：

```bash
raindrop --json request get /rest/v1/user
```

## JSON 输出

成功响应：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "command": "user me"
  }
}
```

错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "auth_missing",
    "message": "Raindrop token not found",
    "status": 401
  },
  "meta": {
    "command": "doctor"
  }
}
```

分页读取命令会在 `meta.pagination` 中返回额外信息：

```json
{
  "hasMore": true,
  "page": 0,
  "perPage": 20,
  "returned": 20
}
```

## 命令说明

### `doctor`

验证认证来源、配置路径、基础 URL 和超时设置，并通过实际 API 请求确认 token 有效。

### `user me`

读取当前认证用户信息。

### `collections`

- `collections list` 列出收藏夹；加 `--tree` 返回嵌套结构
- `collections resolve --name <name>` 按标题或完整路径解析单个收藏夹

### `tags`

- `tags list` 列出全局标签
- `tags list --collection <id>` 列出指定收藏夹的标签

### `bookmarks`

- `bookmarks list` 分页读取书签
- `bookmarks search` 透传原始搜索语法
- `bookmarks get` 读取单个书签
- `bookmarks suggest` 为 URL 建议收藏夹和标签
- `bookmarks create` 创建书签，并可通过 `--parse` 请求服务端解析页面

注意：

- `bookmarks suggest` 可能需要 Raindrop Pro 账号
- `bookmarks create` 和 `bookmarks suggest` 只接受绝对 `http` 或 `https` URL
- `bookmarks list` 和 `bookmarks search` 的 `meta.pagination.perPage` 反映的是你请求的 `--limit`，即使 CLI 内部跨了多个 API 页

### `request get`

提供只读的原始 GET 请求出口，适合调试尚未封装的新接口。

注意：

- 路径必须以 `/` 开头
- 只能传相对 API 路径，例如 `/rest/v1/user`
- 不能传绝对 URL

## TODO

以下清单基于当前 Raindrop API 文档能力与本仓库现有实现的对照整理，按功能模块拆分。已支持的功能已勾选，未封装的能力保留为待办。

### 用户

- [x] 读取当前认证用户
- [x] 通过真实 API 请求校验认证与配置
- [ ] 更新当前认证用户

### 收藏夹

- [x] 列出收藏夹
- [x] 以树形结构展示收藏夹
- [x] 按名称或路径解析收藏夹
- [ ] 创建收藏夹
- [ ] 更新收藏夹
- [ ] 删除单个收藏夹
- [ ] 批量删除收藏夹
- [ ] 合并收藏夹
- [ ] 上传收藏夹封面
- [ ] 搜索收藏夹封面或图标

### 标签

- [x] 列出全局标签
- [x] 列出指定收藏夹的标签
- [ ] 重命名或合并标签

### 书签

- [x] 列出指定收藏夹中的书签
- [x] 搜索书签
- [x] 读取单个书签
- [x] 创建书签
- [x] 为 URL 推荐标签和收藏夹
- [ ] 更新书签
- [ ] 删除单个书签
- [ ] 批量更新书签
- [ ] 批量删除书签
- [ ] 导出书签
- [ ] 读取永久副本信息或打开缓存内容
- [ ] 以上传文件的方式创建书签
- [ ] 管理收藏、提醒等创建参数之外的书签字段

### 高亮

- [ ] 列出指定收藏夹的高亮
- [ ] 为书签添加高亮
- [ ] 从书签中移除高亮

### 共享与协作

- [ ] 读取收藏夹共享信息
- [ ] 邀请协作者或更新协作者权限
- [ ] 移除协作者
- [ ] 退出共享收藏夹或取消共享

### 导入与解析

- [ ] 从文件导入书签
- [ ] 通过导入接口解析 URL

### 兜底能力

- [x] 通过原始只读 GET 请求访问尚未封装的接口
- [ ] 支持原始写请求以覆盖高级工作流

## 代理与自动化

仓库内包含一个配套技能：[skills/raindrop-cli-companion/SKILL.md](/Users/cola/Documents/code/raindrop-io-cli/skills/raindrop-cli-companion/SKILL.md)。

这个技能适合让代理或自动化工具稳定地：

- 用 `--json` 运行命令
- 诊断认证和配置问题
- 读取收藏夹、标签、书签
- 执行 `request get` 作为兜底查询

## 开发

安装依赖：

```bash
pnpm install
```

运行测试：

```bash
pnpm test
```

运行类型检查：

```bash
pnpm typecheck
```

构建产物：

```bash
pnpm build
```

格式化代码：

```bash
pnpm format
```

## 说明

本项目目前聚焦于一组清晰、可组合、适合自动化调用的 Raindrop CLI 能力，而不是一次性覆盖所有 API。
