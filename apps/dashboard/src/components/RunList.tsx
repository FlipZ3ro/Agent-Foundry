import { Icon } from "./Icon.js";
import type { RunSummary } from "../types.js";

interface Props {
  runs: RunSummary[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function RunList({ runs, selectedId, onSelect }: Props) {
  if (runs.length === 0) {
    return (
      <div className="empty">
        <Icon name="inbox" className="empty-icon" />
        <div className="empty-title">no runs yet</div>
        <div className="empty-hint">create one above to get started</div>
      </div>
    );
  }

  return (
    <ul className="run-list">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            className={`row ${selectedId === run.id ? "active" : ""}`}
            onClick={() => onSelect(run.id)}
          >
            <span className={`row-status-dot ${run.status}`} aria-label={run.status} />
            <div className="row-main">
              <span className="row-id">{run.id}</span>
              <span className="row-idea" title={run.idea}>
                {run.idea}
              </span>
            </div>
            <div className="row-meta">
              {run.retryOf ? (
                <span className="row-tag" title={`retry of ${run.retryOf}`}>
                  ↻
                </span>
              ) : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
