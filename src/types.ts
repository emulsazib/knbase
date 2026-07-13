/**
 * Shared types for the knbase governance system.
 */

/** Canonical governance document keys. Order defines display order everywhere. */
export const GOVERNANCE_FILES = [
  "prd",
  "architecture",
  "design",
  "phase",
  "rules",
  "memory",
] as const;

export type GovernanceFileKey = (typeof GOVERNANCE_FILES)[number];

/** Session gate states. The state machine enforces the read -> act -> update flow. */
export type SessionState =
  | "UNINITIALIZED" // no session started yet
  | "NEEDS_BOOTSTRAP" // one or more governance files are missing/empty
  | "CONTEXT_LOADED" // agent has read context this session; may begin tasks
  | "TASK_ACTIVE"; // a task is in progress; must be completed with updates

/** Per-file metadata cached in .knbase/index.json. */
export interface FileIndexEntry {
  /** Governance file key. */
  key: GovernanceFileKey;
  /** Relative path from project root. */
  path: string;
  /** Whether the file currently exists on disk. */
  exists: boolean;
  /** SHA-256 checksum of file contents (empty string when missing). */
  checksum: string;
  /** Size in bytes. */
  bytes: number;
  /** One-line summary supplied by the agent at write time. */
  summary: string;
  /** Markdown H2 (##) section headings extracted from the file. */
  headings: string[];
  /** ISO timestamp of the last write through the system. */
  updatedAt: string | null;
}

export interface IndexData {
  version: number;
  updatedAt: string;
  files: Record<GovernanceFileKey, FileIndexEntry>;
}

export interface SessionData {
  sessionId: string;
  state: SessionState;
  startedAt: string;
  /** Checksums of governance files at the moment context was loaded. */
  contextChecksums: Record<string, string>;
  activeTask: ActiveTask | null;
}

export interface ActiveTask {
  taskId: string;
  description: string;
  startedAt: string;
  /** Checksums of governance files when the task began (to detect updates). */
  startChecksums: Record<string, string>;
}

export interface KnbaseConfig {
  version: number;
  /** Directory (relative to project root) holding the governance docs. */
  docsDir: string;
  /** Governance file keys managed by the system. */
  files: GovernanceFileKey[];
  /**
   * Session freshness TTL in minutes. A session older than this is considered
   * stale and the agent must re-load context. Used by the CLI guard.
   */
  sessionTtlMinutes: number;
}

/** A single append-only activity log record. */
export interface LogRecord {
  ts: string;
  sessionId?: string;
  event:
    | "session_start"
    | "bootstrap_required"
    | "file_written"
    | "task_begin"
    | "task_complete"
    | "guard_allow"
    | "guard_block"
    | "init";
  detail: string;
  meta?: Record<string, unknown>;
}
