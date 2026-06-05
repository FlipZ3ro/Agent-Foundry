import type { ReviewDecision, TaskSpec, WorkerResult } from "../../../packages/schemas/src/index.js";
import {
  extractJson,
  fromEnv,
  type ChatMessage,
  type LlmClient
} from "../../../packages/llm/src/index.js";

interface ReviewLlmResponse {
  status: "approved" | "changes_requested";
  notes: string[];
}

export class Reviewer {
  constructor(
    private readonly llm: LlmClient | null = fromEnv(),
    private readonly model = process.env.MIMO_REVIEWER_MODEL ?? "mimo-v2.5-pro"
  ) {}

  async review(result: WorkerResult, task?: TaskSpec): Promise<ReviewDecision> {
    if (this.llm && task) {
      try {
        return await this.reviewWithLlm(result, task);
      } catch (err) {
        console.error("[reviewer] LLM review failed, using stub:", err instanceof Error ? err.message : err);
      }
    }
    return this.stubReview(result);
  }

  private async reviewWithLlm(result: WorkerResult, task: TaskSpec): Promise<ReviewDecision> {
    const acceptance = task.acceptanceCriteria
      .map((ac, i) => `${i + 1}. ${ac.description}`)
      .join("\n");

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a Reviewer. Judge worker output against acceptance criteria. Respond ONLY as JSON:
{"status": "approved" | "changes_requested", "notes": ["short, actionable note", "..."]}
Approve only if every criterion is plausibly met. Keep notes concise (≤ 1 sentence each, 1-3 notes).`
      },
      {
        role: "user",
        content: `Task: ${task.title}
Objective: ${task.objective}
Acceptance criteria:
${acceptance}
Declared outputs: ${task.outputs.join(", ") || "(none)"}

Worker summary:
${result.summary}

Worker produced files: ${result.producedFiles.join(", ") || "(none)"}`
      }
    ];

    const chat = await this.llm!.chat(messages, {
      model: this.model,
      temperature: 0.2,
      maxTokens: 400,
      jsonMode: true
    });

    const parsed = extractJson<ReviewLlmResponse>(chat.content);
    const status: ReviewDecision["status"] =
      parsed.status === "approved" ? "approved" : "changes_requested";
    const notes = Array.isArray(parsed.notes) && parsed.notes.length > 0 ? parsed.notes : ["No notes returned"];
    return { taskId: result.taskId, status, notes };
  }

  private stubReview(result: WorkerResult): ReviewDecision {
    const notes = result.producedFiles.length
      ? ["Outputs declared", "Ready for merge queue"]
      : ["No produced files listed"];
    return {
      taskId: result.taskId,
      status: result.producedFiles.length ? "approved" : "changes_requested",
      notes
    };
  }
}
