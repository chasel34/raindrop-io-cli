# Raindrop CLI Design v1.0

Date: 2026-04-14
Version: 1.0
Status: Approved design

## Building

We are building a `raindrop` CLI that can be installed on `PATH` and used from any working directory. It is designed for personal use first, with Codex-friendly command shapes, stable JSON output, simple token-based authentication, and a narrow but useful set of Raindrop.io operations.

The CLI will use the official Raindrop.io REST API as the protocol source of truth. The Raycast Raindrop.io extension is used only as a workflow reference for identifying common user actions such as search, quick add, collection resolution, and defaulting new bookmarks to `Unsorted`.

## Not Building

The first version does not include:

- Full OAuth browser authorization flow
- Batch bookmark deletion
- Empty Trash
- Batch bookmark updates
- Collection deletion, merge, or bulk reorder
- File upload or cover upload
- Browser-tab capture or local browser integration
- Interactive TUI workflows

## Approach

The CLI will use TypeScript with Commander and target Node.js. This keeps the implementation approachable to maintain while still supporting a durable command-line tool with clean subcommands, stable machine-readable output, and a clear path for future expansion.

The install name will be `raindrop`.

This design now treats the CLI as a medium-sized first release rather than a tiny scaffold. The planned layout exceeds the 8-file threshold because the command surface, output contract, auth handling, and typed API boundary are all first-class requirements in v1.0.

## Why This Stack

- TypeScript matches the preferred maintenance language
- Commander is sufficient for a resource-oriented CLI surface
- Node is the selected runtime target
- `pnpm` is the selected package manager
- `tsdown` will handle builds
- `prettier` will handle formatting
- `vitest` will handle tests
- Raindrop.io does not require a JavaScript SDK to access its REST API
- This keeps future edits, debugging, and packaging lightweight

## Toolchain Decisions

- Runtime target: `Node.js >= 22.18.0`
- Package manager: `pnpm`
- CLI framework: `commander`
- Build tool: `tsdown`
- Formatter: `prettier`
- Test runner: `vitest`
- Language: `TypeScript`

Version policy:

- Use the latest stable version of each package at initialization time
- Commit the lockfile
- Prefer exact dependency versions for the initial scaffold to keep installs reproducible

Initial package set:

- `commander`
- `tsdown`
- `prettier`
- `vitest`
- `typescript`

## Command Surface

The v1 command contract is:

```bash
raindrop --json doctor
raindrop --json user me
raindrop --json collections list --tree
raindrop --json collections resolve --name Research
raindrop --json tags list --collection 123
raindrop --json bookmarks list --collection 0 --limit 20
raindrop --json bookmarks search 'typescript #performance' --collection 0 --limit 20
raindrop --json bookmarks get 123
raindrop --json bookmarks suggest --url https://example.com
raindrop --json bookmarks create --url https://example.com --collection -1 --title "Example" --tags a,b --parse
raindrop --json request get /rest/v1/user
```

The initial release does not include an interactive setup command. Auth setup in v1.0 is explicit and documented: users provide credentials through `--token`, `RAINDROP_TOKEN`, or `~/.raindrop/config.toml`.

## Key Decisions

### Runtime

TypeScript and Node are the selected runtime because this CLI does not need Rust-specific performance or packaging advantages strongly enough to offset maintainability cost. The runtime baseline will be `Node.js >= 22.18.0`.

### Package Management

`pnpm` is the selected package manager. The project should declare its package manager in `package.json` and commit `pnpm-lock.yaml` so installs remain reproducible across machines and future sessions.

### Build, Format, and Test

- `tsdown` will build the CLI for distribution
- `prettier` will be the only formatter in the initial version
- `vitest` will cover unit tests and command-level behavior tests

The initial toolchain intentionally stays lean. ESLint is out of scope for the first pass unless it becomes necessary during implementation.

### Authentication

Version 1 supports test-token authentication only. The auth layer will still be abstracted so a future OAuth implementation can be added without redesigning command handlers.

Auth precedence:

1. `--token`
2. `RAINDROP_TOKEN`
3. `~/.raindrop/config.toml`

The CLI must never print full tokens.

Auth setup path in v1.0:

- One-off usage: pass `--token`
- Session or shell usage: export `RAINDROP_TOKEN`
- Persistent local setup: create `~/.raindrop/config.toml`

