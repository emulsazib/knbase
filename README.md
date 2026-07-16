# knbase

Agent-agnostic AI project governance and memory system.

`knbase` forces any AI agent to work on a project the *right* way:

1. **Read before acting.** Before doing anything, an agent must load the project's
   governance context (a compact mind map + per-file summaries + current phase).
2. **Bootstrap if missing.** If the governance docs don't exist, the system
   generates templates and instructs the agent to author them *first*, based on
   its understanding of the user's request.
3. **Gate every task.** An agent must open a task before making changes and close
   it afterwards; closing is refused until project memory is updated.
4. **Build a knowledge base.** Every task appends to `memory.md`, regenerates a
   combined mind map, and writes an activity log, so the next agent can extend the
   project from existing code and design instead of re-deriving everything.
5. **Save tokens.** Full documents are only loaded on demand; by default agents
   get compact summaries + a mind map.

## Governance documents

Stored in `memory-bank/` (configurable) in each project root:

| File | Purpose |
| --- | --- |
| `prd.md` | Product requirements: what we're building and why |
| `architecture.md` | System structure, components, data flow |
| `design.md` | Detailed design, interfaces, decisions |
| `phase.md` | Current phase and roadmap |
| `rules.md` | Hard rules and guardrails every agent must obey |
| `memory.md` | Running knowledge base, updated after every task |

System artifacts live in `.knbase/` (`config.json`, `index.json`,
`mindmap.md`, `activity.log`, `session.json`) and should not be edited by hand.

## Quick setup (recommended, no clone)

The package is published as [`@vonneollc/knbase`](https://www.npmjs.com/package/@vonneollc/knbase),
so you can use it without cloning this repo.

**Zero-command flow:** the only thing you do is register the MCP server (below).
Once it is connected, the agent receives the governance workflow automatically
(via the server's MCP `instructions`) and knbase **self-initializes on first use** —
it creates `.knbase/`, scaffolds the governance docs, and writes `AGENTS.md` the
first time the agent calls `start_session`. You do **not** need to run `knbase init`.

**Register the MCP server** with your agent. Cursor example
(`~/.cursor/mcp.json` for all projects, or `.cursor/mcp.json` for one project):

```json
{
  "mcpServers": {
    "knbase": {
      "command": "npx",
      "args": ["-y", "--package", "@vonneollc/knbase", "knbase-mcp"],
      "env": { "KNBASE_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

> **macOS / GUI apps:** apps like Cursor often don't inherit your shell `PATH`,
> so `npx` (or `knbase-mcp`) may not be found. If the server fails to start, use
> an absolute path for `command`. Find it with `which npx` (e.g.
> `/opt/homebrew/bin/npx` for Homebrew Node), then set
> `"command": "/opt/homebrew/bin/npx"`.

Prefer a global install? Then the bins are available directly:

```bash
npm install -g @vonneollc/knbase
which knbase-mcp     # e.g. /opt/homebrew/bin/knbase-mcp
```

```json
{
  "mcpServers": {
    "knbase": {
      "command": "/opt/homebrew/bin/knbase-mcp",
      "env": { "KNBASE_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

…and run CLI commands with `knbase <command>` (e.g. `knbase init`).

`KNBASE_ROOT` is optional; if omitted the server resolves the project root by
walking up from the working directory (looking for `.knbase/` or `.git`). Each
tool also accepts an explicit `root` argument.

**Optional — `knbase init`:** you can pre-scaffold governance in a project without
MCP (e.g. for non-MCP agents or shell workflows) by running
`npx -y --package @vonneollc/knbase knbase init` in the project. This is the same
setup the MCP server performs automatically, so it is not required.

## Complete setup (from source)

Use this while developing knbase, or before it is published to npm.

```bash
git clone <repo-url> knbase
cd knbase
npm install
npm run build        # compiles TypeScript into dist/
```

Then either expose the binaries on your PATH with `npm link`:

```bash
npm link             # makes `knbase` and `knbase-mcp` available globally
cd /path/to/your/project
knbase init
```

…or reference the built files directly by absolute path.

MCP config (from source):

```json
{
  "mcpServers": {
    "knbase": {
      "command": "node",
      "args": ["/absolute/path/to/knbase/dist/mcp/server.js"],
      "env": { "KNBASE_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

CLI (from source):

```bash
node /absolute/path/to/knbase/dist/cli/index.js init
```

### MCP tools

| Tool | Description |
| --- | --- |
| `start_session` | **Mandatory first call.** Loads compact context, or returns bootstrap templates if docs are missing. |
| `get_context` | Returns compact context; pass `files=[...] full=true` to fetch specific docs in full. |
| `write_governance_file` | Create/update a doc (validates required sections, refreshes index + mind map). |
| `begin_task` | Gate: refuses unless context was loaded this session. |
| `complete_task` | Gate: refuses unless `memory.md` was updated for the task. |
| `get_mindmap` | Returns the combined mermaid mind map + index. |
| `get_status` | Session state, missing files, active task, recent log. |

## CLI commands

```bash
knbase init                 # scaffold governance docs, index, mind map, AGENTS.md
knbase status               # show session state, missing files, recent log
knbase check                # exit 0 only if context is loaded and current
knbase guard -- <command>   # run a command only if governance context is loaded
knbase install-hooks        # install a git pre-commit hook that enforces updates
knbase agents-doc           # print the AGENTS.md contract
```

## Enforcement model

A stdio MCP server cannot intercept another process's file edits at the OS level,
so enforcement is layered:

1. **State machine** — MCP tools refuse out-of-order calls
   (`UNINITIALIZED -> NEEDS_BOOTSTRAP -> CONTEXT_LOADED -> TASK_ACTIVE -> ...`).
2. **Contract** — `init` writes an `AGENTS.md` that every agent reads by convention.
3. **Hard gates** — the `git pre-commit` hook and `knbase guard` wrapper block
   real actions (commits, shell commands) until governance is satisfied.

## Token discipline

- `start_session` / `get_context` return only the mind map, one-line summaries,
  and current phase by default.
- Summaries are supplied by the agent at write time, so the server makes **no LLM
  calls** and adds no API cost.
- The mind map is built deterministically from headings + summaries.
- Checksums in `index.json` skip regeneration for unchanged files.

## Development

```bash
npm run typecheck
npm run dev:mcp     # run the MCP server with tsx
npm run dev:cli -- status
```

## Contributing

Contributions are welcome from everyone. Fork the repo, create a branch, and
open a pull request. Bug reports and feature ideas via issues are equally
appreciated. By contributing you agree that your contributions are licensed
under the project's MIT license.

## License

Released under the [MIT License](./LICENSE) — free to use, modify, distribute,
and build upon, including commercially.
