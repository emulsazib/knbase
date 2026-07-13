import type { GovernanceFileKey } from "../types.js";

export interface TemplateDef {
  key: GovernanceFileKey;
  title: string;
  /** One-line description of the file's purpose. */
  purpose: string;
  /**
   * Required H2 (##) section headings. Bootstrap templates include them, and
   * `write_governance_file` validates that these are present.
   */
  requiredSections: string[];
  /** Full markdown scaffold written when the file is missing. */
  scaffold: string;
}

function scaffoldFrom(
  title: string,
  purpose: string,
  sections: { heading: string; hint: string }[],
): string {
  const body = sections
    .map((s) => `## ${s.heading}\n\n> ${s.hint}\n`)
    .join("\n");
  return `# ${title}\n\n<!-- ${purpose} -->\n<!-- Managed by knbase. Replace the guidance blockquotes with real content. -->\n\n${body}`;
}

export const TEMPLATES: Record<GovernanceFileKey, TemplateDef> = {
  prd: {
    key: "prd",
    title: "Product Requirements (PRD)",
    purpose: "What we are building and why. The single source of product truth.",
    requiredSections: [
      "Problem",
      "Goals",
      "Users & Personas",
      "Functional Requirements",
      "Non-Goals",
      "Success Metrics",
    ],
    scaffold: scaffoldFrom(
      "Product Requirements (PRD)",
      "What we are building and why.",
      [
        { heading: "Problem", hint: "What problem does this solve? For whom?" },
        { heading: "Goals", hint: "The concrete outcomes this project must achieve." },
        { heading: "Users & Personas", hint: "Who uses this and what they need." },
        {
          heading: "Functional Requirements",
          hint: "Numbered list of what the system must do.",
        },
        { heading: "Non-Goals", hint: "Explicitly out of scope, to prevent drift." },
        { heading: "Success Metrics", hint: "How we measure that it works." },
      ],
    ),
  },
  architecture: {
    key: "architecture",
    title: "Architecture",
    purpose: "High-level system structure, components, and data flow.",
    requiredSections: [
      "Overview",
      "Components",
      "Data Flow",
      "Tech Stack",
      "External Dependencies",
    ],
    scaffold: scaffoldFrom(
      "Architecture",
      "High-level system structure and data flow.",
      [
        { heading: "Overview", hint: "A paragraph describing the system shape." },
        {
          heading: "Components",
          hint: "Each major component, its responsibility, and its location in the repo.",
        },
        { heading: "Data Flow", hint: "How data/requests move through components." },
        { heading: "Tech Stack", hint: "Languages, frameworks, runtimes, databases." },
        {
          heading: "External Dependencies",
          hint: "Third-party services, APIs, and libraries with a role.",
        },
      ],
    ),
  },
  design: {
    key: "design",
    title: "Design",
    purpose: "Detailed design decisions, interfaces, and conventions.",
    requiredSections: [
      "Modules & Interfaces",
      "Key Decisions",
      "Data Models",
      "Conventions",
      "Open Questions",
    ],
    scaffold: scaffoldFrom(
      "Design",
      "Detailed design decisions and interfaces.",
      [
        {
          heading: "Modules & Interfaces",
          hint: "Public APIs, function/class signatures, and contracts between modules.",
        },
        {
          heading: "Key Decisions",
          hint: "Decisions taken and the rationale/trade-offs (ADR-style).",
        },
        { heading: "Data Models", hint: "Schemas, types, and their relationships." },
        {
          heading: "Conventions",
          hint: "Naming, error handling, folder layout, and style rules.",
        },
        { heading: "Open Questions", hint: "Unresolved design questions to revisit." },
      ],
    ),
  },
  phase: {
    key: "phase",
    title: "Phases & Roadmap",
    purpose: "Where the project is now and what comes next.",
    requiredSections: [
      "Current Phase",
      "Completed",
      "In Progress",
      "Next Up",
      "Backlog",
    ],
    scaffold: scaffoldFrom(
      "Phases & Roadmap",
      "Where the project is now and what comes next.",
      [
        {
          heading: "Current Phase",
          hint: "Name and one-line status of the phase currently in flight.",
        },
        { heading: "Completed", hint: "Checklist of finished milestones." },
        { heading: "In Progress", hint: "What is actively being worked on." },
        { heading: "Next Up", hint: "The next 1-3 items to pick up." },
        { heading: "Backlog", hint: "Everything else, unordered." },
      ],
    ),
  },
  rules: {
    key: "rules",
    title: "Rules & Constraints",
    purpose: "Hard rules every agent must obey when working in this project.",
    requiredSections: [
      "Must Do",
      "Must Not Do",
      "Coding Standards",
      "Guardrails",
    ],
    scaffold: scaffoldFrom(
      "Rules & Constraints",
      "Hard rules every agent must obey.",
      [
        { heading: "Must Do", hint: "Non-negotiable practices (tests, reviews, etc.)." },
        {
          heading: "Must Not Do",
          hint: "Forbidden actions (e.g. never touch prod secrets).",
        },
        {
          heading: "Coding Standards",
          hint: "Language/style rules specific to this project.",
        },
        {
          heading: "Guardrails",
          hint: "Safety limits: files that are off-limits, destructive ops to avoid.",
        },
      ],
    ),
  },
  memory: {
    key: "memory",
    title: "Project Memory",
    purpose:
      "Running knowledge base updated after every task so future agents can extend the project.",
    requiredSections: [
      "Summary",
      "Recent Changes",
      "Learnings & Gotchas",
      "Known Issues",
    ],
    scaffold: scaffoldFrom(
      "Project Memory",
      "Running knowledge base updated after every task.",
      [
        {
          heading: "Summary",
          hint: "Current state of the project in a few sentences.",
        },
        {
          heading: "Recent Changes",
          hint: "Reverse-chronological log of notable changes (append after each task).",
        },
        {
          heading: "Learnings & Gotchas",
          hint: "Things discovered that future agents must know.",
        },
        { heading: "Known Issues", hint: "Bugs, tech debt, and workarounds." },
      ],
    ),
  },
};

export function templateFor(key: GovernanceFileKey): TemplateDef {
  return TEMPLATES[key];
}
