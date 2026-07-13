#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  appendLog,
  getStatus,
  guardDecision,
  hasTaskCompletedSince,
  initProject,
  openProject,
} from "../core/engine.js";
import { renderAgentsDoc } from "../core/agents-doc.js";
import { isInitialized } from "../core/config.js";

const program = new Command();
program
  .name("aimemory")
  .description("Agent-agnostic AI project governance and memory system")
  .version("0.1.0");

/* -------------------------------------------------------------------- init --- */
program
  .command("init")
  .description("Initialize governance in the current project (scaffold docs, index, mind map, AGENTS.md)")
  .option("-d, --docs-dir <dir>", "Directory for governance docs (default: memory-bank)")
  .action((opts: { docsDir?: string }) => {
    const result = initProject(process.cwd(), opts.docsDir);
    const project = openProject(result.root);
    const agentsPath = join(result.root, "AGENTS.md");
    if (!existsSync(agentsPath)) {
      writeFileSync(agentsPath, renderAgentsDoc(project.config), "utf8");
    }
    console.log(`aimemory initialized at ${result.root}`);
    console.log(`  docs dir:    ${project.config.docsDir}/`);
    console.log(`  scaffolded:  ${result.scaffolded.join(", ") || "(none)"}`);
    console.log(`  already set: ${result.alreadyPresent.join(", ") || "(none)"}`);
    console.log(`  AGENTS.md:   ${existsSync(agentsPath) ? "written" : "present"}`);
    console.log("\nNext: agents should call the `start_session` MCP tool, or run `aimemory status`.");
  });

/* ------------------------------------------------------------------ status --- */
program
  .command("status")
  .description("Show governance status (session state, missing files, recent log)")
  .action(() => {
    const status = getStatus(openProject(process.cwd()));
    console.log(JSON.stringify(status, null, 2));
  });

/* ------------------------------------------------------------------- check --- */
program
  .command("check")
  .description("Exit 0 only if initialized, no files missing, and a fresh session exists")
  .action(() => {
    const project = openProject(process.cwd());
    const decision = guardDecision(project);
    console.log(decision.allow ? `OK: ${decision.reason}` : `BLOCKED: ${decision.reason}`);
    process.exit(decision.allow ? 0 : 1);
  });

/* ------------------------------------------------------------------- guard --- */
program
  .command("guard")
  .description("Run a command only if governance context is loaded and current")
  .allowUnknownOption(true)
  .argument("[command...]", "Command to run after `--`")
  .action((command: string[]) => {
    const project = openProject(process.cwd());
    const decision = guardDecision(project);
    if (!decision.allow) {
      if (isInitialized(project.root)) {
        appendLog(project.p, { event: "guard_block", detail: decision.reason });
      }
      console.error(`[aimemory] BLOCKED: ${decision.reason}`);
      process.exit(1);
    }
    if (!command || command.length === 0) {
      console.log(`[aimemory] OK: ${decision.reason} (no command supplied)`);
      return;
    }
    appendLog(project.p, { event: "guard_allow", detail: command.join(" ") });
    const [cmd, ...args] = command;
    const child = spawn(cmd, args, { stdio: "inherit", shell: false });
    child.on("exit", (code) => process.exit(code ?? 0));
    child.on("error", (err) => {
      console.error(`[aimemory] Failed to run command: ${err.message}`);
      process.exit(1);
    });
  });

/* ----------------------------------------------------------- install-hooks --- */
program
  .command("install-hooks")
  .description("Install a git pre-commit hook that enforces governance updates")
  .action(() => {
    const project = openProject(process.cwd());
    const gitDir = join(project.root, ".git");
    if (!existsSync(gitDir)) {
      console.error("[aimemory] Not a git repository (no .git dir). Run `git init` first.");
      process.exit(1);
    }
    const hookPath = join(gitDir, "hooks", "pre-commit");
    const script = `#!/bin/sh
# Installed by aimemory. Blocks commits unless governance is satisfied.
exec npx --no-install aimemory precommit || aimemory precommit
`;
    writeFileSync(hookPath, script, "utf8");
    chmodSync(hookPath, 0o755);
    console.log(`[aimemory] Installed pre-commit hook at ${hookPath}`);
  });

/* --------------------------------------------------------------- precommit --- */
program
  .command("precommit")
  .description("Internal: git pre-commit gate. Exits non-zero to block the commit.")
  .action(() => {
    const project = openProject(process.cwd());
    if (!isInitialized(project.root)) {
      console.error("[aimemory] pre-commit: not initialized. Run `aimemory init`.");
      process.exit(1);
    }
    const status = getStatus(project);
    if (status.missing.length > 0) {
      console.error(
        `[aimemory] pre-commit BLOCKED: governance files missing/empty: ${status.missing.join(", ")}`,
      );
      process.exit(1);
    }
    const lastCommit = spawnSync("git", ["log", "-1", "--format=%cI"], {
      cwd: project.root,
      encoding: "utf8",
    });
    const sinceIso = lastCommit.status === 0 ? lastCommit.stdout.trim() || null : null;
    if (!hasTaskCompletedSince(project.p, sinceIso)) {
      console.error(
        "[aimemory] pre-commit BLOCKED: no task completed since last commit. " +
          "Complete a task (update memory.md) via the MCP `complete_task` tool before committing.",
      );
      process.exit(1);
    }
    console.error("[aimemory] pre-commit OK: governance satisfied.");
    process.exit(0);
  });

/* ------------------------------------------------------------ agents-doc --- */
program
  .command("agents-doc")
  .description("Print the AGENTS.md governance contract for this project")
  .action(() => {
    const project = openProject(process.cwd());
    const path = join(project.root, "AGENTS.md");
    if (existsSync(path)) {
      process.stdout.write(readFileSync(path, "utf8"));
    } else {
      process.stdout.write(renderAgentsDoc(project.config));
    }
  });

program.parseAsync(process.argv);
