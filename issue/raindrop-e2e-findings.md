# Raindrop CLI E2E Findings

测试环境：
- 运行目录：`/tmp`
- CLI 版本：`0.1.0`
- 测试方式：黑盒 E2E，仅基于已安装的 `raindrop` 命令和 `raindrop-cli-companion` 技能说明

## 发现的问题

1. `--help` 与真实约束不一致

- `raindrop bookmarks list --help` 将 `--collection <id>` 显示为可选，但实际执行时为必填。
- `raindrop bookmarks search --help` 将 `--collection <id>` 显示为可选，但实际执行时为必填。
- `raindrop bookmarks create --help` 将 `--collection <id>` 显示为可选，但实际执行时为必填。
- `raindrop bookmarks suggest --help` 将 `--url <url>` 显示为可选，但实际执行时为必填。
- `raindrop collections resolve --help` 将 `--name <name>` 显示为可选，但实际执行时为必填。

影响：
- 用户会先按照帮助文案尝试，再收到 `cli_usage_error`，降低 CLI 可预期性。

建议：
- 将以上参数在帮助文案中明确标为必填，或调整命令实现，使帮助文案与实际行为一致。

2. `bookmarks suggest` 存在账号能力前置条件，但技能说明未体现

- 在当前非 Pro 账号下，执行 `raindrop --json bookmarks suggest --url 'https://example.com'` 返回：
  - `code: api_error`
  - `message: pro only`
  - `status: 403`

影响：
- 技能描述把它写成普通可用功能，但实际并非所有账号都可执行，自动化或新用户容易误判为功能异常。

建议：
- 在技能说明中补充“该能力可能仅限 Pro 账号”的前置条件。
- 如果这是产品预期，也建议 CLI 在错误信息中更明确地区分“权限限制”和“通用 API 错误”。

3. 技能说明可以补充更明确的约束提示

- 技能中虽然示例使用了 `bookmarks list --collection 0` 和 `bookmarks search --collection 0`，但没有明确说明这两个命令实际上要求必须传 `--collection`。
- `request get` 虽已说明应传相对路径，但可以进一步强调“路径必须以 `/` 开头；绝对 URL 会失败”。
- `doctor` 的描述可更明确：它不是仅检查本地配置，而是会实际验证 token 是否可用。

建议：
- 在技能文档中把这些行为从“示例”提升为“约束说明”，减少误用。

## 残留说明

- 为完成写入链路验证，测试期间创建了 1 条远端测试书签；CLI 当前未提供删除命令，因此未能通过 CLI 清理。
- 测试书签：
  - `id: 1685286588`
  - `title: Raindrop CLI E2E raindrop-e2e-1776260439`
  - `tags: raindrop-e2e-1776260439, e2e`
