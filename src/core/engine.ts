import { existsSync } from "node:fs";
import {
  DEFAULT_CONFIG,
  ensureDir,
  isInitialized,
  loadConfig,
  paths,
  resolveProjectRoot,
  saveConfig,
  type ResolvedPaths,
} from "./config.js";
import {
  checksum,
  missingSections,
  readDoc,
  writeDoc,
} from "./files.js";
import {
  currentChecksums,
  loadIndex,
  missingFiles,
  recordWrite,
  refreshIndex,
  saveIndex,
} from "./index-store.js";
import { appendLog, hasTaskCompletedSince, readLog } from "./log.js";
import { renderMindmapDoc, writeMindmap } from "./mindmap.js";
import {
  clearSession,
  contextMatchesDisk,
  isSessionFresh,
  loadSession,
  newSessionId,
  newTaskId,
  saveSession,
} from "./session.js";
import { TEMPLATES } from "./templates.js";
import type {
  AimemoryConfig,
  GovernanceFileKey,
  IndexData,
  SessionData,
} from "../types.js";

export interface Project {
  root: string;
  config: AimemoryConfig;
  p: ResolvedPaths;
}

/** Open a project handle (does not create anything). */
export function openProject(startDir?: string): Project {
  const root = resolveProjectRoot(startDir);
  const config = loadConfig(root);
  return { root, config, p: paths(root, config) };
}

export function isKnownFile(config: AimemoryConfig, key: string): key is GovernanceFileKey {
  return (config.files as string[]).includes(key);
}

/* ------------------------------------------------------------------ init --- */

export interface InitResult {
  root: string;
  createdConfig: boolean;
  scaffolded: GovernanceFileKey[];
  alreadyPresent: GovernanceFileKey[];
}

/**
 * Initialize aimemory in a project: create `.aimemory/`, write config, scaffold
 * any missing governance docs with templates, build index + mindmap.
 */
export function initProject(startDir?: string, docsDir?: string): InitResult {
  const root = resolveProjectRoot(startDir);
  const existed = isInitialized(root);
  const config: AimemoryConfig = existed
    ? loadConfig(root)
    : { ...DEFAULT_CONFIG, ...(docsDir ? { docsDir } : {}) };
  const p = paths(root, config);

  ensureDir(p.systemDir);
  ensureDir(p.docsDir);
  saveConfig(root, config);

  const scaffolded: GovernanceFileKey[] = [];
  const alreadyPresent: GovernanceFileKey[] = [];
  for (const key of config.files) {
    const docPath = p.docPath(key);
    if (existsSync(docPath)) {
      alreadyPresent.push(key);
      continue;
    }
    writeDoc(docPath, TEMPLATES[key].scaffold);
    scaffolded.push(key);
  }

  const index = refreshIndex(p, config);
  saveIndex(p, index);
  writeMindmap(p, config, index);
  appendLog(p, {
    event: "init",
    detail: `Initialized aimemory (docsDir=${config.docsDir})`,
    meta: { scaffolded, alreadyPresent },
  });

  return { root, createdConfig: !existed, scaffolded, alreadyPresent };
}

/* --------------------------------------------------------------- session --- */

export interface StartSessionResult {
  sessionId: string;
  state: SessionData["state"];
  needsBootstrap: boolean;
  missing: GovernanceFileKey[];
  instructions: string;
  compactContext?: CompactContext;
  bootstrapTemplates?: { key: GovernanceFileKey; requiredSections: string[] }[];
}

export interface CompactContext {
  currentPhase: string;
  mindmap: string;
  files: {
    key: GovernanceFileKey;
    exists: boolean;
    summary: string;
    headings: string[];
    bytes: number;
    updatedAt: string | null;
  }[];
}

