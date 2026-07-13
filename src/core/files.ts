import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureDir } from "./config.js";

/** SHA-256 of a string. */
export function checksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export interface DocFileState {
  exists: boolean;
  content: string;
  checksum: string;
  bytes: number;
  /** True when the file is missing or contains only whitespace/template guidance. */
  isEmpty: boolean;
  headings: string[];
}

/** Reads a doc from disk and computes its derived state. */
export function readDoc(absPath: string): DocFileState {
  if (!existsSync(absPath)) {
    return {
      exists: false,
      content: "",
      checksum: "",
      bytes: 0,
      isEmpty: true,
      headings: [],
    };
  }
  const content = readFileSync(absPath, "utf8");
  return {
    exists: true,
    content,
    checksum: checksum(content),
    bytes: Buffer.byteLength(content, "utf8"),
    isEmpty: isPlaceholderContent(content),
    headings: extractHeadings(content),
  };
}

export function writeDoc(absPath: string, content: string): void {
  ensureDir(dirname(absPath));
  const normalized = content.endsWith("\n") ? content : content + "\n";
  writeFileSync(absPath, normalized, "utf8");
}

/** Extract H2 (##) section headings, ignoring the H1 title and deeper levels. */
export function extractHeadings(content: string): string[] {
  const out: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

/**
 * Content is considered a "placeholder" (i.e. not yet authored) when every
 * non-heading, non-comment line is empty or a guidance blockquote (`> ...`).
 */
export function isPlaceholderContent(content: string): boolean {
  const meaningful = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith("#")) // headings
    .filter((l) => !l.startsWith("<!--")) // html comments
    .filter((l) => !l.startsWith("-->"))
    .filter((l) => !l.startsWith(">")); // guidance blockquotes
  return meaningful.length === 0;
}

/** Returns the required sections that are missing from the given content. */
export function missingSections(content: string, required: string[]): string[] {
  const present = new Set(extractHeadings(content).map((h) => h.toLowerCase()));
  return required.filter((r) => !present.has(r.toLowerCase()));
}
