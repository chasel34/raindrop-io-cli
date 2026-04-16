# Raindrop CLI

[中文](./README.md)

`raindrop` is a command-line interface for [Raindrop.io](https://raindrop.io) with script-friendly read, create, diagnostics, and raw request workflows.

This repository is currently designed to be used from source. It is a good fit for local development, automation scripts, tests, and agent-driven workflows that need stable JSON output on top of the Raindrop API.

## Features

- A single CLI entry point for diagnostics, user info, collections, tags, bookmarks, and raw GET requests.
- Stable `--json` output for automation and agent integrations.
- Three auth sources with clear precedence: flag, environment variable, and config file.
- Structured error handling for usage errors, auth failures, rate limits, and network timeouts.
- Clear required-option help text to reduce command guesswork.

## Available Commands

```text
raindrop doctor
raindrop user me
raindrop collections create --title <title> [--parent <id>] [--view <view>] [--sort <number>] [--cover <url,...>] [--public]
raindrop collections update <id> [--title <title>] [--parent <id>] [--no-parent] [--view <view>] [--sort <number>] [--cover <url,...>] [--expanded|--collapsed] [--public|--private]
raindrop collections delete <id>
raindrop collections delete-many --ids <ids>
raindrop collections list [--tree]
raindrop collections resolve --name <name>
raindrop tags list [--collection <id>]
raindrop bookmarks list --collection <id> [--limit <count>] [--page <page>]
raindrop bookmarks search <query> --collection <id> [--limit <count>] [--page <page>]
raindrop bookmarks get <id>
raindrop bookmarks suggest --url <url>
raindrop bookmarks create --url <url> --collection <id> [--title <title>] [--tags <a,b>] [--parse]
raindrop bookmarks update <id> [--url <url>] [--title <title>] [--collection <id>] [--tags <a,b>|--clear-tags] [--important|--not-important] [--excerpt <text>] [--note <text>] [--cover <url>] [--parse]
raindrop bookmarks delete <id>
raindrop bookmarks update-many --collection <id> (--ids <ids>|--search <query>) [--nested] [--tags <a,b>|--clear-tags] [--move-to <id>] [--important|--not-important] [--cover <url>]
raindrop bookmarks delete-many --collection <id> (--ids <ids>|--search <query>) [--nested]
raindrop request get </rest/v1/...>
```

## Requirements

- Node.js `>= 22.18.0`
- `pnpm`
- A valid Raindrop access token

## Installation

Install the published package globally from npm:

```bash
npm install -g @chasel34/raindrop-cli
raindrop --help
```

The package name is `@chasel34/raindrop-cli`; the installed command is `raindrop`.

To run from source:

```bash
pnpm install
pnpm build
node dist/index.mjs --help
```

For local development, you can also link the current checkout:

```bash
pnpm link --global
raindrop --help
```

## Authentication

The CLI resolves the token in this order:

1. `--token <token>`
2. `RAINDROP_TOKEN`
3. `~/.raindrop/config.toml`

Example config:

```toml
token = "rdt_xxx"
base_url = "https://api.raindrop.io/rest/v1"
timeout_ms = 10000
```

Notes:

- The default `base_url` is `https://api.raindrop.io/rest/v1`
- The default `timeout_ms` is `10000`
- `doctor` does not stop at local parsing; it performs a real API probe to validate the current token

## Quick Start

Verify auth and config:

```bash
raindrop --json doctor
```

Fetch the current user:

```bash
raindrop --json user me
```

List the collection tree:

```bash
raindrop --json collections list --tree
```

Resolve a collection by name or path:

```bash
raindrop --json collections resolve --name Research
raindrop --json collections resolve --name "Research/AI"
```

List bookmarks in a collection:

```bash
raindrop --json bookmarks list --collection 0 --limit 20
```

Search bookmarks:

```bash
raindrop --json bookmarks search "typescript #performance" --collection 0 --limit 20
```

Create a bookmark:

```bash
raindrop --json bookmarks create \
  --url https://example.com \
  --collection -1 \
  --title "Example" \
  --tags engineering,tools \
  --parse
```

Run a raw read-only request:

```bash
raindrop --json request get /rest/v1/user
```

## JSON Output

Successful responses:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "command": "user me"
  }
}
```

Error responses:

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

Paginated commands also expose `meta.pagination`:

```json
{
  "hasMore": true,
  "page": 0,
  "perPage": 20,
  "returned": 20
}
```

## Command Notes

### `doctor`

Reports auth source, config path, base URL, and timeout settings, then confirms the token with a real API request.

### `user me`

Returns the authenticated user.

### `collections`

- `collections create` creates a collection
- `collections update` updates title, parent, view, sort, cover, expanded state, and public state
- `collections delete` deletes one collection
- `collections delete-many` deletes multiple collections
- `collections list` returns collections; add `--tree` for nested output
- `collections resolve --name <name>` resolves a single collection by title or full path

### `tags`

- `tags list` returns global tags
- `tags list --collection <id>` returns tags for a specific collection

### `bookmarks`

- `bookmarks list` reads bookmarks with pagination
- `bookmarks search` passes raw search syntax through to Raindrop
- `bookmarks get` fetches a single bookmark
- `bookmarks suggest` suggests collections and tags for a URL
- `bookmarks create` creates a bookmark and can request server-side parsing with `--parse`
- `bookmarks update` updates a single bookmark
- `bookmarks delete` deletes a single bookmark
- `bookmarks update-many` bulk updates bookmarks by IDs or search query
- `bookmarks delete-many` bulk deletes bookmarks by IDs or search query

Notes:

- `bookmarks suggest` may require a Raindrop Pro account
- URL arguments only accept absolute `http` or `https` URLs
- `bookmarks update-many` and `bookmarks delete-many` do not support `--collection 0`
- `meta.pagination.perPage` reflects the requested `--limit`, even when the CLI spans multiple API pages internally

### `request get`

A read-only raw GET escape hatch for debugging or for APIs that are not wrapped yet.

Notes:

- The path must start with `/`
- Use a relative API path such as `/rest/v1/user`
- Absolute URLs are rejected

## TODO

The checklist below compares the current CLI against the Raindrop API surface and groups work by functional area. Checked items are already implemented. Unchecked items are still open.

### User

- [x] Read the authenticated user
- [x] Validate auth and config with a real API probe
- [ ] Update the authenticated user

### Collections

- [x] List collections
- [x] Render the collection tree
- [x] Resolve a collection by name or path
- [x] Create a collection
- [x] Update a collection
- [x] Delete a collection
- [x] Delete multiple collections
- [ ] Merge collections
- [ ] Upload a collection cover
- [ ] Search collection covers or icons

### Tags

- [x] List tags globally
- [x] List tags for a collection
- [ ] Rename or merge tags

### Bookmarks

- [x] List bookmarks in a collection
- [x] Search bookmarks
- [x] Get a single bookmark
- [x] Create a bookmark
- [x] Suggest tags and collections for a URL
- [x] Update a bookmark
- [x] Delete a bookmark
- [x] Bulk update bookmarks
- [x] Bulk delete bookmarks
- [ ] Export bookmarks
- [ ] Read permanent copy metadata or open cached content
- [ ] Upload files as bookmarks
- [ ] Manage favorites, reminders, or other bookmark fields beyond create-time input

### Highlights

- [ ] List highlights for a collection
- [ ] Add highlights to a bookmark
- [ ] Remove highlights from a bookmark

### Sharing & Collaboration

- [ ] Read sharing metadata for collections
- [ ] Invite collaborators or update collaborator access
- [ ] Remove collaborators
- [ ] Leave or unshare a shared collection

### Import & Parsing

- [ ] Import bookmarks from a file
- [ ] Parse a URL through the import endpoint

### Escape Hatch

- [x] Run raw read-only GET requests against uncovered endpoints
- [ ] Support raw write requests for advanced workflows

## Agents and Automation

The repository includes a companion skill at [skills/raindrop-cli-companion/SKILL.md](/Users/cola/Documents/code/raindrop-io-cli/skills/raindrop-cli-companion/SKILL.md).

If you want to install this skill into your local skills directory, run:

```bash
npx skills add chasel34/raindrop-io-cli --skill raindrop-cli-companion
```

It is useful when an agent or automation layer needs to:

- Prefer `--json`
- Troubleshoot auth and config issues
- Read collections, tags, and bookmarks
- Fall back to `request get` for uncovered endpoints

## Development

Install dependencies:

```bash
pnpm install
```

Run tests:

```bash
pnpm test
```

Run type checks:

```bash
pnpm typecheck
```

Build:

```bash
pnpm build
```

Format the codebase:

```bash
pnpm format
```

## Scope

The current focus is a compact, composable, automation-friendly Raindrop CLI rather than full API coverage all at once.
