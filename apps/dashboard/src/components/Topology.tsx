import type { OrchestrationRun } from "../types.js";

type CellState = "idle" | "exec" | "approved" | "changes";

interface LaneColumn {
  lane: string;
  cells: CellState[];
}

function buildColumns(run: OrchestrationRun): LaneColumn[] {
  const order: string[] = [];
  const byLane = new Map<string, CellState[]>();

  const decisions = run.routingDecisions.length
    ? run.routingDecisions
    : run.results.map((r) => ({ taskId: r.taskId, lane: r.lane }));

  for (const d of decisions) {
    const lane = (d as { lane?: string }).lane ?? run.results.find((r) => r.taskId === d.taskId)?.lane ?? "task";
    if (!byLane.has(lane)) {
      byLane.set(lane, []);
      order.push(lane);
    }
    const result = run.results.find((r) => r.taskId === d.taskId);
    const review = run.reviews.find((r) => r.taskId === d.taskId);
    let state: CellState = "idle";
    if (review) state = review.status === "approved" ? "approved" : "changes";
    else if (result) state = "exec";
    byLane.get(lane)!.push(state);
  }

  return order.map((lane) => ({ lane, cells: byLane.get(lane)! }));
}

export function Topology({ run, live }: { run: OrchestrationRun; live: boolean }) {
  const columns = buildColumns(run);
  const tokens = run.metrics?.totalTokens ?? 0;
  const cost = run.metrics?.totalCostUsd ?? 0;
  const jobCount = run.metrics?.jobCount ?? run.results.length;
  const approved = run.metrics?.approvedCount ?? run.reviews.filter((r) => r.status === "approved").length;
  const reviewedCount = run.reviews.length;
  const successPct = reviewedCount > 0 ? Math.round((approved / reviewedCount) * 100) : 0;
  const scored = run.reviews.filter((r) => typeof r.overallScore === "number");
  const avgScore = scored.length
    ? scored.reduce((s, r) => s + (r.overallScore ?? 0), 0) / scored.length
    : 0;
  const steps = run.results.length + run.reviews.length;
  const activeCells = run.results.length - run.reviews.length;

  // SVG layout
  const W = 760;
  const H = 360;
  const cx = 96;
  const cy = H / 2;
  const gridLeft = 250;
  const gridRight = W - 30;
  const colCount = Math.max(columns.length, 1);
  const colGap = (gridRight - gridLeft) / Math.max(colCount, 1);
  const rowGap = 30;

  // decorative faint grid
  const faintCols = 11;
  const faintRows = 8;
  const faintDots: Array<{ x: number; y: number }> = [];
  for (let c = 0; c < faintCols; c++) {
    for (let r = 0; r < faintRows; r++) {
      faintDots.push({
        x: gridLeft + (c * (gridRight - gridLeft)) / (faintCols - 1),
        y: 50 + (r * (H - 100)) / (faintRows - 1)
      });
    }
  }

  const connectors: Array<{ x: number; y: number; state: CellState }> = [];

  return (
    <div className="topology">
      <div className="topo-left">
        <div className="topo-orchestrator">orchestrator</div>
        <div className="topo-model">MiMo 2.5</div>
        <div className="topo-legend">
          <span><i className="dot dot-idle" /> idle</span>
          <span><i className="dot dot-exec" /> exec</span>
          <span><i className="dot dot-approved" /> approved</span>
          <span><i className="dot dot-changes" /> changes</span>
        </div>
        <div className="topo-stats">
          <div className="topo-stat">
            <span className="topo-stat-label">success</span>
            <span className="topo-stat-value tone-good">{successPct}%</span>
          </div>
          <div className="topo-stat">
            <span className="topo-stat-label">avg score</span>
            <span className="topo-stat-value">{avgScore.toFixed(2)}</span>
          </div>
          <div className="topo-stat">
            <span className="topo-stat-label">tokens</span>
            <span className="topo-stat-value">{formatK(tokens)}</span>
          </div>
          <div className="topo-stat">
            <span className="topo-stat-label">cost</span>
            <span className="topo-stat-value tone-accent">${cost.toFixed(4)}</span>
          </div>
          <div className="topo-stat">
            <span className="topo-stat-label">steps</span>
            <span className="topo-stat-value">{steps}</span>
          </div>
          <div className="topo-stat">
            <span className="topo-stat-label">lanes</span>
            <span className="topo-stat-value">{columns.length}</span>
          </div>
        </div>
      </div>

      <div className="topo-right">
        <div className="topo-meta">
          <span>AGENTS <b>{jobCount}</b></span>
          <span>ACTIVE <b className="tone-accent">{Math.max(0, activeCells)}</b></span>
          <span>STEPS <b>{steps}</b></span>
          <span>THRUPUT <b>{formatK(tokens)}</b></span>
        </div>
        <svg className="topo-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* faint swarm grid */}
          {faintDots.map((d, i) => (
            <circle key={`f-${i}`} cx={d.x} cy={d.y} r={1.5} className="topo-faint" />
          ))}

          {/* column headers + real cells */}
          {columns.map((col, ci) => {
            const x = gridLeft + ci * colGap + colGap / 2;
            const total = col.cells.length;
            const startY = cy - ((total - 1) * rowGap) / 2;
            const done = col.cells.filter((s) => s !== "idle").length;
            return (
              <g key={col.lane}>
                <text x={x} y={28} className="topo-col-label" textAnchor="middle">
                  {col.lane.toUpperCase()}
                </text>
                <text x={x} y={42} className="topo-col-count" textAnchor="middle">
                  {done}/{total}
                </text>
                {col.cells.map((state, ri) => {
                  const y = startY + ri * rowGap;
                  if (state !== "idle") connectors.push({ x, y, state });
                  const r = state === "idle" ? 3.5 : 5.5;
                  return (
                    <circle
                      key={`${col.lane}-${ri}`}
                      cx={x}
                      cy={y}
                      r={r}
                      className={`topo-cell topo-cell-${state} ${live && state === "exec" ? "is-live" : ""}`}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* connectors from orchestrator to active/done cells */}
          {connectors.map((c, i) => (
            <line
              key={`c-${i}`}
              x1={cx + 30}
              y1={cy}
              x2={c.x}
              y2={c.y}
              className={`topo-link topo-link-${c.state}`}
            />
          ))}

          {/* orchestrator node */}
          <circle cx={cx} cy={cy} r={48} className="topo-orbit" />
          <circle cx={cx} cy={cy} r={30} className="topo-core" />
          <text x={cx} y={cy + 4} className="topo-core-label" textAnchor="middle">
            MIMO
          </text>
          {live ? <circle cx={cx} cy={cy} r={30} className="topo-core-pulse" /> : null}
        </svg>
      </div>
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
