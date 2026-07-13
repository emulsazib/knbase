# aimemory

Agent-agnostic AI project governance and memory system.

`aimemory` forces any AI agent to work on a project the *right* way:

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

System artifacts live in `.aimemory/` (`config.json`, `index.json`,
`mindmap.md`, `activity.log`, `session.json`) and should not be edited by hand.

## Install / build

```bash
npm install
npm run build
```

## Use as an MCP server (any MCP-capable agent)

Add to your agent's MCP config. Example (Cursor `~/.cursor/mcp.json` or a
project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "aimemory": {
      "command": "node",
      "args": ["/absolute/path/to/aimemory/dist/mcp/server.js"],
      "env": { "AIMEMORY_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

`AIMEMORY_ROOT` is optional; if omitted the server resolves the project root by
walking up from the working directory (looking for `.aimemory/` or `.git`). Each
tool also accepts an explicit `root` argument.

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

## Use via the CLI (any agent / shell)

```bash
# Initialize governance in the current project
npx aimemory init            # or: node dist/cli/index.js init

# Show status / gate in scripts
aimemory status
aimemory check               # exit 0 only if context is loaded and current

# Run a command only if governance context is loaded and current
aimemory guard -- <your command>

# Install a git pre-commit hook that blocks commits unless a task was completed
aimemory install-hooks

# Print the AGENTS.md contract
aimemory agents-doc
```

## Enforcement model

A stdio MCP server cannot intercept another process's file edits at the OS level,
so enforcement is layered:

1. **State machine** — MCP tools refuse out-of-order calls
   (`UNINITIALIZED -> NEEDS_BOOTSTRAP -> CONTEXT_LOADED -> TASK_ACTIVE -> ...`).
2. **Contract** — `init` writes an `AGENTS.md` that every agent reads by convention.
3. **Hard gates** — the `git pre-commit` hook and `aimemory guard` wrapper block
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

## License

MIT
