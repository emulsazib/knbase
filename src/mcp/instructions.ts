/**
 * Server-level MCP instructions. The SDK returns this string in the `initialize`
 * response, and MCP clients (Cursor, Claude Code, Claude Desktop, VS Code) inject
 * it into the model's context automatically the moment knbase connects — so the
 * agent follows the governance workflow with no user action and no commands.
 *
 * Kept concise because it is sent on every session (token cost). Mirrors the
 * AGENTS.md contract (src/core/agents-doc.ts) and the engine's READY/BOOTSTRAP
 * instructions so the messaging stays consistent.
 */
export const SERVER_INSTRUCTIONS = `This project is governed by knbase. Follow this workflow automatically for EVERY user request — do not wait to be told.

1. Read before acting: call \`start_session\` FIRST. It returns a compact mind map, per-file summaries, and the current phase. knbase self-initializes on the first call — no setup command is needed.
2. Save tokens: do NOT scan or read the whole codebase. Rely on the compact context and \`memory.md\`; fetch a full governance doc only via \`get_context(files=[...], full=true)\` when a task truly needs it; open only the specific source files a task requires.
3. Bootstrap if needed: if \`start_session\` returns NEEDS_BOOTSTRAP, author every missing file with \`write_governance_file\` (all required sections) from the user's request before doing any other work.
4. Gate every task: call \`begin_task\` before making changes and \`complete_task\` after.
5. Update the knowledge base after every task: record what changed in \`memory.md\` (and advance \`phase.md\` when relevant). \`complete_task\` refuses until \`memory.md\` was updated.`;
