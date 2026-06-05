import type { OrchestrationRun } from "../../schemas/src/index.js";

export type RunSummary = Pick<
  OrchestrationRun,
  "id" | "blueprintId" | "idea" | "status" | "startedAt" | "completedAt" | "retryOf"
>;

export interface AgentFoundryClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class AgentFoundryError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = "AgentFoundryError";
  }
}

export class AgentFoundryClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AgentFoundryClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:3210").replace(/\/$/, "");
    const impl = options.fetch ?? globalThis.fetch;
    if (!impl) {
      throw new Error("AgentFoundryClient requires a fetch implementation");
    }
    this.fetchImpl = impl.bind(globalThis);
  }

  createRun(idea: string): Promise<OrchestrationRun> {
    return this.request<OrchestrationRun>("POST", "/runs?wait=true", { idea });
  }

  createRunAsync(idea: string): Promise<OrchestrationRun> {
    return this.request<OrchestrationRun>("POST", "/runs", { idea });
  }

  listRuns(): Promise<RunSummary[]> {
    return this.request<RunSummary[]>("GET", "/runs");
  }

  getRun(id: string): Promise<OrchestrationRun> {
    return this.request<OrchestrationRun>("GET", `/runs/${encodeURIComponent(id)}`);
  }

  retryRun(id: string): Promise<OrchestrationRun> {
    return this.request<OrchestrationRun>("POST", `/runs/${encodeURIComponent(id)}/retry?wait=true`);
  }

  retryRunAsync(id: string): Promise<OrchestrationRun> {
    return this.request<OrchestrationRun>("POST", `/runs/${encodeURIComponent(id)}/retry`);
  }

  /** Build the SSE URL for a run. Consume with new EventSource(this url). */
  streamUrl(id: string): string {
    return `${this.baseUrl}/runs/${encodeURIComponent(id)}/stream`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    const parsed = text ? safeJson(text) : undefined;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request to ${path} failed with status ${response.status}`;
      throw new AgentFoundryError(message, response.status, parsed);
    }

    return parsed as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
