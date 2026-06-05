import type {
  JobMetrics,
  TaskSpec,
  WorkerJob,
  WorkerResult
} from "../../../packages/schemas/src/index.js";
import {
  costForUsage,
  extractJson,
  fromEnv,
  type ChatMessage,
  type ChatUsage,
  type LlmClient
} from "../../../packages/llm/src/index.js";
import { renderPrompt, skillsForLane } from "../../../packages/prompts/src/index.js";
import { getLaneConfig } from "./lanes.js";

export interface PendingArtifact {
  taskId: string;
  path: string;
  content: string;
}

export interface WorkerOutput {
  result: WorkerResult;
  pendingArtifacts: PendingArtifact[];
}

interface WorkerLlmShape {
  summary: string;
  files?: Array<{ path: string; content: string }>;
}

/** Output of a completed upstream task, handed to dependents as context. */
export interface UpstreamOutput {
  taskId: string;
  title: string;
  lane: string;
  summary: string;
  files: Array<{ path: string; content: string }>;
}

/** Reviewer feedback from a prior rejected attempt, fed back on retry. */
export interface RetryFeedback {
  notes: string[];
  previousSummary: string;
}

const ARTIFACTS_ENABLED = (process.env.WORKER_EMIT_ARTIFACTS ?? "true") !== "false";
const MAX_FILES_PER_TASK = Number(process.env.WORKER_MAX_FILES ?? "5");
const MAX_FILE_BYTES = Number(process.env.WORKER_MAX_FILE_BYTES ?? "8192");
const MAX_UPSTREAM_TASKS = Number(process.env.WORKER_MAX_UPSTREAM ?? "6");
const MAX_UPSTREAM_FILES = Number(process.env.WORKER_MAX_UPSTREAM_FILES ?? "3");
const MAX_UPSTREAM_FILE_BYTES = Number(process.env.WORKER_MAX_UPSTREAM_FILE_BYTES ?? "1400");

export { getLaneConfig, listLaneConfigs, type LaneWorkerConfig } from "./lanes.js";

const COST_PER_1K_TOKENS_USD = Number(process.env.MIMO_COST_PER_1K ?? "0.0008");
const BASE_TOKENS_PER_TASK = 250;
const TOKENS_PER_OUTPUT = 180;
const TOKENS_PER_DEPENDENCY = 60;
const BASE_DURATION_MS = 120;
const DURATION_MS_PER_OUTPUT = 40;

interface RunContext {
  idea: string;
  upstream?: UpstreamOutput[];
  feedback?: RetryFeedback;
}

export class WorkerExecutor {
  constructor(
    private readonly llm: LlmClient | null = fromEnv(),
    private readonly model = process.env.MIMO_WORKER_MODEL ?? "mimo-v2.5"
  ) {}

  async run(job: WorkerJob, task: TaskSpec, ctx: RunContext): Promise<WorkerOutput> {
    if (this.llm) {
      try {
        return await this.runWithLlm(job, task, ctx);
      } catch (err) {
        console.error("[worker] LLM execution failed, using stub:", err instanceof Error ? err.message : err);
      }
    }
    return this.stubRun(job, task);
  }

  private async runWithLlm(job: WorkerJob, task: TaskSpec, ctx: RunContext): Promise<WorkerOutput> {
    const lane = getLaneConfig(task.lane);
    const skill = skillsForLane(task.lane)[0];
    const skillPrompt = skill ? renderPrompt(skill, { idea: ctx.idea }) : "";
    const acceptance = task.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac.description}`).join("\n");
    const model = lane.modelOverride ?? job.route.modelId ?? this.model;
    const declared = task.outputs.slice(0, MAX_FILES_PER_TASK);

    const systemPrompt = ARTIFACTS_ENABLED
      ? `${lane.persona}\n\n${lane.outputDirective}\n\nAdditionally, emit real implementation content for the declared output files (TypeScript / Python / YAML / Markdown / SQL as appropriate). Each file's content must be a realistic, runnable starting point ≤ ${MAX_FILE_BYTES} bytes — no placeholders or "TODO" stubs. Cover at most ${MAX_FILES_PER_TASK} files. Respond ONLY as JSON:\n{"summary": "the brief", "files": [{"path": "src/foo.ts", "content": "actual code/text…"}]}\nIf a declared output is not produceable at this layer (e.g. binary), omit it from files but keep the path in summary.`
      : `${lane.persona}\n\n${lane.outputDirective}\nNo prose preamble. No markdown code fences.`;

    const upstreamBlock = buildUpstreamBlock(ctx.upstream);
    const feedbackBlock = buildFeedbackBlock(ctx.feedback);

