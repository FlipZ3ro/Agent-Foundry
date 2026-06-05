export {
  MIMO_CATALOG,
  findModel,
  pickModelForTier,
  costForUsage,
  type ModelTier,
  type ModelCapability,
  type ModelEntry
} from "./models.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
}

export interface ChatResult {
  content: string;
  reasoning?: string;
  usage: ChatUsage;
  model: string;
  durationMs: number;
}

export interface LlmClient {
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult>;
}

export class LlmError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "LlmError";
  }
}

export interface MimoClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class MimoClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: MimoClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    const impl = options.fetch ?? globalThis.fetch;
    if (!impl) throw new Error("MimoClient requires a fetch implementation");
    this.fetchImpl = impl.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.4
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.jsonMode) body.response_format = { type: "json_object" };

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      const parsed = safeJson(text);
      if (!response.ok) {
        throw new LlmError(`MiMo chat failed (${response.status})`, response.status, parsed ?? text);
      }

      const choice = (parsed as MimoResponse)?.choices?.[0]?.message;
      if (!choice) throw new LlmError("MiMo returned no choices", response.status, parsed);

      const usage = (parsed as MimoResponse).usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      return {
        content: choice.content ?? "",
        reasoning: choice.reasoning_content ?? undefined,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens
        },
        model: (parsed as MimoResponse).model ?? options.model,
        durationMs: Date.now() - started
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function fromEnv(env: NodeJS.ProcessEnv = process.env): MimoClient | null {
  const baseUrl = env.MIMO_BASE_URL;
  const apiKey = env.MIMO_API_KEY;
  if (!baseUrl || !apiKey || apiKey === "replace-me") return null;
  return new MimoClient({ baseUrl, apiKey });
}

export function extractJson<T = unknown>(content: string): T {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1]! : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const arrStart = candidate.indexOf("[");
    const begin =
      start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (begin >= 0 && end > begin) {
      return JSON.parse(candidate.slice(begin, end + 1)) as T;
    }
    throw new LlmError(`Failed to parse JSON from LLM output`, undefined, content);
  }
}

interface MimoResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: { reasoning_tokens?: number };
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
