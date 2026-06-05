import { useState } from "react";
import { Icon } from "./Icon.js";
import type { OrchestrationRun } from "../types.js";

interface Props {
  run: OrchestrationRun;
  onRetry: (id: string) => Promise<void>;
  live?: boolean;
}

export function RunDetail({ run, onRetry, live = false }: Props) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await onRetry(run.id);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="detail-body">
      <section className="hero">
        <div className="hero-row">
          <div className="hero-meta">
            <span className="kicker">run</span>
            <h1>{run.id}</h1>
            <p className="hero-idea">{run.idea}</p>
            {run.retryOf ? (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                ↻ retry of <span className="mono">{run.retryOf}</span>
              </p>
            ) : null}
          </div>
          <div className="hero-actions">
            <span className={`status status-${run.status}`}>
              {run.status}
              {live ? <span className="live-pulse" /> : null}
            </span>
            <button className="primary" onClick={handleRetry} disabled={retrying || live}>
              <Icon name="retry" />
              {retrying ? "retrying" : "retry"}
            </button>
          </div>
        </div>

        {run.metrics ? (
          <div className="metric-strip">
            <Metric label="tokens" value={run.metrics.totalTokens.toLocaleString()} accent />
            <Metric label="cost" value={`$${run.metrics.totalCostUsd.toFixed(4)}`} accent />
            <Metric label="jobs" value={String(run.metrics.jobCount)} />
            <Metric label="approved" value={String(run.metrics.approvedCount)} />
            <Metric label="changes" value={String(run.metrics.changesRequestedCount)} />
          </div>
        ) : null}
      </section>

      {live && run.routingDecisions.length === 0 ? (
        <div className="card empty live-skeleton">
          <Icon name={run.status === "queued" ? "clock" : "sparkle"} className="empty-icon" />
          <div className="empty-title">
            {run.status === "queued" ? "waiting in queue…" : "planning…"}
          </div>
          <div className="empty-hint">
            {run.status === "queued"
              ? "concurrency cap reached, run starts as soon as a slot frees up"
              : "MiMo is decomposing your idea into tasks"}
          </div>
        </div>
      ) : null}

      {run.routingDecisions.length === 0 ? null : (
      <section className="detail-section">
        <h3>
          routing decisions <span className="count-pill">{run.routingDecisions.length}</span>
        </h3>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>task</th>
                <th>mode</th>
                <th>model</th>
                <th>owner</th>
                <th>reason</th>
              </tr>
            </thead>
            <tbody>
              {run.routingDecisions.map((d) => (
                <tr key={d.taskId}>
                  <td className="mono">{d.taskId}</td>
                  <td>
                    <span className={`chip mode-${d.mode}`}>{d.mode}</span>
                  </td>
                  <td>
                    {d.modelId ? (
                      <span className={`chip tier-${d.modelTier ?? "standard"}`}>{d.modelId}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="mono muted">{d.owner}</td>
                  <td className="muted">{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {run.results.length === 0 ? null : (
      <section className="detail-section">
        <h3>
          results <span className="count-pill">{run.results.length}</span>
          {live && run.results.length < run.routingDecisions.length ? (
            <span className="live-counter">
              {run.results.length} / {run.routingDecisions.length}
            </span>
          ) : null}
        </h3>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>job</th>
                <th>lane</th>
                <th>summary</th>
                <th>files</th>
                <th>tokens</th>
                <th>cost</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((r) => (
                <tr key={r.jobId}>
                  <td className="mono">{r.jobId}</td>
                  <td>
                    <span className={`chip lane-${r.lane}`}>{r.lane}</span>
                  </td>
                  <td>{r.summary}</td>
                  <td className="num">{r.artifacts?.length ?? 0}</td>
                  <td className="num">{r.metrics?.tokensUsed ?? "—"}</td>
                  <td className="num">{r.metrics ? `$${r.metrics.costUsd.toFixed(4)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {hasArtifacts(run) ? (
        <section className="detail-section">
          <h3>
            artifacts <span className="count-pill">{countArtifacts(run)}</span>
          </h3>
          <ul className="artifact-list">
            {run.results.flatMap((r) =>
              (r.artifacts ?? []).map((a) => (
                <li key={`${r.taskId}-${a.path}`} className="artifact-card">
                  <div className="artifact-head">
                    <span className="mono artifact-task">{r.taskId}</span>
                    <a
                      href={`/runs/${encodeURIComponent(run.id)}/artifacts/${encodeURIComponent(a.taskId)}/${a.path.split("/").map(encodeURIComponent).join("/")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="artifact-path mono"
                    >
                      {a.path}
                    </a>
                    <span className="artifact-meta">
                      <span className="artifact-size mono">{formatBytes(a.sizeBytes)}</span>
                      <span className={`chip lane-${r.lane}`}>{r.lane}</span>
                    </span>
                  </div>
                  <div className="muted artifact-sha mono" title={a.sha256}>
                    sha256 · {a.sha256.slice(0, 16)}…
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {run.reviews.length === 0 ? null : (
      <section className="detail-section">
        <h3>
          reviews <span className="count-pill">{run.reviews.length}</span>
          {live && run.reviews.length < run.routingDecisions.length ? (
            <span className="live-counter">
              {run.reviews.length} / {run.routingDecisions.length}
            </span>
          ) : null}
        </h3>
        <ul className="review-list">
          {run.reviews.map((rv) => (
            <li key={rv.taskId} className="review-card">
              <div className="review-head">
                <span className="mono">{rv.taskId}</span>
                <span className={`status status-mini status-${rv.status}`}>{rv.status}</span>
                {typeof rv.overallScore === "number" ? (
                  <span className="score-pill" title="weighted rubric score (0–5)">
                    {rv.overallScore.toFixed(2)} / 5
                  </span>
                ) : null}
              </div>
              {rv.scores && rv.scores.length > 0 ? (
                <ul className="score-list">
                  {rv.scores.map((s) => (
                    <li key={s.criterionId} className="score-item">
                      <span className="mono score-id">{s.criterionId}</span>
                      <ScoreBar value={s.score} />
                      <span className="muted score-rationale">{s.rationale}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="muted review-notes">{rv.notes.join(" · ")}</div>
            </li>
          ))}
        </ul>
      </section>
      )}

      <section className="detail-section">
        <h3>
          history <span className="count-pill">{run.history.length}</span>
        </h3>
        <ol className="history">
          {run.history.map((h, i) => (
            <li key={i}>
              <span className="history-dot" />
              <span className="stage">{h.stage}</span>
              <span className="muted">{h.detail}</span>
              <span className="ts">{new Date(h.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function hasArtifacts(run: OrchestrationRun): boolean {
  return run.results.some((r) => (r.artifacts?.length ?? 0) > 0);
}

function countArtifacts(run: OrchestrationRun): number {
  return run.results.reduce((sum, r) => sum + (r.artifacts?.length ?? 0), 0);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${accent ? "accent" : ""}`}>{value}</div>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  const tone = clamped >= 4 ? "good" : clamped >= 2.5 ? "ok" : "bad";
  return (
    <div className={`score-bar score-bar-${tone}`} title={`${clamped.toFixed(1)} / 5`}>
      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      <span className="score-bar-value">{clamped.toFixed(1)}</span>
    </div>
  );
}