function buildCompactContext(p: ResolvedPaths, config: AimemoryConfig, index: IndexData): CompactContext {
  const files = config.files.map((key) => {
    const e = index.files[key];
    return {
      key,
      exists: e.exists,
      summary: e.summary || TEMPLATES[key].purpose,
      headings: e.headings,
      bytes: e.bytes,
      updatedAt: e.updatedAt,
    };
  });
  return {
    currentPhase: extractCurrentPhase(p, config),
    mindmap: renderMindmapDoc(config, index),
    files,
  };
}

/** Pulls the "Current Phase" section body from phase.md, if present. */
function extractCurrentPhase(p: ResolvedPaths, config: AimemoryConfig): string {
  if (!config.files.includes("phase")) return "unknown";
  const doc = readDoc(p.docPath("phase"));
  if (!doc.exists) return "unknown";
  const lines = doc.content.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^##\s+Current Phase\s*$/i.test(l));
  if (idx === -1) return "unknown";
  const body: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    const t = lines[i].trim();
    if (t && !t.startsWith(">") && !t.startsWith("<!--")) body.push(t);
  }
  return body.join(" ").trim() || "unspecified";
}

const BOOTSTRAP_INSTRUCTIONS =
  "Governance files are missing or empty. Before doing ANY work you must author them. " +
  "For each file below, call `write_governance_file` with real content covering all required sections, " +
  "derived from the user's request/prompt. Do not begin_task until all files exist.";

const READY_INSTRUCTIONS =
  "Context loaded. You now have the mind map, per-file summaries, and current phase. " +
  "Fetch full file contents with `get_context(files=[...], full=true)` ONLY when needed (to save tokens). " +
  "Call `begin_task` before making changes, and `complete_task` after, updating memory.md.";

export function startSession(project: Project): StartSessionResult {
  const { p, config, root } = project;
  ensureDir(p.systemDir);
  // Persist config so MCP-only usage (without `aimemory init`) is fully
  // functional for status/guard checks.
  if (!isInitialized(root)) saveConfig(root, config);
  const index = refreshIndex(p, config);
  saveIndex(p, index);

  const missing = missingFiles(p, config);
  const sessionId = newSessionId();

  if (missing.length > 0) {
    const session: SessionData = {
      sessionId,
      state: "NEEDS_BOOTSTRAP",
      startedAt: new Date().toISOString(),
      contextChecksums: currentChecksums(p, config),
      activeTask: null,
    };
    saveSession(p, session);
    appendLog(p, {
      sessionId,
      event: "bootstrap_required",
      detail: `Missing governance files: ${missing.join(", ")}`,
      meta: { missing },
    });
    return {
      sessionId,
      state: "NEEDS_BOOTSTRAP",
      needsBootstrap: true,
      missing,
      instructions: BOOTSTRAP_INSTRUCTIONS,
      bootstrapTemplates: missing.map((key) => ({
        key,
        requiredSections: TEMPLATES[key].requiredSections,
      })),
    };
  }

  const session: SessionData = {
    sessionId,
    state: "CONTEXT_LOADED",
    startedAt: new Date().toISOString(),
    contextChecksums: currentChecksums(p, config),
    activeTask: null,
  };
  saveSession(p, session);
  appendLog(p, { sessionId, event: "session_start", detail: "Context loaded" });

  return {
    sessionId,
    state: "CONTEXT_LOADED",
    needsBootstrap: false,
    missing: [],
    instructions: READY_INSTRUCTIONS,
    compactContext: buildCompactContext(p, config, index),
  };
}

/* --------------------------------------------------------------- context --- */

export interface GetContextResult {
  compact: CompactContext;
  fullContents?: { key: GovernanceFileKey; content: string }[];
}

export function getContext(
  project: Project,
  files?: string[],
  full?: boolean,
): GetContextResult {
  const { p, config } = project;
  const index = refreshIndex(p, config);
  saveIndex(p, index);
  const result: GetContextResult = { compact: buildCompactContext(p, config, index) };

  if (full && files && files.length > 0) {
    result.fullContents = [];
    for (const key of files) {
      if (!isKnownFile(config, key)) continue;
      result.fullContents.push({ key, content: readDoc(p.docPath(key)).content });
    }
  }
  return result;
}

