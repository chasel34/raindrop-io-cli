---
name: raindrop-cli-companion
description: Use this skill when Codex needs to run, explain, troubleshoot, or script the `raindrop` CLI as an installed command-line tool. Apply it for authentication setup, command discovery, JSON-mode automation, collection or bookmark operations, smoke tests, and debugging failures in `doctor`, `user`, `collections`, `tags`, `bookmarks`, or `request get`.
---

# Raindrop Cli Companion

Use this skill to operate the CLI quickly and consistently as an installed command-line tool from any working directory.

## Quick Start

Prefer `--json` for automation, tests, and agent-driven parsing.

Use auth in this precedence order:

```bash
raindrop --token "$RAINDROP_TOKEN" --json doctor
export RAINDROP_TOKEN="rdt_xxx"
cat ~/.raindrop/config.toml
```

Use this config shape when a persistent setup is needed:

```toml
token = "rdt_xxx"
base_url = "https://api.raindrop.io/rest/v1"
timeout_ms = 10000
```

If `raindrop` is not on `PATH`, install or update the published package using the package manager and installation flow chosen for distribution. Do not assume source files, a local clone, or `pnpm link --global` are available.

## Command Map

Use `doctor` to verify config and perform a real API probe. It does not stop at local config parsing; it actually validates that the current token can reach the Raindrop API:

```bash
raindrop --json doctor
```

Use `user me` to confirm the authenticated account:

```bash
raindrop --json user me
```

Use collection commands to inspect structure or resolve names. `collections resolve` requires `--name`:

```bash
raindrop --json collections list --tree
raindrop --json collections resolve --name Research
```

Use tags and bookmark read commands for automation-friendly output. `bookmarks list` and `bookmarks search` both require `--collection`:

```bash
raindrop --json tags list --collection 123
raindrop --json bookmarks list --collection 0 --limit 20
raindrop --json bookmarks search 'typescript #performance' --collection 0 --limit 20
raindrop --json bookmarks get 123
```

Use bookmark suggestion and creation for write flows. `bookmarks suggest` requires `--url` and may require a Raindrop Pro account. `bookmarks create` requires both `--url` and `--collection`:

```bash
raindrop --json bookmarks suggest --url https://example.com
raindrop --json bookmarks create --url https://example.com --collection -1 --title "Example" --tags a,b --parse
```

Use `request get` only as a read-only escape hatch. The path must start with `/`; absolute URLs fail:

```bash
raindrop --json request get /rest/v1/user
```

## Operating Guidelines

Run `raindrop --help` or `raindrop <resource> --help` before guessing flags.

Assume normal end users only have the installed binary and documented config locations, not the repository checkout.

Expect stable success envelopes shaped like `{"ok": true, "data": ..., "meta": ...}` and stable error envelopes shaped like `{"ok": false, "error": ..., "meta": ...}`.

Treat `bookmarks list` and `bookmarks search` as paginated reads. `meta.pagination.perPage` reflects the requested `--limit`, even when the CLI internally spans multiple API pages.

Treat `request get` paths as relative API paths beginning with `/`; do not pass absolute URLs.

Treat `collections resolve --name ...`, `bookmarks list --collection ...`, `bookmarks search --collection ...`, `bookmarks suggest --url ...`, and `bookmarks create --url ... --collection ...` as commands with required flags, not optional examples.

Use `bookmarks create` only with absolute `http` or `https` URLs.

## Troubleshooting Flow

Start with:

```bash
raindrop --json doctor
```

If `doctor` fails with `auth_missing`, check `--token`, `RAINDROP_TOKEN`, and `~/.raindrop/config.toml` in that order.

If a command fails with `cli_usage_error`, rerun it with `--help` and check for missing subcommands or malformed integer flags such as `--collection`, `--page`, `--limit`, or bookmark IDs.

If a request fails with `network_timeout` or `network_error`, inspect `base_url`, connectivity, and `timeout_ms`.

If `bookmarks suggest` fails with `feature_requires_pro`, the authenticated account does not have access to bookmark suggestions; switch to a Pro account or avoid that command in automation.

If a write or read fails with API-derived errors such as `auth` or `rate_limited`, surface the structured JSON error to the caller instead of paraphrasing it away.
