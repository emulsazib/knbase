import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ensureDir, type ResolvedPaths } from "./config.js";
import type { KnbaseConfig, SessionData } from "../types.js";

export function loadSession(p: ResolvedPaths): SessionData | null {
  if (!existsSync(p.sessionPath)) return null;
  try {
    return JSON.parse(readFileSync(p.sessionPath, "utf8")) as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(p: ResolvedPaths, session: SessionData): void {
  ensureDir(p.systemDir);
  writeFileSync(p.sessionPath, JSON.stringify(session, null, 2) + "\n", "utf8");
}

export function clearSession(p: ResolvedPaths): void {
  if (existsSync(p.sessionPath)) rmSync(p.sessionPath);
}

export function newSessionId(): string {
  return `s_${randomUUID().slice(0, 8)}`;
}

export function newTaskId(): string {
  return `t_${randomUUID().slice(0, 8)}`;
}

/**
 * A session is fresh when it exists, is in a usable state, and started within
 * the configured TTL. Stale sessions force the agent to re-load context, which
 * is the CLI guard's primary gate.
 */
export function isSessionFresh(
  session: SessionData | null,
  config: KnbaseConfig,
): boolean {
  if (!session) return false;
  if (session.state === "UNINITIALIZED" || session.state === "NEEDS_BOOTSTRAP") {
    return false;
  }
  const ageMs = Date.now() - Date.parse(session.startedAt);
  const ttlMs = config.sessionTtlMinutes * 60_000;
  return ageMs <= ttlMs;
}

/** True when context loaded during the session matches files currently on disk. */
export function contextMatchesDisk(
  session: SessionData | null,
  current: Record<string, string>,
): boolean {
  if (!session) return false;
  for (const [key, sum] of Object.entries(current)) {
    if (session.contextChecksums[key] !== sum) return false;
  }
  return true;
}