/* ----------------------------------------------------------------- write --- */

export interface WriteResult {
  key: GovernanceFileKey;
  bytes: number;
  ok: boolean;
  missingSections: string[];
  remainingBootstrap: GovernanceFileKey[];
  state: SessionData["state"];
}

export function writeGovernanceFile(
  project: Project,
  key: string,
  content: string,
  summary: string,
): WriteResult {
  const { p, config } = project;
  if (!isKnownFile(config, key)) {
    throw new Error(
      `Unknown governance file '${key}'. Valid: ${config.files.join(", ")}`,
    );
  }
  const tpl = TEMPLATES[key];
  const missing = missingSections(content, tpl.requiredSections);
  if (missing.length > 0) {
    return {
      key,
      bytes: 0,
      ok: false,
      missingSections: missing,
      remainingBootstrap: missingFiles(p, config),
      state: loadSession(p)?.state ?? "UNINITIALIZED",
    };
  }

  writeDoc(p.docPath(key), content);
  const sum = checksum(content.endsWith("\n") ? content : content + "\n");
  const bytes = Buffer.byteLength(content, "utf8");
  const doc = readDoc(p.docPath(key));

  const index = loadIndex(p, config);
  recordWrite(index, key, sum, bytes, doc.headings, summary);
  saveIndex(p, index);
  writeMindmap(p, config, index);

  const session = loadSession(p);
  const remaining = missingFiles(p, config);
  // Once bootstrap is complete, advance the session to CONTEXT_LOADED.
  if (session && session.state === "NEEDS_BOOTSTRAP" && remaining.length === 0) {
    session.state = "CONTEXT_LOADED";
    session.contextChecksums = currentChecksums(p, config);
    saveSession(p, session);
  }

  appendLog(p, {
    sessionId: session?.sessionId,
    event: "file_written",
    detail: `Wrote ${key}.md (${bytes} bytes)`,
    meta: { key, summary },
  });

  return {
    key,
    bytes,
    ok: true,
    missingSections: [],
    remainingBootstrap: remaining,
    state: loadSession(p)?.state ?? "CONTEXT_LOADED",
  };
}

/* ------------------------------------------------------------------ tasks --- */

export interface BeginTaskResult {
  ok: boolean;
  taskId?: string;
  error?: string;
  reminder?: string;
}

export function beginTask(project: Project, description: string): BeginTaskResult {
  const { p, config } = project;
  const session = loadSession(p);

  if (!session || session.state === "UNINITIALIZED") {
    return { ok: false, error: "No active session. Call start_session first." };
  }
  if (session.state === "NEEDS_BOOTSTRAP") {
    return {
      ok: false,
      error:
        "Governance files are incomplete. Author them via write_governance_file before starting tasks.",
    };
  }
  if (session.state === "TASK_ACTIVE") {
    return {
      ok: false,
      error: `A task is already active (${session.activeTask?.taskId}). Call complete_task first.`,
    };
  }
  // Gate: context must reflect what is on disk right now.
  if (!contextMatchesDisk(session, currentChecksums(p, config))) {
    return {
      ok: false,
      error:
        "Governance files changed since context was loaded. Call start_session/get_context again before starting a task.",
    };
  }

  const taskId = newTaskId();
  session.state = "TASK_ACTIVE";
  session.activeTask = {
    taskId,
    description,
    startedAt: new Date().toISOString(),
    startChecksums: currentChecksums(p, config),
  };
  saveSession(p, session);
  appendLog(p, {
    sessionId: session.sessionId,
    event: "task_begin",
    detail: description,
    meta: { taskId },
  });
  return {
    ok: true,
    taskId,
    reminder:
      "When done, call complete_task with a summary and update memory.md (and phase.md if the phase advanced).",
  };
}

