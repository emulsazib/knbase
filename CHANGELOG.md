# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-07-14

Documentation and packaging release. No runtime/API changes — safe drop-in
upgrade from `0.1.0`.

### Added
- `LICENSE` file (MIT), making the open-source terms explicit.
- Contributing section in the README welcoming pull requests and issues.
- `publishConfig.access: "public"` in `package.json` so the scoped package
  (`@vonneollc/knbase`) always publishes publicly.

### Changed
- Reworked the README "Quick setup" to use the correct published package name
  `@vonneollc/knbase` (was previously the unscoped `knbase`).
- Documented running the MCP server and CLI via `npx` with no clone required.

### Fixed
- Corrected MCP configuration guidance: added macOS/GUI `PATH` notes and
  absolute-path examples (e.g. `/opt/homebrew/bin/npx`) so agents like Cursor
  can reliably launch the `knbase-mcp` server.

## [0.1.0] - 2026-07-13

Initial public release on npm as `@vonneollc/knbase`.

### Added
- Agent-agnostic AI project governance and memory system.
- MCP server (`knbase-mcp`) exposing the governance tools: `start_session`,
  `get_context`, `write_governance_file`, `begin_task`, `complete_task`,
  `get_mindmap`, and `get_status`.
- CLI (`knbase`) with `init`, `status`, `check`, `guard`, `install-hooks`,
  `precommit`, and `agents-doc` commands.
- Governance document scaffolding (`prd`, `architecture`, `design`, `phase`,
  `rules`, `memory`) with required-section validation.
- Deterministic combined mind map, per-file index with checksums, session
  state machine, activity log, and generated `AGENTS.md` contract.
- Git pre-commit hook and `guard` wrapper as hard enforcement gates.

[0.1.1]: https://github.com/emulsazib/knbase/releases/tag/v0.1.1
[0.1.0]: https://github.com/emulsazib/knbase/releases/tag/v0.1.0
