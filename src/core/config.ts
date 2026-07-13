import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  GOVERNANCE_FILES,
  type KnbaseConfig,
  type GovernanceFileKey,
} from "../types.js";

/** Name of the system artifact directory. */
export const SYSTEM_DIR = ".knbase";
/** Default directory (relative to project root) for the governance docs. */
export const DEFAULT_DOCS_DIR = "memory-bank";

const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG: KnbaseConfig = {
  version: CONFIG_VERSION,
  docsDir: DEFAULT_DOCS_DIR,
  files: [...GOVERNANCE_FILES],
  sessionTtlMinutes: 120,
};

/**
 * Resolves the project root. Honors the KNBASE_ROOT env var, otherwise walks
 * up from `startDir` looking for an existing `.knbase` dir or a `.git` dir,
 * falling back to `startDir` itself.
 */
export function resolveProjectRoot(startDir: string = process.cwd()): string {
  const envRoot = process.env.KNBASE_ROOT;
  if (envRoot && envRoot.trim()) {
    return resolve(envRoot.trim());
  }

  let current = resolve(startDir);
  // Walk upward until filesystem root.
  // Prefer an existing .knbase dir; otherwise use the nearest .git.
  let gitFallback: string | null = null;
  while (true) {
    if (existsSync(join(current, SYSTEM_DIR))) return current;
    if (!gitFallback && existsSync(join(current, ".git"))) gitFallback = current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return gitFallback ?? resolve(startDir);
}

export interface ResolvedPaths {
  root: string;
  systemDir: string;
  configPath: string;
  indexPath: string;
  mindmapPath: string;
  logPath: string;
  sessionPath: string;
  docsDir: string;
  /** Absolute path for a given governance file key. */
  docPath: (key: GovernanceFileKey) => string;
}

export function paths(root: string, config: KnbaseConfig): ResolvedPaths {
  const systemDir = join(root, SYSTEM_DIR);
  const docsDir = isAbsolute(config.docsDir)
    ? config.docsDir
    : join(root, config.docsDir);
  return {
    root,
    systemDir,
    configPath: join(systemDir, "config.json"),
    indexPath: join(systemDir, "index.json"),
    mindmapPath: join(systemDir, "mindmap.md"),
    logPath: join(systemDir, "activity.log"),
    sessionPath: join(systemDir, "session.json"),
    docsDir,
    docPath: (key: GovernanceFileKey) => join(docsDir, `${key}.md`),
  };
}

export function loadConfig(root: string): KnbaseConfig {
  const configPath = join(root, SYSTEM_DIR, "config.json");
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<KnbaseConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      files:
        Array.isArray(raw.files) && raw.files.length > 0
          ? (raw.files as GovernanceFileKey[])
          : DEFAULT_CONFIG.files,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(root: string, config: KnbaseConfig): void {
  const configPath = join(root, SYSTEM_DIR, "config.json");
  ensureDir(dirname(configPath));
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Whether knbase has been initialized in the given root. */
export function isInitialized(root: string): boolean {
  return existsSync(join(root, SYSTEM_DIR, "config.json"));
}