export interface CompleteTaskResult {
  ok: boolean;
  error?: string;
  updatedFiles?: GovernanceFileKey[];
  state?: SessionData["state"];
}

export function completeTask(
  project: Project,
  taskId: string,
  summary: string,
): CompleteTaskResult {
  const { p, config } = project;
  const session = loadSession(p);

  if (!session || session.state !== "TASK_ACTIVE" || !session.activeTask) {
    return { ok: false, error: "No active task. Call begin_task first." };
  }
  if (session.activeTask.taskId !== taskId) {
    return {
      ok: false,
      error: `Task id mismatch. Active task is ${session.activeTask.taskId}.`,
    };
  }

  // Gate: memory.md must have changed since the task began.
  const now = currentChecksums(p, config);
  const start = session.activeTask.startChecksums;
  const changed = config.files.filter((k) => now[k] !== start[k]);

  if (config.files.includes("memory") && now.memory === start.memory) {
    return {
      ok: false,
      error:
        "memory.md was not updated during this task. Update it via write_governance_file (record the change under 'Recent Changes'), then call complete_task again.",
      updatedFiles: changed,
      state: session.state,
    };
  }

  session.state = "CONTEXT_LOADED";
  session.activeTask = null;
  session.contextChecksums = now;
  saveSession(p, session);

  const index = refreshIndex(p, config);
  saveIndex(p, index);
  writeMindmap(p, config, index);

  appendLog(p, {
    sessionId: session.sessionId,
    event: "task_complete",
    detail: summary,
    meta: { taskId, updatedFiles: changed },
  });

  return { ok: true, updatedFiles: changed, state: "CONTEXT_LOADED" };
}

/* ----------------------------------------------------------------- status --- */

export interface StatusResult {
  initialized: boolean;
  root: string;
  docsDir: string;
  state: SessionData["state"];
  sessionFresh: boolean;
  missing: GovernanceFileKey[];
  activeTask: SessionData["activeTask"];
  recentLog: ReturnType<typeof readLog>;
}

export function getStatus(project: Project): StatusResult {
  const { p, config, root } = project;
  const initialized = isInitialized(root);
  const session = loadSession(p);
  return {
    initialized,
    root,
    docsDir: config.docsDir,
    state: session?.state ?? "UNINITIALIZED",
    sessionFresh: isSessionFresh(session, config),
    missing: initialized ? missingFiles(p, config) : [...config.files],
    activeTask: session?.activeTask ?? null,
    recentLog: initialized ? readLog(p, 10) : [],
  };
}

/* ------------------------------------------------------------------ guard --- */

export interface GuardDecision {
  allow: boolean;
  reason: string;
}

/**
 * Decide whether a gated shell command may run. Requires: initialized project,
 * all governance files present, and a fresh CONTEXT_LOADED/TASK_ACTIVE session
 * whose loaded context still matches disk.
 */
export function guardDecision(project: Project): GuardDecision {
  const { p, config, root } = project;
  if (!isInitialized(root)) {
    return { allow: false, reason: "aimemory is not initialized. Run `aimemory init`." };
  }
  const missing = missingFiles(p, config);
  if (missing.length > 0) {
    return {
      allow: false,
      reason: `Governance files missing/empty: ${missing.join(", ")}. Author them first.`,
    };
  }
  const session = loadSession(p);
  if (!isSessionFresh(session, config)) {
    return {
      allow: false,
      reason: "No fresh session. Start a session (read context) before acting.",
    };
  }
  if (!contextMatchesDisk(session, currentChecksums(p, config))) {
    return {
      allow: false,
      reason: "Governance files changed since context load. Re-read context.",
    };
  }
  return { allow: true, reason: "Context is loaded and current." };
}

export {
  appendLog,
  clearSession,
  hasTaskCompletedSince,
  loadSession,
  readLog,
};
