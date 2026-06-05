import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "./api.js";
import { RunList } from "./components/RunList.js";
import { RunDetail } from "./components/RunDetail.js";
import { CreateRunForm } from "./components/CreateRunForm.js";
import { Icon } from "./components/Icon.js";
import { useUtcClock } from "./hooks/useUtcClock.js";
import type { OrchestrationRun, RunSummary } from "./types.js";

export function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<OrchestrationRun | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const clock = useUtcClock();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await client.listRuns();
      setRuns(items.sort((a, b) => b.id.localeCompare(a.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      streamRef.current?.close();
    };
  }, []);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setActiveStream(null);
  }, []);

  const subscribe = useCallback(
    (runId: string) => {
      closeStream();
      const source = new EventSource(`/runs/${encodeURIComponent(runId)}/stream`);
      streamRef.current = source;
      setActiveStream(runId);

      source.addEventListener("queued", () => {
        setSelected((prev) => (prev && prev.id === runId ? { ...prev, status: "queued" } : prev));
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: "queued" } : r)));
      });

      source.addEventListener("started", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { at: string };
        setSelected((prev) =>
          prev && prev.id === runId ? { ...prev, status: "running", startedAt: data.at } : prev
        );
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: "running" } : r)));
      });

      source.addEventListener("planned", () => {
        void refresh();
      });

      source.addEventListener("routed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { decisions: OrchestrationRun["routingDecisions"] };
        setSelected((prev) =>
          prev && prev.id === runId ? { ...prev, routingDecisions: data.decisions } : prev
        );
      });

      source.addEventListener("task-completed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { result: OrchestrationRun["results"][number] };
        setSelected((prev) => {
          if (!prev || prev.id !== runId) return prev;
          const others = prev.results.filter((r) => r.taskId !== data.result.taskId);
          return { ...prev, results: [...others, data.result] };
        });
      });

      source.addEventListener("task-reviewed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { review: OrchestrationRun["reviews"][number] };
        setSelected((prev) => {
          if (!prev || prev.id !== runId) return prev;
          const others = prev.reviews.filter((r) => r.taskId !== data.review.taskId);
          return { ...prev, reviews: [...others, data.review] };
        });
      });

      source.addEventListener("history", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { entry: OrchestrationRun["history"][number] };
        setSelected((prev) =>
          prev && prev.id === runId ? { ...prev, history: [...prev.history, data.entry] } : prev
        );
      });

      source.addEventListener("done", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { run: OrchestrationRun };
        setSelected((prev) => (prev && prev.id === runId ? data.run : prev));
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: data.run.status } : r)));
        closeStream();
        void refresh();
      });

      source.addEventListener("error", () => {
        /* EventSource auto-reconnects; server closes the stream on done/error. */
      });
    },
    [closeStream, refresh]
  );

  const select = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const run = await client.getRun(id);
        setSelected(run);
        if (run.status === "running" || run.status === "queued") subscribe(id);
        else closeStream();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [subscribe, closeStream]
  );

  const create = useCallback(
    async (idea: string) => {
      setError(null);
      try {
        const run = await client.createRunAsync(idea);
        await refresh();
        setSelected(run);
        subscribe(run.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh, subscribe]
  );

  const retry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const run = await client.retryRunAsync(id);
        await refresh();
        setSelected(run);
        subscribe(run.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh, subscribe]
  );

  const active = runs.filter((r) => r.status === "running").length;
  const queued = runs.filter((r) => r.status === "queued").length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const runNumber = selected ? selected.id.replace(/[^0-9]/g, "") : runs[0]?.id.replace(/[^0-9]/g, "") ?? "—";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">✳</div>
          <div className="brand-block">
            <div className="brand-kicker">MIMO SWARM · PLANNER → ROUTER → WORKER → REVIEWER</div>
            <div className="brand-title">
              SWARMFORGE <span className="brand-x">×</span> MIMO ORCHESTRATION
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`mainnet-badge ${activeStream ? "is-live" : ""}`}>
            <span className="mainnet-dot" />
            {activeStream ? "LIVE · STREAMING" : "IDLE · READY"}
          </span>
          <span className="round-chip">RUN #{runNumber}</span>
          <span className="utc-clock">{clock} UTC</span>
        </div>
      </header>

      <div className="fleet-ribbon">
        <FleetStat label="runs" value={String(runs.length)} />
        <FleetStat label="active" value={String(active)} tone={active > 0 ? "accent" : undefined} />
        <FleetStat label="queued" value={String(queued)} tone={queued > 0 ? "sky" : undefined} />
        <FleetStat label="completed" value={String(completed)} tone="good" />
        <FleetStat label="changes" value={String(failed)} tone={failed > 0 ? "bad" : undefined} />
        <div className="fleet-spacer" />
        <button className="ghost" onClick={refresh} disabled={loading}>
          <Icon name="refresh" />
          {loading ? "syncing" : "sync"}
        </button>
      </div>

      {error ? (
        <div className="banner error">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <main className="grid">
        <aside className="sidebar">
          <div>
            <div className="section-head">
              <h2>launch</h2>
            </div>
            <div className="create-card">
              <CreateRunForm onCreate={create} />
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>runs</h2>
              <span className="count-pill">{runs.length}</span>
            </div>
            <RunList runs={runs} selectedId={selected?.id} onSelect={select} />
          </div>
        </aside>

        <section className="pane detail">
          {selected ? (
            <RunDetail run={selected} onRetry={retry} live={activeStream === selected.id} />
          ) : (
            <div className="empty detail-empty">
              <div className="empty-glyph">✳</div>
              <div className="empty-title">no run selected</div>
              <div className="empty-hint">launch a new run or pick one from the swarm</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FleetStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="fleet-stat">
      <div className="fleet-stat-label">{label}</div>
      <div className={`fleet-stat-value ${tone ? `tone-${tone}` : ""}`}>{value}</div>
    </div>
  );
}
