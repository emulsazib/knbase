import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  beginTask,
  completeTask,
  getContext,
  getStatus,
  openProject,
  startSession,
  writeGovernanceFile,
} from "../core/engine.js";
import { renderMindmapDoc } from "../core/mindmap.js";
import { refreshIndex, saveIndex } from "../core/index-store.js";
import { GOVERNANCE_FILES } from "../types.js";

type TextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(payload: unknown): TextResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function fail(message: string, extra?: unknown): TextResult {
  return {
    content: [
      { type: "text", text: JSON.stringify({ error: message, ...(extra ? { extra } : {}) }, null, 2) },
    ],
    isError: true,
  };
}

/**
 * Determines the project root for a tool call. The client may pass an explicit
 * `root`; otherwise the server falls back to AIMEMORY_ROOT / cwd resolution.
 */
function project(root?: string) {
  return openProject(root);
}

export function registerTools(server: McpServer): void {
  const fileEnum = z.enum(GOVERNANCE_FILES);
  const rootArg = { root: z.string().optional().describe("Absolute project root. Defaults to AIMEMORY_ROOT or cwd.") };

  server.registerTool(
    "start_session",
    {
      title: "Start governance session",
      description:
        "MANDATORY FIRST CALL. Loads project governance context (mind map + summaries + current phase) token-efficiently. If governance files are missing, returns bootstrap templates and instructs you to author them before doing any work.",
      inputSchema: { ...rootArg },
    },
    async ({ root }) => {
      try {
        return ok(startSession(project(root)));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "get_context",
    {
      title: "Get governance context",
      description:
        "Returns the compact context (mind map + summaries + phase). Pass files=[...] with full=true to fetch full contents of specific docs ONLY when needed, to conserve tokens.",
      inputSchema: {
        ...rootArg,
        files: z.array(fileEnum).optional().describe("Governance files to fetch in full."),
        full: z.boolean().optional().describe("If true, include full contents of `files`."),
      },
    },
    async ({ root, files, full }) => {
      try {
        return ok(getContext(project(root), files, full));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "write_governance_file",
    {
      title: "Write/update a governance file",
      description:
        "Create or update one governance doc (prd, architecture, design, phase, rules, memory). Validates that all required sections are present, then refreshes the index and mind map. Use for bootstrap AND for post-task updates.",
      inputSchema: {
        ...rootArg,
        file: fileEnum.describe("Which governance file to write."),
        content: z.string().describe("Full markdown content (must include all required H2 sections)."),
        summary: z
          .string()
          .describe("One-line summary of this file (shown in mind map to save tokens)."),
      },
    },
    async ({ root, file, content, summary }) => {
      try {
        const result = writeGovernanceFile(project(root), file, content, summary);
        if (!result.ok) {
          return fail(
            `Missing required sections in ${file}.md: ${result.missingSections.join(", ")}`,
            result,
          );
        }
        return ok(result);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "begin_task",
    {
      title: "Begin a task (gated)",
      description:
        "Call BEFORE making any changes. Refuses unless context has been loaded this session (the read-before-action gate). Returns a taskId.",
      inputSchema: {
        ...rootArg,
        description: z.string().describe("What this task will accomplish."),
      },
    },
    async ({ root, description }) => {
      const result = beginTask(project(root), description);
      return result.ok ? ok(result) : fail(result.error ?? "begin_task failed", result);
    },
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task (gated)",
      description:
        "Call AFTER finishing work. Refuses unless memory.md was updated during the task (the update-after-action gate). Regenerates the mind map and appends the activity log.",
      inputSchema: {
        ...rootArg,
        taskId: z.string().describe("The taskId returned by begin_task."),
        summary: z.string().describe("What was accomplished (recorded in the activity log)."),
      },
    },
    async ({ root, taskId, summary }) => {
      const result = completeTask(project(root), taskId, summary);
      return result.ok ? ok(result) : fail(result.error ?? "complete_task failed", result);
    },
  );

  server.registerTool(
    "get_mindmap",
    {
      title: "Get combined mind map",
      description: "Returns the auto-generated mermaid mind map + index table combining all governance docs.",
      inputSchema: { ...rootArg },
    },
    async ({ root }) => {
      try {
        const proj = project(root);
        const index = refreshIndex(proj.p, proj.config);
        saveIndex(proj.p, index);
        return ok({ mindmap: renderMindmapDoc(proj.config, index) });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "get_status",
    {
      title: "Get governance status",
      description: "Returns session state, missing files, active task, and recent activity log.",
      inputSchema: { ...rootArg },
    },
    async ({ root }) => {
      try {
        return ok(getStatus(project(root)));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