The supported config file shape in v1.0 is:

```toml
token = "rdt_xxx"
base_url = "https://api.raindrop.io/rest/v1"
timeout_ms = 10000
```

Config rules:

- `token` is optional only when another auth source is present
- `base_url` is optional and defaults to the official REST base URL
- `timeout_ms` is optional and defaults to the CLI default timeout
- Unknown keys are ignored in v1.0
- Invalid TOML is a user error and must produce a structured config parse failure

The CLI will not write config files in v1.0. Users create or edit the file themselves based on the documented schema.

### Output Policy

- `--json` writes JSON to stdout only
- Diagnostics and progress go to stderr
- Errors in JSON mode must be machine-readable
- Empty successful results still exit with status code `0`

Stable JSON contract in v1.0:

- Success envelope for object reads:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "command": "user me"
  }
}
```

- Success envelope for list/search reads:

```json
{
  "ok": true,
  "data": {
    "items": []
  },
  "meta": {
    "command": "bookmarks list",
    "pagination": {
      "page": 0,
      "perPage": 20,
      "returned": 0,
      "hasMore": false
    }
  }
}
```

- Success envelope for write commands:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "command": "bookmarks create"
  }
}
```

- Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "auth_missing",
    "message": "Raindrop token not found",
    "status": 401
  },
  "meta": {
    "command": "user me"
  }
}
```

JSON contract rules:

- The CLI uses a CLI-shaped envelope, not raw API pass-through
- `data` contains normalized command output
- `meta.command` is always present
- `meta.pagination` is present only for list/search commands
- `status` is present on API-derived errors when known
- Secrets must never appear in `data`, `error`, or `meta`
- `request get` still returns the same envelope, with the remote payload nested under `data`

Human-readable output rules:

- Non-JSON mode is allowed for every command
- Human mode should prefer concise summaries over raw object dumps
- Human mode is not considered stable for scripting
- Error messages in human mode must still omit tokens and unrelated headers

### Safe Write Scope

The only write command in v1 is `bookmarks create`. This keeps rollback cheap and avoids shipping dangerous operations too early.

### Collections Modeling

Collections must be modeled explicitly because Raindrop returns root collections and child collections separately. The CLI will fetch both, rebuild hierarchy, and expose a stable tree/path view.

### Pagination

List and search commands will default to shallow pagination. Explicit flags such as `--limit`, `--page`, and `--per-page` will control breadth. The CLI should not silently fetch all pages by default.

### Raw Escape Hatch

`request get` exists as a repair hatch for unsupported reads. It is not the primary interface.

Raw request boundaries in v1.0:

- Only `request get` is supported
- No raw `post`, `put`, `patch`, or `delete`
- No arbitrary auth header override
- No bypass of the standard output envelope

### Installation Contract

The CLI must be runnable from any working directory through a standard Node package binary.

Distribution and installation rules:

- `package.json` must define a `bin` entry for `raindrop`
- Local development install must support `pnpm link --global`
- Repository-local execution may use `pnpm exec raindrop` during development
- A local install helper may be added in `Makefile`, but it is optional and does not replace `bin`

Smoke test contract:

1. Install dependencies with `pnpm install`
2. Build with the project build script
3. Run `pnpm link --global`
4. Change into `/tmp`
5. Verify `command -v raindrop`
6. Verify `raindrop --help`
7. Verify `raindrop --json doctor`

If the CLI fails any `/tmp` smoke test, it does not meet the design goal of being runnable from any directory.

## Architecture

```text
shell / codex
    |
    v
raindrop CLI (commander)
    |
    +-- config/auth resolver
    +-- typed api client
    +-- command handlers
    +-- json/text formatter
    |
    v
Raindrop REST API
```

There are four meaningful components exchanging data in this design:

```text
shell / codex
    |
    v
commander command layer
    |
    v
config + auth resolver
    |
    v
typed raindrop api client
    |
    v
output formatter
    |
    v
