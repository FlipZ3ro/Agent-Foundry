import type { Lane } from "../../../packages/schemas/src/index.js";

export interface LaneWorkerConfig {
  lane: Lane | "default";
  /** Persona/system prompt prefix that gives the worker a lane-specific personality. */
  persona: string;
  /** Format directive describing the expected output shape for this lane. */
  outputDirective: string;
  /** Temperature suited for the lane (lower for contracts, higher for creative). */
  temperature: number;
  /** Max tokens budget per task. */
  maxTokens: number;
  /** Optional model id override. Otherwise the route.modelId from Router is used. */
  modelOverride?: string;
}

const DEFAULT_CONFIG: LaneWorkerConfig = {
  lane: "default",
  persona:
    "You are a generalist Worker. Stay factual, concrete, and avoid filler.",
  outputDirective: "Write 2-4 sentences describing what was done and how.",
  temperature: 0.5,
  maxTokens: 1000
};

const LANE_CONFIGS: LaneWorkerConfig[] = [
  {
    lane: "frontend",
    persona:
      "You are the Frontend Worker. Think in components, state shape, props, and user flows. Favor minimal, idiomatic React + TypeScript patterns.",
    outputDirective:
      "Reply with a tight 3-5 sentence brief covering: (1) component tree, (2) key state and props, (3) interaction flow, (4) any styling/UX notes worth flagging. No code blocks.",
    temperature: 0.55,
    maxTokens: 4000
  },
  {
    lane: "backend",
    persona:
      "You are the Backend Worker. Think in API contracts, request/response schemas, persistence boundaries, and failure modes.",
    outputDirective:
      "Reply with a tight brief covering: (1) endpoint contract (method + path + body shape), (2) data model touched, (3) error/validation strategy, (4) one observability hook. Be precise. No code blocks.",
    temperature: 0.35,
    maxTokens: 5000
  },
  {
    lane: "data",
    persona:
      "You are the Data Worker. Think in sources, schemas, transformations, freshness, and query patterns.",
    outputDirective:
      "Reply with a brief covering: (1) data sources, (2) schema/columns and keys, (3) ingestion/refresh cadence, (4) one quality check. Stay concrete. No code blocks.",
    temperature: 0.4,
    maxTokens: 4500
  },
  {
    lane: "assets",
    persona:
      "You are the Assets Worker. Think in file structure, export formats, and template surfaces (PDF, PPT, XLSX, images).",
    outputDirective:
      "Reply with a brief covering: (1) asset surfaces produced, (2) directory layout, (3) format/template choices, (4) one rendering or accessibility note.",
    temperature: 0.5,
    maxTokens: 3500
  },
  {
    lane: "review",
    persona:
      "You are the Review Worker. Think in test plans, edge cases, regressions, and acceptance evidence.",
    outputDirective:
      "Reply with a brief covering: (1) what was tested, (2) edge cases covered, (3) tooling used (e.g., node:test, Playwright), (4) one risk still open. No code blocks.",
    temperature: 0.3,
    maxTokens: 5000
  },
  {
    lane: "planner",
    persona:
      "You are the Planner Worker (meta-tasks). Focus on coordination outcomes, sequencing decisions, and dependency clarification.",
    outputDirective:
      "Reply with a brief covering: (1) decision made, (2) impacted downstream tasks, (3) open question worth surfacing.",
    temperature: 0.4,
    maxTokens: 2500
  },
  {
    lane: "router",
    persona:
      "You are the Router Worker (meta-tasks). Focus on routing rationale, model selection trade-offs, and queue prioritization.",
    outputDirective:
      "Reply with a brief covering: (1) routing choice and why, (2) model tier rationale, (3) any rerouting risk.",
    temperature: 0.35,
    maxTokens: 2000
  }
];

const REGISTRY = new Map<Lane | "default", LaneWorkerConfig>(
  [DEFAULT_CONFIG, ...LANE_CONFIGS].map((cfg) => [cfg.lane, cfg])
);

export function getLaneConfig(lane: Lane): LaneWorkerConfig {
  return REGISTRY.get(lane) ?? DEFAULT_CONFIG;
}

export function listLaneConfigs(): LaneWorkerConfig[] {
  return Array.from(REGISTRY.values());
}
