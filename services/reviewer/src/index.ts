import type {
  CriterionScore,
  ReviewDecision,
  TaskSpec,
  WorkerResult
} from "../../../packages/schemas/src/index.js";
import {
  extractJson,
  fromEnv,
  type ChatMessage,
  type LlmClient
} from "../../../packages/llm/src/index.js";

interface ReviewLlmResponse {
  notes: string[];
  scores: Array<{ criterionId: string; score: number; rationale: string }>;
}

const APPROVE_THRESHOLD = 3.5;

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
    return this.stubReview(result, task);
  }

  private async reviewWithLlm(result: WorkerResult, task: TaskSpec): Promise<ReviewDecision> {
    const criteriaList = task.acceptanceCriteria
      .map((ac) => `- id: ${ac.id} | weight: ${ac.weight ?? 1} | ${ac.description}`)
      .join("\n");

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a Reviewer. Score the worker's output against each acceptance criterion on a 0–5 scale.
0 = not addressed, 3 = partially met, 5 = fully met with evidence.
Respond ONLY as JSON:
{
  "notes": ["short, actionable note", "..."],
  "scores": [{"criterionId": "ac-1-1", "score": 0-5, "rationale": "≤ 1 sentence"}]
}
Include one score per criterion. Notes summarize the gaps (1-3 items).`
      },
      {
        role: "user",
        content: `Task: ${task.title}
Objective: ${task.objective}

Acceptance criteria:
${criteriaList}

Declared outputs: ${task.outputs.join(", ") || "(none)"}

Worker summary:
${result.summary}

Worker produced files: ${result.producedFiles.join(", ") || "(none)"}`
      }
    ];

    const chat = await this.llm!.chat(messages, {
      model: this.model,
      temperature: 0.2,
      maxTokens: 800,
      jsonMode: true
    });

    const parsed = extractJson<ReviewLlmResponse>(chat.content);
    const scores = normalizeScores(parsed.scores ?? [], task);
    const overallScore = weightedAverage(scores, task);
    const status: ReviewDecision["status"] = overallScore >= APPROVE_THRESHOLD ? "approved" : "changes_requested";
    const notes =
      Array.isArray(parsed.notes) && parsed.notes.length > 0
        ? parsed.notes
        : [`Overall score ${overallScore.toFixed(2)} / 5`];

    return { taskId: result.taskId, status, notes, scores, overallScore };
  }

  private stubReview(result: WorkerResult, task?: TaskSpec): ReviewDecision {
    if (!task) {
      const passing = result.producedFiles.length > 0;
      return {
        taskId: result.taskId,
        status: passing ? "approved" : "changes_requested",
        notes: passing ? ["Outputs declared", "Ready for merge queue"] : ["No produced files listed"],
        overallScore: passing ? 5 : 0
      };
    }

    const passing = result.producedFiles.length > 0;
    const scores: CriterionScore[] = task.acceptanceCriteria.map((ac) => ({
      criterionId: ac.id,
      score: passing ? 5 : 0,
      rationale: passing ? "Output declared (stub review)" : "No outputs to evaluate (stub review)"
    }));
    const overallScore = weightedAverage(scores, task);
    return {
      taskId: result.taskId,
      status: passing ? "approved" : "changes_requested",
      notes: passing ? ["Outputs declared", "Stub reviewer auto-approved"] : ["No produced files listed"],
      scores,
      overallScore
    };
  }
}

function normalizeScores(raw: Array<{ criterionId: string; score: number; rationale: string }>, task: TaskSpec): CriterionScore[] {
  const knownIds = new Set(task.acceptanceCriteria.map((ac) => ac.id));
  const byId = new Map<string, CriterionScore>();
  for (const item of raw) {
    if (!knownIds.has(item.criterionId)) continue;
    byId.set(item.criterionId, {
      criterionId: item.criterionId,
      score: clamp(item.score, 0, 5),
      rationale: item.rationale ?? ""
    });
  }
  return task.acceptanceCriteria.map(
    (ac) =>
      byId.get(ac.id) ?? {
        criterionId: ac.id,
        score: 0,
        rationale: "No score returned by reviewer"
      }
  );
}

function weightedAverage(scores: CriterionScore[], task: TaskSpec): number {
  if (scores.length === 0) return 0;
  const weights = task.acceptanceCriteria.reduce<Record<string, number>>((acc, ac) => {
    acc[ac.id] = ac.weight ?? 1;
    return acc;
  }, {});
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const w = weights[s.criterionId] ?? 1;
    weightedSum += s.score * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
