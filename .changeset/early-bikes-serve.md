---
---

Initial npm release of the Raindrop.io CLI.

This release introduces the `raindrop` command with automation-friendly JSON output, structured error handling, and token resolution from `--token`, `RAINDROP_TOKEN`, or `~/.raindrop/config.toml`.

Included command groups:

- `doctor` for config and token diagnostics
- `user me` for authenticated account information
- `collections` for listing, resolving, creating, updating, and deleting collections
- `tags list` for global or collection-scoped tag reads
- `bookmarks` for listing, searching, reading, suggesting, creating, updating, and deleting bookmarks
- `request get` as a read-only raw API escape hatch

The package is published as `@chasel34/raindrop-cli`, and the installed binary is `raindrop`.
