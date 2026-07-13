import type { AimemoryConfig } from "../types.js";
import { TEMPLATES } from "./templates.js";

/**
 * Generates the AGENTS.md contract placed at the project root. Every agent reads
 * this by convention; it is the primary "soft" enforcement layer.
 */
export function renderAgentsDoc(config: AimemoryConfig): string {
  const fileList = config.files
    .map((k) => `- \`${config.docsDir}/${k}.md\` — ${TEMPLATES[k].purpose}`)
    .join("\n");

  return `# AGENTS.md — Governance Contract (managed by aimemory)

This project is governed by **aimemory**. Any AI agent working here MUST follow
this workflow. Do not skip steps. This exists so any agent can safely extend the
project from existing code and design without re-deriving context.

## Governance documents (${config.docsDir}/)

${fileList}

Plus system artifacts in \`.aimemory/\` (index, mind map, activity log) — do not edit by hand.

## Required workflow

1. **Read before acting.** Call the \`start_session\` MCP tool first. It returns a
   compact mind map, per-file summaries, and the current phase. Fetch a full doc
   only when needed via \`get_context(files=[...], full=true)\` to conserve tokens.
2. **Bootstrap if missing.** If \`start_session\` reports \`NEEDS_BOOTSTRAP\`, author
   every missing file with \`write_governance_file\` (all required sections) based on
   your understanding of the user's request, BEFORE doing any other work.
3. **Gate every task.** Call \`begin_task\` before making changes and \`complete_task\`
   after. \`begin_task\` refuses until context is loaded; \`complete_task\` refuses
   until \`memory.md\` was updated for that task.
4. **Update knowledge after each task.** Append what changed to \`memory.md\`
   ("Recent Changes", "Learnings & Gotchas") and advance \`phase.md\` when relevant.

## Without MCP (any agent / shell)

- Initialize: \`npx aimemory init\`
- Check status / gate: \`aimemory status\` or \`aimemory check\`
- Run gated commands: \`aimemory guard -- <your command>\` (refuses until context is loaded)
- A git \`pre-commit\` hook (via \`aimemory install-hooks\`) blocks commits unless a task
  was completed with a memory update.

## Token discipline

Prefer summaries and the mind map over full files. Only load full document content
when a task truly requires it.
`;
}
