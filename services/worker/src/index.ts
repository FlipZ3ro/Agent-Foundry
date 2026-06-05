import type {
  JobMetrics,
  TaskSpec,
  WorkerJob,
  WorkerResult
} from "../../../packages/schemas/src/index.js";
import {
  fromEnv,
  type ChatMessage,
  type ChatUsage,
  type LlmClient
} from "../../../packages/llm/src/index.js";
import { renderPrompt, skillsForLane } from "../../../packages/prompts/src/index.js";

const COST_PER_1K_TOKENS_USD = Number(process.env.MIMO_COST_PER_1K ?? "0.0008");
const BASE_TOKENS_PER_TASK = 250;
const TOKENS_PER_OUTPUT = 180;
const TOKENS_PER_DEPENDENCY = 60;
const BASE_DURATION_MS = 120;
const DURATION_MS_PER_OUTPUT = 40;

interface RunContext {
  idea: string;
}

export class WorkerExecutor {
  constructor(
    private readonly llm: LlmClient | null = fromEnv(),
    private readonly model = process.env.MIMO_WORKER_MODEL ?? "mimo-v2.5"
  ) {}

  async run(job: WorkerJob, task: TaskSpec, ctx: RunContext): Promise<WorkerResult> {
    if (this.llm) {
      try {
        return await this.runWithLlm(job, task, ctx);
      } catch (err) {
        console.error("[worker] LLM execution failed, using stub:", err instanceof Error ? err.message : err);
      }
    }
    return this.stubRun(job, task);
  }

  private async runWithLlm(job: WorkerJob, task: TaskSpec, ctx: RunContext): Promise<WorkerResult> {
    const skill = skillsForLane(task.lane)[0];
    const skillPrompt = skill ? renderPrompt(skill, { idea: ctx.idea }) : "";
    const acceptance = task.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac.description}`).join("\n");

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a Worker in the ${task.lane} lane. Produce a concise execution summary (2-4 sentences) for the given task. Stay factual and concrete. No prose preamble.`
      },
      {
        role: "user",
        content: `Idea: ${ctx.idea}
Task: ${task.title}
Objective: ${task.objective}
Acceptance criteria:
${acceptance}
${skillPrompt ? `\nSkill guidance:\n${skillPrompt}` : ""}

Write only the execution summary.`
      }
    ];

    const result = await this.llm!.chat(messages, {
      model: this.model,
      temperature: 0.5,
      maxTokens: 400
    });

    const metrics = metricsFromUsage(result.usage, result.durationMs);
    return {
      jobId: job.id,
      taskId: task.id,
      lane: task.lane,
      status: "done",
      summary: result.content.trim() || `Completed ${task.title}`,
      producedFiles: task.outputs,
      metrics
    };
  }

  private stubRun(job: WorkerJob, task: TaskSpec): WorkerResult {
    return {
      jobId: job.id,
      taskId: task.id,
      lane: task.lane,
      status: "done",
      summary: `Completed ${task.title} for lane ${task.lane}`,
      producedFiles: task.outputs,
      metrics: estimateMetrics(task)
    };
  }
}

function estimateMetrics(task: TaskSpec): JobMetrics {
  const tokensUsed =
    BASE_TOKENS_PER_TASK +
    TOKENS_PER_OUTPUT * task.outputs.length +
    TOKENS_PER_DEPENDENCY * task.dependencies.length;
  const costUsd = Number(((tokensUsed / 1000) * COST_PER_1K_TOKENS_USD).toFixed(6));
  const durationMs = BASE_DURATION_MS + DURATION_MS_PER_OUTPUT * task.outputs.length;
  return { tokensUsed, costUsd, durationMs };
}

function metricsFromUsage(usage: ChatUsage, durationMs: number): JobMetrics {
  const costUsd = Number(((usage.totalTokens / 1000) * COST_PER_1K_TOKENS_USD).toFixed(6));
  return { tokensUsed: usage.totalTokens, costUsd, durationMs };
}
