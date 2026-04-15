# AGENTS.md

## Project Overview

This repository contains `raindrop`, a Node.js command-line interface for Raindrop.io.

The current project goal is a compact, automation-friendly CLI with stable JSON output for both humans and agents. The implemented command surface covers diagnostics, user info, collections, tags, bookmarks, and a read-only raw request escape hatch.

Key behavior to keep in mind:

- The CLI entry point is `src/index.ts`, which delegates to `runCli()` in `src/cli.ts`.
- Global options are `--json` and `--token`.
- Authentication resolves in this order: CLI flag, `RAINDROP_TOKEN`, then `~/.raindrop/config.toml`.
- Success responses use `{ ok: true, data, meta }`.
- Error responses use `{ ok: false, error, meta }`.
- Paginated bookmark reads expose pagination metadata in `meta.pagination`.

## Build & Test

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
pnpm format:check
```

Use `pnpm format` only when you want to rewrite formatting.

## Architecture

The codebase is intentionally small and split by responsibility.

### Entry and CLI wiring

- `src/index.ts` is the executable entry point.
- `src/cli.ts` builds the Commander command tree, configures shared output behavior, creates runtime defaults, and normalizes top-level error handling.
- `src/commands/helpers.ts` holds shared Commander helpers such as required integer parsing and missing-subcommand handling.

### Auth and config

- `src/auth.ts` resolves credentials and returns both the token and its source.
- `src/config.ts` loads `~/.raindrop/config.toml`, applies defaults, strips inline comments, and throws structured config parse errors when input is invalid.

### API client and domain types

- `src/client.ts` wraps Raindrop API requests and centralizes:
  - URL construction
  - auth header injection
  - request timeouts
  - API error normalization
  - pagination stitching for bookmarks
- `src/types/api.ts` defines the narrow API response types used by the CLI.

### Output and errors

- `src/output.ts` owns the JSON envelope and plain-text writer helpers.
- `src/errors.ts` defines `CliError` and conversion from unexpected runtime errors into CLI-safe failures.

### Commands

Each command module is responsible for option parsing, calling the client layer, and formatting command-specific output.

- `src/commands/doctor.ts`
- `src/commands/user.ts`
- `src/commands/collections.ts`
- `src/commands/tags.ts`
- `src/commands/bookmarks.ts`
- `src/commands/request.ts`

### Tests

- `src/cli.test.ts` covers cross-command CLI behavior such as JSON mode, auth handling, config parsing, help text, and global error formatting.
- `src/commands/*.test.ts` cover command-specific behavior and request shaping.
- Tests mock `fetch` and validate request URLs, payloads, and structured responses.

### Extension guidance

When adding a new command:

1. Add the command module under `src/commands/`.
2. Register it in `src/cli.ts`.
3. Prefer the existing JSON envelope from `src/output.ts`.
4. Reuse `CliError` for user-facing failures.
5. Add focused tests for success and failure cases.

When adding a new API wrapper:

1. Put HTTP behavior in `src/client.ts` unless the project grows large enough to justify splitting it.
2. Keep command modules thin.
3. Normalize API failures before they reach the command layer.

## Commit Convention

This project uses Conventional Commits.

Use this format:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Rules for this repository:

- Every commit must start with a type prefix followed by `: `.
- Use a short optional scope when it clarifies the affected area, such as `cli`, `bookmarks`, `config`, `readme`, or `git`.
- Keep the subject line imperative and concise.
- Add a body when the reasoning, tradeoffs, or migration details are not obvious from the subject.
- Add footers for issue references or metadata when needed.
- Use `BREAKING CHANGE: ...` at the start of the footer or body section for incompatible changes.

Recommended types:

- `feat`: a new user-facing feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `test`: tests added or updated
- `refactor`: internal restructuring without behavior change
- `chore`: maintenance work that does not fit the user-facing categories
- `improvement`: implementation improvement without adding a new feature or fixing a bug

Examples:

```text
feat(cli): add collections and bookmarks commands
fix(config): reject invalid timeout values
docs(readme): add English usage guide
test(bookmarks): cover paginated list behavior
chore(git): ignore local issue notes
```

Preferred practice:

- Split unrelated changes into separate commits when practical.
- Do not mix broad refactors with feature work unless they are tightly coupled.
- Rewrite local commit messages before merging if they do not follow this format.
