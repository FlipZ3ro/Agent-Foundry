import type { ExecutionMode, Lane } from "../../schemas/src/index.js";

export interface Skill {
  id: string;
  lane: Lane;
  description: string;
  promptTemplate: string;
  expectedOutputs: string[];
  preferredMode: ExecutionMode;
}

export const skillRegistry: Skill[] = [
  {
    id: "frontend-shell",
    lane: "frontend",
    description: "Define application shell, navigation, and routing skeleton",
    promptTemplate:
      "Build the dashboard shell for: {{idea}}. Produce a navigation layout and page scaffolding.",
    expectedOutputs: ["apps/dashboard/src/page.tsx"],
    preferredMode: "execution"
  },
  {
    id: "backend-contracts",
    lane: "backend",
    description: "Document queue, routing, and job state contracts",
    promptTemplate:
      "Design the orchestration contracts for: {{idea}}. Cover task, job, routing decision, and review shapes.",
    expectedOutputs: ["packages/schemas/src/index.ts"],
    preferredMode: "hybrid"
  },
  {
    id: "assets-exports",
    lane: "assets",
    description: "Describe export surfaces for PDF, PPT, and Excel",
    promptTemplate:
      "Specify export surfaces (PDF/PPT/XLSX) for: {{idea}} including templates and rendering pipeline.",
    expectedOutputs: ["docs/examples/task-flow.md"],
    preferredMode: "reasoning"
  },
  {
    id: "review-rubric",
    lane: "review",
    description: "Apply acceptance rubric to a worker result",
    promptTemplate:
      "Review the worker result against acceptance criteria. Approve or request changes with notes.",
    expectedOutputs: [],
    preferredMode: "reasoning"
  }
];

export function findSkill(id: string): Skill | undefined {
  return skillRegistry.find((skill) => skill.id === id);
}

export function skillsForLane(lane: Lane): Skill[] {
  return skillRegistry.filter((skill) => skill.lane === lane);
}

export function renderPrompt(skill: Skill, vars: Record<string, string>): string {
  return skill.promptTemplate.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match
  );
}