    const userPrompt = `Idea: ${ctx.idea}
Task: ${task.title}
Objective: ${task.objective}
Acceptance criteria:
${acceptance}
${declared.length ? `\nDeclared output paths (target file list):\n${declared.map((p) => `- ${p}`).join("\n")}` : ""}
${skillPrompt ? `\nSkill guidance:\n${skillPrompt}` : ""}${upstreamBlock}${feedbackBlock}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const result = await this.llm!.chat(messages, {
      model,
      temperature: lane.temperature,
      maxTokens: lane.maxTokens,
      jsonMode: ARTIFACTS_ENABLED
    });

    let summary = result.content.trim();
    let pendingArtifacts: PendingArtifact[] = [];

    if (ARTIFACTS_ENABLED) {
      try {
        const parsed = extractJson<WorkerLlmShape>(result.content);
        summary = (parsed.summary ?? summary).trim();
        pendingArtifacts = (parsed.files ?? [])
          .slice(0, MAX_FILES_PER_TASK)
          .map((f) => ({
            taskId: task.id,
            path: f.path,
            content: typeof f.content === "string" ? f.content.slice(0, MAX_FILE_BYTES) : ""
          }))
          .filter((a) => isSafePath(a.path) && a.content.length > 0);
      } catch (err) {
        const fallback = extractSummaryFromTruncated(result.content);
        if (fallback) {
          summary = fallback;
        } else {
          console.error(
            "[worker] failed to parse JSON files block:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    const metrics = metricsFromUsage(model, result.usage, result.durationMs);
    const workerResult: WorkerResult = {
      jobId: job.id,
      taskId: task.id,
      lane: task.lane,
      status: "done",
      summary: summary || `Completed ${task.title}`,
      producedFiles: task.outputs,
      metrics
    };
    return { result: workerResult, pendingArtifacts };
  }

  private stubRun(job: WorkerJob, task: TaskSpec): WorkerOutput {
    const result: WorkerResult = {
      jobId: job.id,
      taskId: task.id,
      lane: task.lane,
      status: "done",
      summary: `Completed ${task.title} for lane ${task.lane}`,
      producedFiles: task.outputs,
      metrics: estimateMetrics(task)
    };
    return { result, pendingArtifacts: [] };
  }
}

function buildUpstreamBlock(upstream: UpstreamOutput[] | undefined): string {
  if (!upstream || upstream.length === 0) return "";
  const items = upstream.slice(0, MAX_UPSTREAM_TASKS).map((u) => {
    const files = u.files
      .slice(0, MAX_UPSTREAM_FILES)
      .map((f) => `  • ${f.path}\n\`\`\`\n${f.content.slice(0, MAX_UPSTREAM_FILE_BYTES)}\n\`\`\``)
      .join("\n");
    return `### ${u.taskId} — ${u.title} (${u.lane})\n${u.summary}${files ? `\nFiles:\n${files}` : ""}`;
  });
  return `\n\n## Upstream context — already produced by earlier agents in this run. Build ON these (import them, match their names/types); do NOT re-implement them:\n${items.join("\n\n")}`;
}

function buildFeedbackBlock(feedback: RetryFeedback | undefined): string {
  if (!feedback || feedback.notes.length === 0) return "";
  const notes = feedback.notes.map((n) => `- ${n}`).join("\n");
  return `\n\n## Previous attempt was REJECTED by review. Address every note precisely and do not repeat the same gaps:\n${notes}\n\nPrevious summary (for reference):\n${feedback.previousSummary.slice(0, 600)}`;
}

function extractSummaryFromTruncated(content: string): string | null {
  const match = content.match(/"summary"\s*:\s*"([\s\S]*?)"\s*,\s*"files"/);
  if (!match) return null;
  return match[1]!.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
}

const TRAVERSAL_RE = /(^|\/)\.\.(\/|$)/;
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 32) return true;
  return false;
}
function isSafePathInternal(p: string): boolean {
  if (typeof p !== "string" || p.length === 0 || p.length > 256) return false;
  if (p.startsWith("/") || p.startsWith("\\")) return false;
  if (/[A-Za-z]:[\\/]/.test(p)) return false;
  if (TRAVERSAL_RE.test(p.replace(/\\/g, "/"))) return false;
  return true;
}

function isSafePath(p: string): boolean {
  return isSafePathInternal(p) && !hasControlChar(p);
}

export { isSafePath };

function estimateMetrics(task: TaskSpec): JobMetrics {
  const tokensUsed =
    BASE_TOKENS_PER_TASK +
    TOKENS_PER_OUTPUT * task.outputs.length +
    TOKENS_PER_DEPENDENCY * task.dependencies.length;
  const costUsd = Number(((tokensUsed / 1000) * COST_PER_1K_TOKENS_USD).toFixed(6));
  const durationMs = BASE_DURATION_MS + DURATION_MS_PER_OUTPUT * task.outputs.length;
  return { tokensUsed, costUsd, durationMs };
}

function metricsFromUsage(modelId: string, usage: ChatUsage, durationMs: number): JobMetrics {
  const fromCatalog = costForUsage(modelId, usage.totalTokens);
  const costUsd =
    fromCatalog > 0
      ? fromCatalog
      : Number(((usage.totalTokens / 1000) * COST_PER_1K_TOKENS_USD).toFixed(6));
  return { tokensUsed: usage.totalTokens, costUsd, durationMs };
}
