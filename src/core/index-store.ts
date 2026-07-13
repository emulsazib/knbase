import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import {
  GOVERNANCE_FILES,
  type KnbaseConfig,
  type FileIndexEntry,
  type GovernanceFileKey,
  type IndexData,
} from "../types.js";
import { ensureDir, paths, type ResolvedPaths } from "./config.js";
import { readDoc } from "./files.js";

const INDEX_VERSION = 1;

function emptyEntry(key: GovernanceFileKey, path: string): FileIndexEntry {
  return {
    key,
    path,
    exists: false,
    checksum: "",
    bytes: 0,
    summary: "",
    headings: [],
    updatedAt: null,
  };
}

export function loadIndex(p: ResolvedPaths, config: KnbaseConfig): IndexData {
  let data: IndexData | null = null;
  if (existsSync(p.indexPath)) {
    try {
      data = JSON.parse(readFileSync(p.indexPath, "utf8")) as IndexData;
    } catch {
      data = null;
    }
  }
  const files = {} as Record<GovernanceFileKey, FileIndexEntry>;
  for (const key of config.files) {
    const rel = relative(p.root, p.docPath(key));
    files[key] = data?.files?.[key] ?? emptyEntry(key, rel);
    files[key].path = rel;
  }
  return {
    version: INDEX_VERSION,
    updatedAt: data?.updatedAt ?? new Date().toISOString(),
    files,
  };
}

export function saveIndex(p: ResolvedPaths, index: IndexData): void {
  ensureDir(p.systemDir);
  index.updatedAt = new Date().toISOString();
  writeFileSync(p.indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

/**
 * Re-scans all governance docs from disk and refreshes their checksum/heading/
 * exists metadata. Preserves agent-supplied summaries unless the file changed
 * and a new summary is provided elsewhere. Returns the refreshed index.
 */
export function refreshIndex(
  p: ResolvedPaths,
  config: KnbaseConfig,
  existing?: IndexData,
): IndexData {
  const index = existing ?? loadIndex(p, config);
  for (const key of config.files) {
    const state = readDoc(p.docPath(key));
    const entry = index.files[key];
    const changed = entry.checksum !== state.checksum;
    entry.exists = state.exists && !state.isEmpty;
    entry.checksum = state.checksum;
    entry.bytes = state.bytes;
    entry.headings = state.headings;
    if (changed && state.exists) {
      entry.updatedAt = new Date().toISOString();
    }
  }
  return index;
}

/** Update a single entry after an authored write, recording the agent summary. */
export function recordWrite(
  index: IndexData,
  key: GovernanceFileKey,
  checksum: string,
  bytes: number,
  headings: string[],
  summary: string,
): void {
  const entry = index.files[key];
  entry.exists = true;
  entry.checksum = checksum;
  entry.bytes = bytes;
  entry.headings = headings;
  if (summary.trim()) entry.summary = summary.trim();
  entry.updatedAt = new Date().toISOString();
}

/** Governance keys whose file is missing or still a placeholder. */
export function missingFiles(
  p: ResolvedPaths,
  config: KnbaseConfig,
): GovernanceFileKey[] {
  const out: GovernanceFileKey[] = [];
  for (const key of config.files) {
    const state = readDoc(p.docPath(key));
    if (!state.exists || state.isEmpty) out.push(key);
  }
  return out;
}

/** Current checksum map keyed by governance file key. */
export function currentChecksums(
  p: ResolvedPaths,
  config: KnbaseConfig,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of config.files) {
    map[key] = readDoc(p.docPath(key)).checksum;
  }
  return map;
}

export { GOVERNANCE_FILES, paths };