stdout/stderr
```

The flow is one-directional in normal execution. No cycle is required for v1.0.

## Planned File Layout

The initial implementation should stay small and explicit:

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsdown.config.ts`
- `.prettierrc`
- `.prettierignore`
- `vitest.config.ts`
- `README.md`
- `src/index.ts`
- `src/cli.ts`
- `src/config.ts`
- `src/auth.ts`
- `src/client.ts`
- `src/errors.ts`
- `src/output.ts`
- `src/commands/doctor.ts`
- `src/commands/user.ts`
- `src/commands/collections.ts`
- `src/commands/tags.ts`
- `src/commands/bookmarks.ts`
- `src/commands/request.ts`
- `src/types/api.ts`
- `Makefile`

This is intentionally above the 8-file threshold from the `think` checklist. The split is justified because config/auth, client behavior, output shaping, and command handlers each need isolated tests and clear ownership boundaries in a CLI that promises stable JSON.

## External Dependencies

Required:

- One Raindrop.io account
- One Raindrop.io test token
- Official Raindrop.io REST API

Reference-only:

- Official Raindrop.io documentation
- Raycast Raindrop.io extension implementation

## Failure and Risk Handling

### Dependency Failure

If the API is unavailable or rate limited, `doctor` must still return useful diagnostics. Read-only requests may use lightweight retry behavior. Write requests must not be retried automatically.

### Scale Explosion

The likely first failure point at 10x data volume is search/list breadth. The design avoids eager full-account fetches and requires explicit pagination controls.

### Rollback Cost

This design is easy to roll back because it does not change local persistent state beyond a simple config file and it limits remote mutation to bookmark creation.

### Premise Collapse

The most fragile assumption is that the CLI is for personal use. If the scope changes to multi-user distribution, OAuth must be added, but the command layer and typed client can remain intact.

## Testing Paths

Meaningful verification paths for v1:

- `doctor` with no token
- `doctor` with env token
- `doctor` with config token
- `user me`
- `collections list --tree`
- `collections resolve --name` with unique, ambiguous, and missing results
- `tags list` globally and by collection
- `bookmarks list` with pagination and empty results
- `bookmarks search` with direct search syntax passthrough
- `bookmarks get` success and not found
- `bookmarks suggest --url`
- `bookmarks create` success
- `bookmarks create` with invalid URL
- `bookmarks create` handling `401`
- `bookmarks create` handling `429`
- `request get` reusing the same auth and error handling
- invalid config TOML
- `/tmp` smoke test after global linking
- non-JSON help and human-readable success output
- error envelope shape consistency across auth, config, network, and API failures

Command-level verification should run under `vitest`, with focused coverage on pure helpers, client behavior, argument validation, output shaping, and error handling.

## Unknowns

- Whether v1.1 should add `bookmarks update`
  Reason: the current write surface is intentionally minimal to reduce irreversible behavior in the first release.
  Owner: us after v1.0 read and create commands are stable.

- Whether v1.1 should add a guided setup command such as `auth doctor` or `init`
  Reason: v1.0 has a complete manual setup path, so guided setup is a usability enhancement rather than a blocker.
  Owner: us after observing whether the documented config path feels too sharp in practice.

- Whether `base_url` should remain configurable in normal user docs
  Reason: it is useful for testing and future-proofing, but most users should never touch it.
  Owner: us during implementation review of config ergonomics.

## References

- Official docs overview: <https://developer.raindrop.io>
- Auth tokens: <https://developer.raindrop.io/v1/authentication/token>
- Collections API: <https://developer.raindrop.io/v1/collections/methods>
- Single raindrop API: <https://developer.raindrop.io/v1/raindrops/single>
- Multiple raindrops API: <https://developer.raindrop.io/v1/raindrops/multiple>
- Tags API: <https://developer.raindrop.io/v1/tags>
- Raycast extension package: <https://github.com/raycast/extensions/blob/248db2890f1439478f4a0eec184e350503f6e2df/extensions/raindrop-io/package.json>
- Raycast extension README: <https://github.com/raycast/extensions/blob/248db2890f1439478f4a0eec184e350503f6e2df/extensions/raindrop-io/README.md>
- Raycast PR for quick add: <https://github.com/raycast/extensions/pull/24019>
- Raycast PR for collections fix: <https://github.com/raycast/extensions/pull/26381>

## Next Step

Implementation can start from:

1. CLI scaffold and package metadata
2. Shared config/auth/client/output layers
3. `doctor`
4. Read commands
5. `bookmarks create`
6. `request get`
