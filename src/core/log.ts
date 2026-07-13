import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { ensureDir } from "./config.js";
import type { ResolvedPaths } from "./config.js";
import type { LogRecord } from "../types.js";

/** Append a record to the JSONL activity log. */
export function appendLog(
  p: ResolvedPaths,
  record: Omit<LogRecord, "ts">,
): LogRecord {
  ensureDir(p.systemDir);
  const full: LogRecord = { ts: new Date().toISOString(), ...record };
  appendFileSync(p.logPath, JSON.stringify(full) + "\n", "utf8");
  return full;
}

/** Read the most recent `limit` log records (newest last). */
export function readLog(p: ResolvedPaths, limit = 50): LogRecord[] {
  if (!existsSync(p.logPath)) return [];
  const lines = readFileSync(p.logPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const slice = limit > 0 ? lines.slice(-limit) : lines;
  const out: LogRecord[] = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line) as LogRecord);
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

/**
 * Whether a task_complete event has been recorded since the given ISO time.
 * Used by the git pre-commit gate to require a memory update per change set.
 */
export function hasTaskCompletedSince(p: ResolvedPaths, sinceIso: string | null): boolean {
  const records = readLog(p, 0);
  const since = sinceIso ? Date.parse(sinceIso) : 0;
  return records.some(
    (r) => r.event === "task_complete" && Date.parse(r.ts) >= since,
  );
}
